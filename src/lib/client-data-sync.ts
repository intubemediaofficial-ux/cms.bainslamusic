import { syncChannelToBackend } from "@/lib/backend-sync";
import { getAnyValidAccessToken, getValidAccessToken } from "@/lib/channel-tokens";
import {
  cacheClientData,
  CachedChannelData,
  CachedClientData,
  getCachedClientData,
} from "@/lib/client-data-cache";
import { kv } from "@/lib/redis";
import { cacheChannelStats } from "@/lib/youtube-cache";
import { getChannelStatsById, getRevenueData } from "@/lib/youtube";
import { warmRecentMonths } from "@/lib/monthly-channel-analytics";
import { syncVendorGoogleSheet } from "@/lib/vendor-google-sheets";

const USERS_KEY = "bainsla_users";
const SYNC_LOCK_KEY = "client_data_sync_lock";
const SYNC_STATUS_KEY = "client_data_sync_status";
const DOWNSTREAM_SYNC_LOCK_KEY = "revenue_downstream_sync_lock";
const CLIENT_CHANNELS_SYNC_URL = process.env.CLIENT_CHANNELS_SYNC_URL || "";

export type ClientDataSyncMode = "stats" | "revenue";

type SyncResultStatus =
  | "updated"
  | "preserved"
  | "empty"
  | "no_token"
  | "failed";

interface StoredUser {
  id: string;
  email: string;
  channels: string[];
  status: "active" | "inactive" | "pending";
}

export type ChannelRevenueSyncStatus =
  | "updated"
  | "no_token"
  | "quota_exceeded"
  | "analytics_empty"
  | "failed";

interface RevenueResult {
  channelId: string;
  status: ChannelRevenueSyncStatus;
  revenue?: number;
  rpm?: number;
}

interface VerifiedChannelSnapshot {
  channelTitle: string;
  thumbnail: string;
  subscribers: number;
  views: number;
  videoCount: number;
}

export interface ClientDataSyncResult {
  userId: string;
  email: string;
  channels: number;
  revenue: number;
  revenueUpdated: number;
  revenuePreserved: number;
  revenueSkipped: number;
  noToken: number;
  quotaExceeded: number;
  analyticsEmpty: number;
  failed: number;
  status: SyncResultStatus;
}

export interface ClientDataSyncSummary {
  mode: ClientDataSyncMode;
  status: "completed" | "already_running" | "failed";
  startedAt: string;
  completedAt?: string;
  statsUpdated: number;
  revenueTargetDate?: string;
  results: ClientDataSyncResult[];
  error?: string;
}

export interface RevenueDownstreamSyncResult {
  status: "completed" | "already_running" | "partial";
  vendorSheet: "updated" | "not_configured" | "failed" | "skipped";
  clientSheet: "updated" | "not_configured" | "failed" | "skipped";
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function getNestedRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  return getRecord(record[key]);
}

function getString(record: Record<string, unknown> | null, key: string): string {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function getOptionalNumber(
  record: Record<string, unknown> | null,
  key: string
): number | undefined {
  const value = record?.[key];
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function channelFromStats(
  channelId: string,
  stats: Record<string, unknown> | undefined,
  previous: CachedChannelData | undefined,
  now: string
): CachedChannelData {
  if (!stats) {
    return previous || {
      channelId,
      channelTitle: channelId,
      thumbnail: "",
      subscribers: 0,
      views: 0,
      videoCount: 0,
      estimatedRevenue: 0,
      rpm: 0,
      cpm: 0,
      lastUpdated: now,
    };
  }

  const snippet = getNestedRecord(stats, "snippet");
  const statistics = getNestedRecord(stats, "statistics");
  const thumbnails = getNestedRecord(snippet || {}, "thumbnails");
  const mediumThumbnail = getNestedRecord(thumbnails || {}, "medium");
  const defaultThumbnail = getNestedRecord(thumbnails || {}, "default");

  return {
    channelId,
    channelTitle: getString(snippet, "title") || previous?.channelTitle || channelId,
    thumbnail:
      getString(mediumThumbnail, "url") ||
      getString(defaultThumbnail, "url") ||
      previous?.thumbnail ||
      "",
    subscribers:
      getOptionalNumber(statistics, "subscriberCount") ?? previous?.subscribers ?? 0,
    views: getOptionalNumber(statistics, "viewCount") ?? previous?.views ?? 0,
    videoCount: getOptionalNumber(statistics, "videoCount") ?? previous?.videoCount ?? 0,
    estimatedRevenue: previous?.estimatedRevenue || 0,
    rpm: previous?.rpm || 0,
    cpm: previous?.cpm || 0,
    lastUpdated: now,
    statsUpdatedAt: now,
    revenueUpdatedAt: previous?.revenueUpdatedAt,
    revenueSyncedThrough: previous?.revenueSyncedThrough,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isQuotaError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("quota") || message.includes("rate limit");
}

function classifyRevenueError(error: unknown): RevenueResult["status"] {
  return isQuotaError(error) ? "quota_exceeded" : "failed";
}

async function fetchChannelStats(
  channelIds: string[]
): Promise<{ stats: Array<Record<string, unknown>>; error?: string }> {
  let lastError: string | undefined;
  for (const channelId of channelIds) {
    const accessToken = await getValidAccessToken(channelId);
    if (!accessToken) continue;
    try {
      return { stats: await getChannelStatsById(accessToken, channelIds) };
    } catch (error) {
      lastError = getErrorMessage(error);
      if (isQuotaError(error)) break;
    }
  }
  return { stats: [], error: lastError };
}

async function fetchRevenue(
  channelId: string,
  startDate: string,
  endDate: string
): Promise<RevenueResult> {
  const accessToken = await getValidAccessToken(channelId);
  if (!accessToken) return { channelId, status: "no_token" };

  try {
    const revenueData = await getRevenueData(accessToken, startDate, endDate, channelId);
    if (!revenueData) return { channelId, status: "analytics_empty" };
    const headers = (revenueData.columnHeaders || []).map((header) => header.name || "");
    const revenueIndex = headers.indexOf("estimatedRevenue");
    const viewsIndex = headers.indexOf("views");
    const rows = revenueData.rows || [];

    if (revenueIndex === -1 || rows.length === 0) {
      return { channelId, status: "analytics_empty" };
    }

    const revenueValues = rows.map((row) => Number(row[revenueIndex]));
    if (revenueValues.some((value) => !Number.isFinite(value))) {
      return { channelId, status: "analytics_empty" };
    }
    const revenue = revenueValues.reduce((total, value) => total + value, 0);
    const views = viewsIndex === -1
      ? 0
      : rows.reduce((total, row) => {
          const value = Number(row[viewsIndex]);
          return total + (Number.isFinite(value) ? value : 0);
        }, 0);

    return {
      channelId,
      status: "updated",
      revenue,
      rpm: views > 0 ? (revenue / views) * 1000 : 0,
    };
  } catch (error) {
    return { channelId, status: classifyRevenueError(error) };
  }
}

async function fetchRevenueWithConcurrency(
  channelIds: string[],
  startDate: string,
  endDate: string,
  concurrency = 4
): Promise<RevenueResult[]> {
  const results: RevenueResult[] = new Array(channelIds.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < channelIds.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fetchRevenue(channelIds[index], startDate, endDate);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, channelIds.length) }, () => worker())
  );
  return results;
}

function getRevenueDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 28);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

async function syncClientChannelsGoogleSheet(): Promise<
  "updated" | "not_configured" | "failed"
> {
  const apiKey = process.env.REVENUE_EXPORT_API_KEY?.trim();
  if (!apiKey || !CLIENT_CHANNELS_SYNC_URL) return "not_configured";

  try {
    const response = await fetch(CLIENT_CHANNELS_SYNC_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(240_000),
    });
    if (!response.ok) {
      console.error(
        `[ClientDataSync] Client Channels sheet sync failed with HTTP ${response.status}`
      );
      return "failed";
    }
    return "updated";
  } catch (error) {
    console.error(
      "[ClientDataSync] Client Channels sheet sync failed:",
      error instanceof Error ? error.message : error
    );
    return "failed";
  }
}

export async function syncRevenueDownstreamSheets(): Promise<RevenueDownstreamSyncResult> {
  const acquired = await kv.setIfNotExists(
    DOWNSTREAM_SYNC_LOCK_KEY,
    { startedAt: new Date().toISOString() },
    10 * 60
  );
  if (!acquired) {
    return {
      status: "already_running",
      vendorSheet: "skipped",
      clientSheet: "skipped",
    };
  }

  let vendorSheet: RevenueDownstreamSyncResult["vendorSheet"] = "failed";
  let clientSheet: RevenueDownstreamSyncResult["clientSheet"] = "failed";
  try {
    await warmRecentMonths(7);

    try {
      vendorSheet = (await syncVendorGoogleSheet()).status;
    } catch (error) {
      console.error("[ClientDataSync] vendor Google Sheets sync failed:", error);
    }

    clientSheet = await syncClientChannelsGoogleSheet();
    return {
      status:
        vendorSheet === "failed" || clientSheet === "failed" ? "partial" : "completed",
      vendorSheet,
      clientSheet,
    };
  } finally {
    await kv.del(DOWNSTREAM_SYNC_LOCK_KEY);
  }
}

export async function syncVerifiedChannelRevenue(
  channelId: string,
  snapshot: VerifiedChannelSnapshot
): Promise<ChannelRevenueSyncStatus> {
  const revenueRange = getRevenueDateRange();
  const revenueResult = await fetchRevenue(
    channelId,
    revenueRange.startDate,
    revenueRange.endDate
  );
  if (revenueResult.status !== "updated") return revenueResult.status;

  const users = (await kv.get<StoredUser[]>(USERS_KEY)) || [];
  const owners = users.filter(
    (user) => user.status === "active" && (user.channels || []).includes(channelId)
  );
  const now = new Date().toISOString();

  for (const user of owners) {
    const previous =
      (await getCachedClientData(user.email)) ||
      (await getCachedClientData(user.id));
    const existingChannel = previous?.channels.find(
      (channel) => channel.channelId === channelId
    );
    const syncedChannel: CachedChannelData = {
      channelId,
      channelTitle: snapshot.channelTitle || existingChannel?.channelTitle || channelId,
      thumbnail: snapshot.thumbnail || existingChannel?.thumbnail || "",
      subscribers: snapshot.subscribers,
      views: snapshot.views,
      videoCount: snapshot.videoCount,
      estimatedRevenue: revenueResult.revenue || 0,
      rpm: revenueResult.rpm || 0,
      cpm: existingChannel?.cpm || 0,
      lastUpdated: now,
      statsUpdatedAt: now,
      revenueUpdatedAt: now,
      revenueSyncedThrough: revenueRange.endDate,
    };
    const channels = previous
      ? previous.channels.some((channel) => channel.channelId === channelId)
        ? previous.channels.map((channel) =>
            channel.channelId === channelId ? syncedChannel : channel
          )
        : [...previous.channels, syncedChannel]
      : [syncedChannel];
    const data: CachedClientData = {
      userId: user.id,
      email: user.email,
      channels,
      totalRevenue: channels.reduce(
        (total, channel) => total + (channel.estimatedRevenue || 0),
        0
      ),
      totalViews: channels.reduce((total, channel) => total + (channel.views || 0), 0),
      totalSubscribers: channels.reduce(
        (total, channel) => total + (channel.subscribers || 0),
        0
      ),
      lastUpdated: now,
      lastStatsSync: now,
      lastRevenueSync: now,
      source: "channel_oauth_verification",
    };
    await cacheClientData(user.email, data, {
      preserveRevenue: false,
      source: "channel_oauth_verification",
    });
  }

  return revenueResult.status;
}

export async function getClientDataSyncStatus(): Promise<ClientDataSyncSummary | null> {
  return kv.get<ClientDataSyncSummary>(SYNC_STATUS_KEY);
}

export async function syncClientData(mode: ClientDataSyncMode): Promise<ClientDataSyncSummary> {
  const startedAt = new Date().toISOString();
  const lockSeconds = mode === "revenue" ? 30 * 60 : 10 * 60;
  const acquired = await kv.setIfNotExists(SYNC_LOCK_KEY, { mode, startedAt }, lockSeconds);

  if (!acquired) {
    return {
      mode,
      status: "already_running",
      startedAt,
      statsUpdated: 0,
      results: [],
    };
  }

  const summary: ClientDataSyncSummary = {
    mode,
    status: "completed",
    startedAt,
    statsUpdated: 0,
    results: [],
  };
  await kv.set(SYNC_STATUS_KEY, summary);

  try {
    const users = (await kv.get<StoredUser[]>(USERS_KEY)) || [];
    const activeUsers = users.filter((user) => user.status === "active");
    const channelIds = Array.from(
      new Set(activeUsers.flatMap((user) => user.channels || []).filter(Boolean))
    );
    const statsMap = new Map<string, Record<string, unknown>>();

    if (mode === "stats" && channelIds.length > 0) {
      const statsResult = await fetchChannelStats(channelIds);
      for (const rawStats of statsResult.stats) {
        const channelId = getString(rawStats, "id");
        if (!channelId) continue;
        statsMap.set(channelId, rawStats);
        await cacheChannelStats(channelId, rawStats);
      }
      summary.statsUpdated = statsMap.size;
      summary.error = statsResult.error;
    }

    const revenueRange = getRevenueDateRange();
    if (mode === "revenue") summary.revenueTargetDate = revenueRange.endDate;
    for (const user of activeUsers) {
      const now = new Date().toISOString();
      const assignedChannelIds = Array.from(new Set(user.channels || []));
      const previous =
        (await getCachedClientData(user.email)) ||
        (await getCachedClientData(user.id));
      const previousMap = new Map(
        (previous?.channels || []).map((channel) => [channel.channelId, channel])
      );

      if (assignedChannelIds.length === 0) {
        const emptyData: CachedClientData = {
          userId: user.id,
          email: user.email,
          channels: [],
          totalRevenue: 0,
          totalViews: 0,
          totalSubscribers: 0,
          lastUpdated: now,
          lastStatsSync: mode === "stats" ? now : previous?.lastStatsSync,
          lastRevenueSync: previous?.lastRevenueSync,
          source: `server_${mode}_sync`,
        };
        await cacheClientData(user.email, emptyData, {
          preserveRevenue: true,
          source: `server_${mode}_sync`,
        });
        summary.results.push({
          userId: user.id,
          email: user.email,
          channels: 0,
          revenue: 0,
          revenueUpdated: 0,
          revenuePreserved: 0,
          revenueSkipped: 0,
          noToken: 0,
          quotaExceeded: 0,
          analyticsEmpty: 0,
          failed: 0,
          status: "empty",
        });
        continue;
      }

      let channels = assignedChannelIds.map((channelId) =>
        channelFromStats(channelId, statsMap.get(channelId), previousMap.get(channelId), now)
      );
      let revenueUpdated = 0;
      let revenuePreserved = assignedChannelIds.length;
      let revenueSkipped = 0;
      let noToken = 0;
      let quotaExceeded = 0;
      let analyticsEmpty = 0;
      let failed = 0;

      if (mode === "revenue") {
        const pendingChannelIds = assignedChannelIds.filter(
          (channelId) =>
            previousMap.get(channelId)?.revenueSyncedThrough !== revenueRange.endDate
        );
        revenueSkipped = assignedChannelIds.length - pendingChannelIds.length;
        const revenueResults = await fetchRevenueWithConcurrency(
          pendingChannelIds,
          revenueRange.startDate,
          revenueRange.endDate
        );
        const revenueMap = new Map(revenueResults.map((result) => [result.channelId, result]));
        noToken = revenueResults.filter((result) => result.status === "no_token").length;
        quotaExceeded = revenueResults.filter(
          (result) => result.status === "quota_exceeded"
        ).length;
        analyticsEmpty = revenueResults.filter(
          (result) => result.status === "analytics_empty"
        ).length;
        failed = revenueResults.filter((result) => result.status === "failed").length;
        channels = channels.map((channel) => {
          const revenueResult = revenueMap.get(channel.channelId);
          if (revenueResult?.status !== "updated") return channel;
          revenueUpdated += 1;
          return {
            ...channel,
            estimatedRevenue: revenueResult.revenue || 0,
            rpm: revenueResult.rpm || 0,
            revenueUpdatedAt: now,
            revenueSyncedThrough: revenueRange.endDate,
          };
        });
        revenuePreserved = assignedChannelIds.length - revenueUpdated;
      }

      const data: CachedClientData = {
        userId: user.id,
        email: user.email,
        channels,
        totalRevenue: channels.reduce(
          (total, channel) => total + (channel.estimatedRevenue || 0),
          0
        ),
        totalViews: channels.reduce((total, channel) => total + (channel.views || 0), 0),
        totalSubscribers: channels.reduce(
          (total, channel) => total + (channel.subscribers || 0),
          0
        ),
        lastUpdated: now,
        lastStatsSync: statsMap.size > 0 ? now : previous?.lastStatsSync,
        lastRevenueSync:
          mode === "revenue" && revenueUpdated > 0 ? now : previous?.lastRevenueSync,
        source: `server_${mode}_sync`,
      };

      await cacheClientData(user.email, data, {
        preserveRevenue: mode === "stats",
        source: `server_${mode}_sync`,
      });

      for (const channel of channels) {
        if (!statsMap.has(channel.channelId)) continue;
        syncChannelToBackend({
          channelId: channel.channelId,
          title: channel.channelTitle,
          thumbnailUrl: channel.thumbnail,
          subscriberCount: channel.subscribers,
          videoCount: channel.videoCount,
          viewCount: channel.views,
        }).catch(() => {});
      }

      const hadFreshData =
        assignedChannelIds.some((channelId) => statsMap.has(channelId)) || revenueUpdated > 0;
      const hasToken =
        revenueSkipped === assignedChannelIds.length ||
        (await getAnyValidAccessToken(assignedChannelIds));
      summary.results.push({
        userId: user.id,
        email: user.email,
        channels: channels.length,
        revenue: data.totalRevenue,
        revenueUpdated,
        revenuePreserved,
        revenueSkipped,
        noToken,
        quotaExceeded,
        analyticsEmpty,
        failed,
        status: hadFreshData ? "updated" : hasToken ? "preserved" : "no_token",
      });
    }

    if (mode === "revenue") {
      await syncRevenueDownstreamSheets();
    }

    summary.completedAt = new Date().toISOString();
    await kv.set(SYNC_STATUS_KEY, summary);
    return summary;
  } catch (error) {
    summary.status = "failed";
    summary.error = error instanceof Error ? error.message : String(error);
    summary.completedAt = new Date().toISOString();
    await kv.set(SYNC_STATUS_KEY, summary);
    return summary;
  } finally {
    await kv.del(SYNC_LOCK_KEY);
  }
}
