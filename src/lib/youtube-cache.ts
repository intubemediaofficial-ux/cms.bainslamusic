import { kv } from "@/lib/redis";

const YT_CACHE_PREFIX = "yt_cache:";

export interface CachedYouTubeData {
  channelId: string;
  videos?: unknown[];
  dashboardData?: unknown;
  channelStats?: unknown;
  lastUpdated: string;
}

function isKVAvailable(): boolean {
  return true; // Always available — using DigitalOcean Redis
}

export async function cacheChannelVideos(channelId: string, videos: unknown[]): Promise<void> {
  if (!isKVAvailable() || !videos.length) return;
  try {
    // Store max 200 videos to stay within KV size limits
    const trimmed = videos.slice(0, 200);
    await kv.set(`${YT_CACHE_PREFIX}videos:${channelId}`, {
      videos: trimmed,
      lastUpdated: new Date().toISOString(),
    });
    console.log(`[YTCache] Cached ${trimmed.length} videos for ${channelId}`);
  } catch (error) {
    console.error(`[YTCache] Failed to cache videos for ${channelId}:`, error);
  }
}

export async function getCachedChannelVideos(channelId: string): Promise<{ videos: unknown[]; lastUpdated: string } | null> {
  if (!isKVAvailable()) return null;
  try {
    return await kv.get<{ videos: unknown[]; lastUpdated: string }>(`${YT_CACHE_PREFIX}videos:${channelId}`);
  } catch (error) {
    console.error(`[YTCache] Failed to get cached videos for ${channelId}:`, error);
    return null;
  }
}

export async function cacheDashboardData(channelIds: string[], data: unknown): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    const key = [...channelIds].sort().join(",");
    await kv.set(`${YT_CACHE_PREFIX}dashboard:${key}`, {
      data,
      lastUpdated: new Date().toISOString(),
    });
    console.log(`[YTCache] Cached dashboard data for ${channelIds.length} channels`);
  } catch (error) {
    console.error(`[YTCache] Failed to cache dashboard data:`, error);
  }
}

export async function getCachedDashboardData(channelIds: string[]): Promise<{ data: unknown; lastUpdated: string } | null> {
  if (!isKVAvailable()) return null;
  try {
    const key = [...channelIds].sort().join(",");
    return await kv.get<{ data: unknown; lastUpdated: string }>(`${YT_CACHE_PREFIX}dashboard:${key}`);
  } catch (error) {
    console.error(`[YTCache] Failed to get cached dashboard data:`, error);
    return null;
  }
}

interface DashboardRange {
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
}

function dashboardRangeKey(channelIds: string[], range: DashboardRange): string {
  return `${YT_CACHE_PREFIX}dashboard-range:${range.startDate}:${range.endDate}:${range.prevStartDate}:${range.prevEndDate}:${[...channelIds].sort().join(",")}`;
}

export async function cacheDashboardRangeData(
  channelIds: string[],
  range: DashboardRange,
  data: unknown
): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    await kv.set(
      dashboardRangeKey(channelIds, range),
      { data, lastUpdated: new Date().toISOString() },
      { ex: 6 * 60 * 60 }
    );
  } catch (error) {
    console.error("[YTCache] Failed to cache dashboard range data:", error);
  }
}

export async function getCachedDashboardRangeData(
  channelIds: string[],
  range: DashboardRange
): Promise<{ data: unknown; lastUpdated: string } | null> {
  if (!isKVAvailable()) return null;
  try {
    return await kv.get<{ data: unknown; lastUpdated: string }>(
      dashboardRangeKey(channelIds, range)
    );
  } catch (error) {
    console.error("[YTCache] Failed to get dashboard range data:", error);
    return null;
  }
}

export async function cacheChannelStats(channelId: string, stats: unknown): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    await kv.set(`${YT_CACHE_PREFIX}stats:${channelId}`, {
      stats,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[YTCache] Failed to cache stats for ${channelId}:`, error);
  }
}

export async function getCachedChannelStats(channelId: string): Promise<{ stats: unknown; lastUpdated: string } | null> {
  if (!isKVAvailable()) return null;
  try {
    return await kv.get<{ stats: unknown; lastUpdated: string }>(`${YT_CACHE_PREFIX}stats:${channelId}`);
  } catch (error) {
    console.error(`[YTCache] Failed to get cached stats for ${channelId}:`, error);
    return null;
  }
}
