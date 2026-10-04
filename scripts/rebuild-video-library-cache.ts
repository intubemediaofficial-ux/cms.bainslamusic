import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

interface ChannelScopeUser {
  channels?: string[];
  status?: "active" | "inactive" | "pending";
}

async function main() {
  const [
    { kv },
    { getValidAccessToken },
    { getChannelVideos, getChannelVideosPublic },
    { cacheChannelVideoLibraryIndex, cacheChannelVideos, getCachedChannelVideos },
  ] = await Promise.all([
    import("../src/lib/redis"),
    import("../src/lib/channel-tokens"),
    import("../src/lib/youtube"),
    import("../src/lib/youtube-cache"),
  ]);

  const users = (await kv.get<ChannelScopeUser[]>("bainsla_users")) || [];
  const channelIds = Array.from(new Set(
    users
      .filter((user) => user.status !== "inactive")
      .flatMap((user) => user.channels || [])
      .filter(Boolean)
  ));

  let rebuiltChannels = 0;
  let rebuiltVideos = 0;
  for (const channelId of channelIds) {
    const cached = await getCachedChannelVideos(channelId);
    if (cached) {
      await cacheChannelVideoLibraryIndex(channelId, cached.videos, cached);
    }
    if (cached?.complete) continue;

    let videos: unknown[] = [];
    try {
      const token = await getValidAccessToken(channelId);
      if (token) videos = await getChannelVideos(token, channelId, 0);
    } catch (error) {
      console.warn(`[VideoLibrary] Authorized fetch failed for ${channelId}:`, error instanceof Error ? error.message : error);
    }
    if (videos.length === 0) {
      try {
        videos = await getChannelVideosPublic(channelId, 0);
      } catch (error) {
        console.warn(`[VideoLibrary] Public fetch failed for ${channelId}:`, error instanceof Error ? error.message : error);
      }
    }
    if (videos.length === 0) {
      console.warn(`[VideoLibrary] Preserved existing cache for ${channelId}; refresh returned no videos`);
      continue;
    }

    await cacheChannelVideos(channelId, videos);
    rebuiltChannels += 1;
    rebuiltVideos += videos.length;
  }

  console.log(`Rebuilt ${rebuiltVideos} cached videos across ${rebuiltChannels} channels`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
