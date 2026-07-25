import { getValidAccessToken } from "@/lib/channel-tokens";
import { getAllCachedClientData } from "@/lib/client-data-cache";
import { kv } from "@/lib/redis";
import { getAnalyticsData } from "@/lib/youtube";

const USERS_KEY = "bainsla_users";
const CACHE_PREFIX = "monthly_channel_analytics:";
const LOCK_PREFIX = "monthly_channel_analytics_lock:";

const RETRY_COOLDOWN_MS = 10 * 60 * 1000;
const REVISION_WINDOW_DAYS = 15;
const CURRENT_MONTH_STALE_MS = 3 * 60 * 60 * 1000;
const RECENT_MONTH_STALE_MS = 24 * 60 * 60 * 1000;

interface StoredUser {
  channels?: string[];
  status?: "active" | "inactive" | "pending";
}

export interface MonthlyChannelData {
  channel_id: string;
  channel_name: string;
  revenue_usd: number;
  views: number;
  synced_through: string;
  updated_at: string;
}

interface MonthlyChannelCache {
  month: string;
  channels: MonthlyChannelData[];
  last_attempt_at: string;
}

export interface MonthlyChannelAnalytics {
  month: string;
  channels: MonthlyChannelData[];
  missingChannels: number;
  cacheStatus: "hit" | "updated" | "partial";
}

export function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month <= currentMonthKey();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
}

function getMonthDateRange(month: string): { startDate: string; endDate: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthEnd = new Date(Date.UTC(year, monthNumber - 1, lastDay));

  const reliable = new Date();
  reliable.setUTCDate(reliable.getUTCDate() - 2);

  const effectiveEnd = monthEnd < reliable ? monthEnd : reliable;
  const endDay = effectiveEnd.getUTCDate();
  const endMonth = effectiveEnd.getUTCMonth() + 1;
  const endYear = effectiveEnd.getUTCFullYear();

  return {
    startDate: `${month}-01`,
    endDate: `${endYear}-${pad(endMonth)}-${pad(endDay)}`,
  };
}

function isMonthFrozen(month: string): boolean {
  if (month >= currentMonthKey()) return false;
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthEnd = new Date(Date.UTC(year, monthNumber - 1, lastDay));
  const revisionCutoff = new Date(monthEnd);
  revisionCutoff.setUTCDate(revisionCutoff.getUTCDate() + REVISION_WINDOW_DAYS);
  return new Date() > revisionCutoff;
}

function staleThresholdMs(month: string): number {
  return month >= currentMonthKey() ? CURRENT_MONTH_STALE_MS : RECENT_MONTH_STALE_MS;
}

function isRowStale(row: MonthlyChannelData, month: string): boolean {
  if (isMonthFrozen(month)) return false;
  const updated = Date.parse(row.updated_at);
  if (!Number.isFinite(updated)) return true;
  return Date.now() - updated > staleThresholdMs(month);
}

function extractRevenueViews(
  data: Awaited<ReturnType<typeof getAnalyticsData>>
): { revenue: number; views: number } | null {
  if (!data?.columnHeaders?.length || !data.rows?.length) return null;
  const revenueIndex = data.columnHeaders.findIndex((h) => h.name === "estimatedRevenue");
  const viewsIndex = data.columnHeaders.findIndex((h) => h.name === "views");
  if (revenueIndex === -1 && viewsIndex === -1) return null;

  let revenue = 0;
  let views = 0;
  for (const row of data.rows) {
    if (revenueIndex !== -1) {
      const v = Number(row[revenueIndex]);
      if (!Number.isFinite(v)) return null;
      revenue += v;
    }
    if (viewsIndex !== -1) {
      const v = Number(row[viewsIndex]);
      if (Number.isFinite(v)) views += v;
    }
  }
  return { revenue, views };
}

async function getAssignedChannelIds(): Promise<string[]> {
  const users = (await kv.get<StoredUser[]>(USERS_KEY)) || [];
  return Array.from(
    new Set(
      users
        .filter((user) => user.status === "active")
        .flatMap((user) => user.channels || [])
        .filter(Boolean)
    )
  );
}

async function getChannelNames(): Promise<Map<string, string>> {
  const cachedClients = await getAllCachedClientData();
  const names = new Map<string, string>();
  for (const client of cachedClients) {
    for (const channel of client.channels || []) {
      if (channel.channelTitle) names.set(channel.channelId, channel.channelTitle);
    }
  }
  return names;
}

async function fetchChannel(
  channelId: string,
  startDate: string,
  endDate: string
): Promise<{ revenue: number; views: number } | null> {
  const accessToken = await getValidAccessToken(channelId);
  if (!accessToken) return null;
  try {
    const data = await getAnalyticsData(
      accessToken,
      startDate,
      endDate,
      "estimatedRevenue,views",
      "",
      channelId
    );
    return extractRevenueViews(data);
  } catch {
    return null;
  }
}

async function fetchChannels(
  channelIds: string[],
  names: Map<string, string>,
  startDate: string,
  endDate: string,
  concurrency = 4
): Promise<MonthlyChannelData[]> {
  const results: Array<MonthlyChannelData | null> = new Array(channelIds.length);
  let nextIndex = 0;
  const now = new Date().toISOString();

  async function worker(): Promise<void> {
    while (nextIndex < channelIds.length) {
      const index = nextIndex;
      nextIndex += 1;
      const channelId = channelIds[index];
      const fetched = await fetchChannel(channelId, startDate, endDate);
      results[index] =
        fetched === null
          ? null
          : {
              channel_id: channelId,
              channel_name: names.get(channelId) || channelId,
              revenue_usd: fetched.revenue,
              views: fetched.views,
              synced_through: endDate,
              updated_at: now,
            };
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, channelIds.length) }, () => worker())
  );
  return results.filter((r): r is MonthlyChannelData => r !== null);
}

function sortChannels(channels: MonthlyChannelData[]): MonthlyChannelData[] {
  return [...channels].sort(
    (a, b) =>
      a.channel_name.localeCompare(b.channel_name) ||
      a.channel_id.localeCompare(b.channel_id)
  );
}

/**
 * Return durable monthly analytics for all currently-assigned channels.
 *
 * Cache is GLOBAL per month; callers must filter to their authorized channel IDs.
 * Never derive authorization from this cache.
 */
export async function getMonthlyChannelAnalytics(
  month: string,
  options: { allowFetch?: boolean } = {}
): Promise<MonthlyChannelAnalytics> {
  const allowFetch = options.allowFetch !== false;
  const cacheKey = `${CACHE_PREFIX}${month}`;
  const lockKey = `${LOCK_PREFIX}${month}`;

  const [assignedChannelIds, names, cached] = await Promise.all([
    getAssignedChannelIds(),
    getChannelNames(),
    kv.get<MonthlyChannelCache>(cacheKey),
  ]);

  const assignedSet = new Set(assignedChannelIds);
  const cachedMap = new Map(
    (cached?.channels || [])
      .filter((channel) => assignedSet.has(channel.channel_id))
      .map((channel) => [channel.channel_id, channel])
  );

  const pendingChannelIds = assignedChannelIds.filter((channelId) => {
    const row = cachedMap.get(channelId);
    return !row || isRowStale(row, month);
  });

  const withNames = (rows: MonthlyChannelData[]): MonthlyChannelData[] =>
    sortChannels(
      rows.map((channel) => ({
        ...channel,
        channel_name: names.get(channel.channel_id) || channel.channel_name,
      }))
    );

  if (pendingChannelIds.length === 0 || !allowFetch) {
    const channels = withNames(Array.from(cachedMap.values()));
    const missingChannels = assignedChannelIds.length - channels.length;
    return {
      month,
      channels,
      missingChannels,
      cacheStatus: missingChannels === 0 ? "hit" : "partial",
    };
  }

  const lastAttempt = cached?.last_attempt_at ? Date.parse(cached.last_attempt_at) : Number.NaN;
  const missingCount = assignedChannelIds.filter((id) => !cachedMap.has(id)).length;
  if (
    Number.isFinite(lastAttempt) &&
    Date.now() - lastAttempt < RETRY_COOLDOWN_MS &&
    missingCount === 0
  ) {
    const channels = withNames(Array.from(cachedMap.values()));
    return { month, channels, missingChannels: 0, cacheStatus: "hit" };
  }

  const acquired = await kv.setIfNotExists(lockKey, { startedAt: new Date().toISOString() }, 5 * 60);
  if (!acquired) {
    const channels = withNames(Array.from(cachedMap.values()));
    const missingChannels = assignedChannelIds.length - channels.length;
    return {
      month,
      channels,
      missingChannels,
      cacheStatus: missingChannels === 0 ? "hit" : "partial",
    };
  }

  try {
    const { startDate, endDate } = getMonthDateRange(month);
    const fetched = await fetchChannels(pendingChannelIds, names, startDate, endDate);

    for (const channel of fetched) {
      const previous = cachedMap.get(channel.channel_id);
      cachedMap.set(channel.channel_id, {
        ...channel,
        revenue_usd:
          channel.revenue_usd > 0 || !previous || previous.revenue_usd <= 0
            ? channel.revenue_usd
            : previous.revenue_usd,
        views:
          channel.views > 0 || !previous || previous.views <= 0
            ? channel.views
            : previous.views,
      });
    }

    const channels = withNames(Array.from(cachedMap.values()));
    await kv.set(cacheKey, {
      month,
      channels,
      last_attempt_at: new Date().toISOString(),
    } satisfies MonthlyChannelCache);

    const missingChannels = assignedChannelIds.length - channels.length;
    return {
      month,
      channels,
      missingChannels,
      cacheStatus: missingChannels === 0 ? "updated" : "partial",
    };
  } finally {
    await kv.del(lockKey);
  }
}

export function monthsInRange(fromMonth: string, toMonth: string): string[] {
  if (!isValidMonth(fromMonth) || !isValidMonth(toMonth) || fromMonth > toMonth) {
    return [];
  }
  const months: string[] = [];
  let [year, month] = fromMonth.split("-").map(Number);
  while (`${year}-${pad(month)}` <= toMonth) {
    months.push(`${year}-${pad(month)}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export interface MonthlyChannelRefreshResult {
  month: string;
  requested: number;
  updated: number;
  preserved: number;
}

/**
 * Force-refresh the given channels for a single month, ignoring staleness.
 *
 * Fresh YouTube revenue overwrites the cache row; when a fetch fails or returns
 * empty data the previous cached revenue/views are preserved (never zeroed).
 * Channels outside {@link channelIds} and other months are left untouched.
 */
export async function refreshMonthlyChannels(
  month: string,
  channelIds: string[]
): Promise<MonthlyChannelRefreshResult> {
  if (!isValidMonth(month)) {
    return { month, requested: 0, updated: 0, preserved: 0 };
  }
  const targetIds = Array.from(new Set(channelIds.filter(Boolean)));
  if (targetIds.length === 0) {
    return { month, requested: 0, updated: 0, preserved: 0 };
  }

  const cacheKey = `${CACHE_PREFIX}${month}`;
  const lockKey = `${LOCK_PREFIX}${month}`;
  const acquired = await kv.setIfNotExists(
    lockKey,
    { startedAt: new Date().toISOString() },
    5 * 60
  );
  if (!acquired) {
    return { month, requested: targetIds.length, updated: 0, preserved: 0 };
  }

  try {
    const [names, cached] = await Promise.all([
      getChannelNames(),
      kv.get<MonthlyChannelCache>(cacheKey),
    ]);
    const cachedMap = new Map(
      (cached?.channels || []).map((channel) => [channel.channel_id, channel])
    );
    const { startDate, endDate } = getMonthDateRange(month);
    const fetched = await fetchChannels(targetIds, names, startDate, endDate);
    const fetchedMap = new Map(fetched.map((channel) => [channel.channel_id, channel]));

    let updated = 0;
    let preserved = 0;
    for (const channelId of targetIds) {
      const previous = cachedMap.get(channelId);
      const next = fetchedMap.get(channelId);
      if (!next) {
        preserved += 1;
        continue;
      }
      cachedMap.set(channelId, {
        ...next,
        revenue_usd:
          next.revenue_usd > 0 || !previous || previous.revenue_usd <= 0
            ? next.revenue_usd
            : previous.revenue_usd,
        views:
          next.views > 0 || !previous || previous.views <= 0
            ? next.views
            : previous.views,
      });
      updated += 1;
    }

    const channels = sortChannels(
      Array.from(cachedMap.values()).map((channel) => ({
        ...channel,
        channel_name: names.get(channel.channel_id) || channel.channel_name,
      }))
    );
    await kv.set(cacheKey, {
      month,
      channels,
      last_attempt_at: new Date().toISOString(),
    } satisfies MonthlyChannelCache);

    return { month, requested: targetIds.length, updated, preserved };
  } finally {
    await kv.del(lockKey);
  }
}

/**
 * Warm the current month and recently-completed months so month filters load
 * instantly and pick up YouTube revisions. Called from the scheduled sync.
 */
export async function warmRecentMonths(monthsBack = 2): Promise<void> {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i <= monthsBack; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  for (const month of months) {
    try {
      await getMonthlyChannelAnalytics(month, { allowFetch: true });
    } catch (error) {
      console.error(`[MonthlyAnalytics] warm failed for ${month}:`, error);
    }
  }
}
