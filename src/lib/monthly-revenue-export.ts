import { getValidAccessToken } from "@/lib/channel-tokens";
import { getAllCachedClientData } from "@/lib/client-data-cache";
import { kv } from "@/lib/redis";
import { getAnalyticsData } from "@/lib/youtube";

const USERS_KEY = "bainsla_users";
const CACHE_PREFIX = "monthly_revenue_export:";
const LOCK_PREFIX = "monthly_revenue_export_lock:";
const RETRY_COOLDOWN_MS = 10 * 60 * 1000;

interface StoredUser {
  channels?: string[];
  status?: "active" | "inactive" | "pending";
}

export interface MonthlyRevenueChannel {
  channel_name: string;
  channel_id: string;
  revenue_usd: number;
}

interface MonthlyRevenueCache {
  month: string;
  channels: MonthlyRevenueChannel[];
  last_attempt_at: string;
}

export interface MonthlyRevenueExport {
  month: string;
  channels: MonthlyRevenueChannel[];
  missingChannels: number;
  cacheStatus: "hit" | "updated" | "partial";
}

function getMonthDateRange(month: string): { startDate: string; endDate: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function getRevenueValue(data: Awaited<ReturnType<typeof getAnalyticsData>>): number | null {
  if (!data?.columnHeaders?.length || !data.rows?.length) return null;
  const revenueIndex = data.columnHeaders.findIndex(
    (header) => header.name === "estimatedRevenue"
  );
  if (revenueIndex === -1) return null;

  const values = data.rows.map((row) => Number(row[revenueIndex]));
  if (values.some((value) => !Number.isFinite(value))) return null;
  return values.reduce((total, value) => total + value, 0);
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

async function fetchChannelRevenue(
  channelId: string,
  startDate: string,
  endDate: string
): Promise<number | null> {
  const accessToken = await getValidAccessToken(channelId);
  if (!accessToken) return null;
  try {
    const data = await getAnalyticsData(
      accessToken,
      startDate,
      endDate,
      "estimatedRevenue",
      "",
      channelId
    );
    return getRevenueValue(data);
  } catch {
    return null;
  }
}

async function fetchPendingRevenue(
  channelIds: string[],
  names: Map<string, string>,
  startDate: string,
  endDate: string,
  concurrency = 4
): Promise<MonthlyRevenueChannel[]> {
  const results: Array<MonthlyRevenueChannel | null> = new Array(channelIds.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < channelIds.length) {
      const index = nextIndex;
      nextIndex += 1;
      const channelId = channelIds[index];
      const revenue = await fetchChannelRevenue(channelId, startDate, endDate);
      results[index] = revenue === null
        ? null
        : {
            channel_name: names.get(channelId) || channelId,
            channel_id: channelId,
            revenue_usd: revenue,
          };
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, channelIds.length) }, () => worker())
  );
  return results.filter((result): result is MonthlyRevenueChannel => result !== null);
}

function sortChannels(channels: MonthlyRevenueChannel[]): MonthlyRevenueChannel[] {
  return [...channels].sort(
    (a, b) =>
      a.channel_name.localeCompare(b.channel_name) ||
      a.channel_id.localeCompare(b.channel_id)
  );
}

export async function getMonthlyRevenueExport(
  month: string
): Promise<MonthlyRevenueExport> {
  const cacheKey = `${CACHE_PREFIX}${month}`;
  const lockKey = `${LOCK_PREFIX}${month}`;
  const [assignedChannelIds, names, cached] = await Promise.all([
    getAssignedChannelIds(),
    getChannelNames(),
    kv.get<MonthlyRevenueCache>(cacheKey),
  ]);
  const assignedSet = new Set(assignedChannelIds);
  const cachedMap = new Map(
    (cached?.channels || [])
      .filter((channel) => assignedSet.has(channel.channel_id))
      .map((channel) => [channel.channel_id, channel])
  );
  const pendingChannelIds = assignedChannelIds.filter(
    (channelId) => !cachedMap.has(channelId)
  );

  if (pendingChannelIds.length === 0) {
    const channels = sortChannels(
      Array.from(cachedMap.values()).map((channel) => ({
        ...channel,
        channel_name: names.get(channel.channel_id) || channel.channel_name,
      }))
    );
    return { month, channels, missingChannels: 0, cacheStatus: "hit" };
  }

  const lastAttempt = cached?.last_attempt_at
    ? Date.parse(cached.last_attempt_at)
    : Number.NaN;
  if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < RETRY_COOLDOWN_MS) {
    return {
      month,
      channels: sortChannels(Array.from(cachedMap.values())),
      missingChannels: pendingChannelIds.length,
      cacheStatus: "partial",
    };
  }

  const acquired = await kv.setIfNotExists(
    lockKey,
    { startedAt: new Date().toISOString() },
    5 * 60
  );
  if (!acquired) {
    return {
      month,
      channels: sortChannels(Array.from(cachedMap.values())),
      missingChannels: pendingChannelIds.length,
      cacheStatus: "partial",
    };
  }

  try {
    const { startDate, endDate } = getMonthDateRange(month);
    const fetched = await fetchPendingRevenue(
      pendingChannelIds,
      names,
      startDate,
      endDate
    );
    for (const channel of fetched) cachedMap.set(channel.channel_id, channel);

    const channels = sortChannels(Array.from(cachedMap.values()));
    const lastAttemptAt = new Date().toISOString();
    await kv.set(cacheKey, {
      month,
      channels,
      last_attempt_at: lastAttemptAt,
    } satisfies MonthlyRevenueCache);

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
