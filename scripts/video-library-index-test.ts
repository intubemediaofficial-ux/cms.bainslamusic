import assert from "node:assert/strict";
import { kv } from "../src/lib/redis";
import {
  cacheChannelVideos,
  getCachedVideoLibraryPreview,
  searchCachedVideoLibrary,
} from "../src/lib/youtube-cache";

function video(id: string, title: string, channelId: string) {
  return {
    id,
    snippet: {
      title,
      channelId,
      channelTitle: channelId,
      publishedAt: "2026-01-01T00:00:00Z",
      thumbnails: { medium: { url: `https://example.com/${id}.jpg` } },
    },
    statistics: { viewCount: "1" },
    status: { privacyStatus: "public" },
  };
}

async function main() {
  const suffix = `${process.pid}-${Date.now()}`;
  const channelA = `UCtest-fast-video-a-${suffix}`;
  const channelB = `UCtest-fast-video-b-${suffix}`;

  try {
    await Promise.all([
      cacheChannelVideos(channelA, [
        video("a1", "Kishori Bhajan Live", channelA),
        video("a2", "Morning Aarti", channelA),
      ]),
      cacheChannelVideos(channelB, [
        video("b1", "Kishori Bhajan Remix", channelB),
        video("b2", "Evening Aarti", channelB),
      ]),
    ]);

    const preview = await getCachedVideoLibraryPreview([channelA, channelB], 3);
    assert.equal(preview.loadedChannels, 2);
    assert.equal(preview.totalCount, 4);
    assert.deepEqual(
      preview.videos.map((item) => (item as { id: string }).id),
      ["a1", "b1", "a2"]
    );

    const search = await searchCachedVideoLibrary([channelA, channelB], "kishori");
    assert.equal(search.loadedChannels, 2);
    assert.deepEqual(
      search.videos.map((item) => (item as { id: string }).id).sort(),
      ["a1", "b1"]
    );

    console.log("Video library preview and cross-channel search passed");
  } finally {
    const keys = await kv.keys(`*${suffix}*`);
    if (keys.length > 0) await kv.del(...keys);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
