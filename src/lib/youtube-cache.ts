import { kv } from "@/lib/redis";

const YT_CACHE_PREFIX = "yt_cache:";
const VIDEO_CACHE_CHUNK_SIZE = 200;
const VIDEO_CACHE_VERSION = 2;
const VIDEO_LIBRARY_INDEX_VERSION = 1;
const VIDEO_LIBRARY_PREVIEW_SIZE = 25;
const VIDEO_CACHE_TTL_SECONDS = 31 * 24 * 60 * 60;

export interface CachedYouTubeData {
  channelId: string;
  videos?: unknown[];
  dashboardData?: unknown;
  channelStats?: unknown;
  lastUpdated: string;
}

interface VideoCacheManifest {
  videos: unknown[];
  lastUpdated: string;
  version?: number;
  complete?: boolean;
  totalCount?: number;
  chunkCount?: number;
  generation?: string;
}

export interface CachedChannelVideos {
  videos: unknown[];
  lastUpdated: string;
  complete: boolean;
  totalCount: number;
}

interface VideoLibrarySnapshot {
  version: number;
  lastUpdated: string;
  complete: boolean;
  totalCount: number;
  preview: unknown[];
}

interface VideoSearchIndexEntry {
  id: string;
  title: string;
}

interface VideoSearchIndex {
  version: number;
  entries: VideoSearchIndexEntry[];
}

interface VideoLibraryData {
  version: number;
  videos: unknown[];
}

export interface CachedVideoLibraryResult {
  videos: unknown[];
  lastUpdated: string | null;
  incompleteChannelIds: string[];
  loadedChannels: number;
  totalCount: number;
}

function isKVAvailable(): boolean {
  return true;
}

function videoCacheKey(channelId: string): string {
  return `${YT_CACHE_PREFIX}videos:${channelId}`;
}

function videoChunkKey(channelId: string, generation: string, index: number): string {
  return `${videoCacheKey(channelId)}:chunk:${generation}:${index}`;
}

function videoLibrarySnapshotKey(channelId: string): string {
  return `${YT_CACHE_PREFIX}video-library-snapshot:${channelId}`;
}

function videoSearchIndexKey(channelId: string): string {
  return `${YT_CACHE_PREFIX}video-search-index:${channelId}`;
}

function videoLibraryDataKey(channelId: string): string {
  return `${YT_CACHE_PREFIX}video-library-data:${channelId}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function compactVideoLibraryItem(item: unknown): unknown {
  const video = asRecord(item);
  const snippet = asRecord(video.snippet);
  const thumbnails = asRecord(snippet.thumbnails);
  const medium = asRecord(thumbnails.medium);
  const fallbackThumbnail = asRecord(thumbnails.default);
  const statistics = asRecord(video.statistics);
  const contentDetails = asRecord(video.contentDetails);
  const status = asRecord(video.status);
  const thumbnailUrl = typeof medium.url === "string"
    ? medium.url
    : typeof fallbackThumbnail.url === "string"
      ? fallbackThumbnail.url
      : undefined;

  return {
    id: video.id,
    snippet: {
      title: snippet.title,
      channelId: snippet.channelId,
      channelTitle: snippet.channelTitle,
      publishedAt: snippet.publishedAt,
      thumbnails: thumbnailUrl ? { medium: { url: thumbnailUrl } } : undefined,
    },
    statistics: {
      viewCount: statistics.viewCount,
      likeCount: statistics.likeCount,
      commentCount: statistics.commentCount,
    },
    contentDetails: {
      duration: contentDetails.duration,
      licensedContent: contentDetails.licensedContent,
    },
    status: {
      privacyStatus: status.privacyStatus,
      license: status.license,
      madeForKids: status.madeForKids,
      rejectionReason: status.rejectionReason,
      uploadStatus: status.uploadStatus,
    },
  };
}

function getVideoIdentity(item: unknown): { id: string; title: string } | null {
  const video = asRecord(item);
  const snippet = asRecord(video.snippet);
  if (typeof video.id !== "string" || typeof snippet.title !== "string") return null;
  return {
    id: video.id,
    title: snippet.title.normalize("NFKC").toLocaleLowerCase(),
  };
}

export async function cacheChannelVideoLibraryIndex(
  channelId: string,
  videos: unknown[],
  metadata: {
    lastUpdated: string;
    complete: boolean;
    totalCount: number;
  }
): Promise<void> {
  const compactVideos = videos.map(compactVideoLibraryItem);
  const entries = compactVideos.flatMap((item) => {
    const identity = getVideoIdentity(item);
    return identity ? [identity] : [];
  });
  await Promise.all([
    kv.set(videoLibrarySnapshotKey(channelId), {
      version: VIDEO_LIBRARY_INDEX_VERSION,
      lastUpdated: metadata.lastUpdated,
      complete: metadata.complete,
      totalCount: metadata.totalCount,
      preview: compactVideos.slice(0, VIDEO_LIBRARY_PREVIEW_SIZE),
    } satisfies VideoLibrarySnapshot, { ex: VIDEO_CACHE_TTL_SECONDS }),
    kv.set(videoSearchIndexKey(channelId), {
      version: VIDEO_LIBRARY_INDEX_VERSION,
      entries,
    } satisfies VideoSearchIndex, { ex: VIDEO_CACHE_TTL_SECONDS }),
    kv.set(videoLibraryDataKey(channelId), {
      version: VIDEO_LIBRARY_INDEX_VERSION,
      videos: compactVideos,
    } satisfies VideoLibraryData, { ex: VIDEO_CACHE_TTL_SECONDS }),
  ]);
}

async function ensureChannelVideoLibraryIndex(
  channelId: string
): Promise<VideoLibrarySnapshot | null> {
  const existing = await kv.get<VideoLibrarySnapshot>(videoLibrarySnapshotKey(channelId));
  if (existing?.version === VIDEO_LIBRARY_INDEX_VERSION) return existing;
  const cached = await getCachedChannelVideos(channelId);
  if (!cached) return null;
  await cacheChannelVideoLibraryIndex(channelId, cached.videos, cached);
  return {
    version: VIDEO_LIBRARY_INDEX_VERSION,
    lastUpdated: cached.lastUpdated,
    complete: cached.complete,
    totalCount: cached.totalCount,
    preview: cached.videos.slice(0, VIDEO_LIBRARY_PREVIEW_SIZE).map(compactVideoLibraryItem),
  };
}

export async function getCachedVideoLibraryPreview(
  channelIds: string[],
  limit: number
): Promise<CachedVideoLibraryResult> {
  const snapshots = await kv.mget<VideoLibrarySnapshot>(
    channelIds.map(videoLibrarySnapshotKey)
  );
  await Promise.all(
    snapshots.map(async (snapshot, index) => {
      if (snapshot?.version === VIDEO_LIBRARY_INDEX_VERSION) return;
      snapshots[index] = await ensureChannelVideoLibraryIndex(channelIds[index]);
    })
  );

  const videos: unknown[] = [];
  const seenTargets = new Set<string>();
  const incompleteChannelIds: string[] = [];
  let totalCount = 0;
  let loadedChannels = 0;
  let lastUpdated: string | null = null;

  for (let previewIndex = 0; videos.length < limit; previewIndex += 1) {
    let added = false;
    for (let channelIndex = 0; channelIndex < channelIds.length; channelIndex += 1) {
      const snapshot = snapshots[channelIndex];
      if (!snapshot || snapshot.version !== VIDEO_LIBRARY_INDEX_VERSION) continue;
      if (previewIndex === 0) {
        loadedChannels += 1;
        totalCount += snapshot.totalCount;
        if (!snapshot.complete) incompleteChannelIds.push(channelIds[channelIndex]);
        if (!lastUpdated || snapshot.lastUpdated > lastUpdated) {
          lastUpdated = snapshot.lastUpdated;
        }
      }
      const item = snapshot.preview[previewIndex];
      if (!item) continue;
      const videoId = asRecord(item).id;
      const target = `${channelIds[channelIndex]}:${String(videoId || videos.length)}`;
      if (seenTargets.has(target)) continue;
      seenTargets.add(target);
      videos.push(item);
      added = true;
      if (videos.length >= limit) break;
    }
    if (!added) break;
  }

  return {
    videos,
    lastUpdated,
    incompleteChannelIds,
    loadedChannels,
    totalCount,
  };
}

export async function searchCachedVideoLibrary(
  channelIds: string[],
  rawQuery: string
): Promise<CachedVideoLibraryResult> {
  const query = rawQuery.normalize("NFKC").toLocaleLowerCase();
  const indexes = await kv.mget<VideoSearchIndex>(
    channelIds.map(videoSearchIndexKey)
  );
  const snapshots = await kv.mget<VideoLibrarySnapshot>(
    channelIds.map(videoLibrarySnapshotKey)
  );
  await Promise.all(
    indexes.map(async (index, channelIndex) => {
      if (
        index?.version === VIDEO_LIBRARY_INDEX_VERSION &&
        snapshots[channelIndex]?.version === VIDEO_LIBRARY_INDEX_VERSION
      ) return;
      const snapshot = await ensureChannelVideoLibraryIndex(channelIds[channelIndex]);
      snapshots[channelIndex] = snapshot;
      indexes[channelIndex] = await kv.get<VideoSearchIndex>(
        videoSearchIndexKey(channelIds[channelIndex])
      );
    })
  );

  const matchingIds = new Map<string, Set<string>>();
  const incompleteChannelIds: string[] = [];
  let totalCount = 0;
  let loadedChannels = 0;
  let lastUpdated: string | null = null;

  for (let index = 0; index < channelIds.length; index += 1) {
    const snapshot = snapshots[index];
    const searchIndex = indexes[index];
    if (!snapshot || !searchIndex) continue;
    loadedChannels += 1;
    totalCount += snapshot.totalCount;
    if (!snapshot.complete) incompleteChannelIds.push(channelIds[index]);
    if (!lastUpdated || snapshot.lastUpdated > lastUpdated) lastUpdated = snapshot.lastUpdated;
    const ids = searchIndex.entries
      .filter((entry) => entry.title.includes(query))
      .map((entry) => entry.id);
    if (ids.length > 0) matchingIds.set(channelIds[index], new Set(ids));
  }

  const matchingChannelIds = Array.from(matchingIds.keys());
  const libraries = await kv.mget<VideoLibraryData>(
    matchingChannelIds.map(videoLibraryDataKey)
  );
  await Promise.all(
    libraries.map(async (library, index) => {
      if (library?.version === VIDEO_LIBRARY_INDEX_VERSION) return;
      const cached = await getCachedChannelVideos(matchingChannelIds[index]);
      if (!cached) return;
      await cacheChannelVideoLibraryIndex(matchingChannelIds[index], cached.videos, cached);
      libraries[index] = await kv.get<VideoLibraryData>(
        videoLibraryDataKey(matchingChannelIds[index])
      );
    })
  );
  const videos: unknown[] = [];
  const seenTargets = new Set<string>();
  for (let index = 0; index < matchingChannelIds.length; index += 1) {
    const channelId = matchingChannelIds[index];
    const ids = matchingIds.get(channelId);
    const library = libraries[index];
    if (!ids || !library) continue;
    for (const item of library.videos) {
      const videoId = asRecord(item).id;
      if (typeof videoId !== "string" || !ids.has(videoId)) continue;
      const target = `${channelId}:${videoId}`;
      if (seenTargets.has(target)) continue;
      seenTargets.add(target);
      videos.push(item);
    }
  }

  return {
    videos,
    lastUpdated,
    incompleteChannelIds,
    loadedChannels,
    totalCount,
  };
}

export async function cacheChannelVideos(
  channelId: string,
  videos: unknown[],
  options: {
    allowEmpty?: boolean;
    complete?: boolean;
    totalCount?: number;
  } = {}
): Promise<void> {
  if (!isKVAvailable() || (videos.length === 0 && !options.allowEmpty)) return;
  try {
    const lastUpdated = new Date().toISOString();
    const generation = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const chunks: unknown[][] = [];
    for (let index = 0; index < videos.length; index += VIDEO_CACHE_CHUNK_SIZE) {
      chunks.push(videos.slice(index, index + VIDEO_CACHE_CHUNK_SIZE));
    }

    await Promise.all([
      ...chunks.map((chunk, index) =>
        kv.set(videoChunkKey(channelId, generation, index), chunk, { ex: VIDEO_CACHE_TTL_SECONDS })
      ),
      cacheChannelVideoLibraryIndex(channelId, videos, {
        lastUpdated,
        complete: options.complete ?? true,
        totalCount: options.totalCount ?? videos.length,
      }),
    ]);
    await kv.set(videoCacheKey(channelId), {
      videos: videos.slice(0, VIDEO_CACHE_CHUNK_SIZE),
      lastUpdated,
      version: VIDEO_CACHE_VERSION,
      complete: options.complete ?? true,
      totalCount: options.totalCount ?? videos.length,
      chunkCount: chunks.length,
      generation,
    } satisfies VideoCacheManifest, { ex: VIDEO_CACHE_TTL_SECONDS });
    console.log(`[YTCache] Cached ${options.complete === false ? "partial" : "complete"} ${videos.length}-video library for ${channelId} in ${chunks.length} chunk(s)`);
  } catch (error) {
    console.error(`[YTCache] Failed to cache videos for ${channelId}:`, error);
  }
}

export async function getCachedChannelVideos(channelId: string): Promise<CachedChannelVideos | null> {
  if (!isKVAvailable()) return null;
  try {
    const manifest = await kv.get<VideoCacheManifest>(videoCacheKey(channelId));
    if (!manifest) return null;

    if (
      manifest.version !== VIDEO_CACHE_VERSION ||
      !manifest.complete ||
      !manifest.generation ||
      typeof manifest.chunkCount !== "number"
    ) {
      return {
        videos: Array.isArray(manifest.videos) ? manifest.videos : [],
        lastUpdated: manifest.lastUpdated,
        complete: false,
        totalCount: manifest.totalCount ?? (Array.isArray(manifest.videos) ? manifest.videos.length : 0),
      };
    }

    const chunks = await Promise.all(
      Array.from({ length: manifest.chunkCount }, (_, index) =>
        kv.get<unknown[]>(videoChunkKey(channelId, manifest.generation!, index))
      )
    );
    if (chunks.some((chunk) => !Array.isArray(chunk))) {
      return {
        videos: Array.isArray(manifest.videos) ? manifest.videos : [],
        lastUpdated: manifest.lastUpdated,
        complete: false,
        totalCount: manifest.totalCount ?? (Array.isArray(manifest.videos) ? manifest.videos.length : 0),
      };
    }

    return {
      videos: chunks.flatMap((chunk) => chunk || []),
      lastUpdated: manifest.lastUpdated,
      complete: true,
      totalCount: manifest.totalCount ?? chunks.reduce((sum, chunk) => sum + (chunk?.length || 0), 0),
    };
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
