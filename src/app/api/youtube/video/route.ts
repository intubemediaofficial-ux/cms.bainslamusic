import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getValidAccessToken, getChannelToken } from "@/lib/channel-tokens";
import { getCachedChannelVideos, cacheChannelVideos } from "@/lib/youtube-cache";
import { kv } from "@/lib/redis";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

interface StoredUser {
  id: string;
  email: string;
  role: "client" | "company";
  parentId?: string;
  channels?: string[];
  status?: "active" | "inactive" | "pending";
}

interface CachedVideo {
  id?: string;
  snippet?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

async function getApprovedChannels(email: string): Promise<Set<string>> {
  const users = (await kv.get<StoredUser[]>("bainsla_users")) || [];
  const normalizedEmail = email.toLowerCase();
  const scopedUsers = ADMIN_EMAILS.includes(normalizedEmail)
    ? users.filter((user) => user.status !== "inactive")
    : (() => {
        const current = users.find((user) => user.email.toLowerCase() === normalizedEmail);
        if (!current || current.status !== "active") return [];
        if (current.role === "company") {
          return [
            current,
            ...users.filter(
              (user) => user.parentId === current.id && user.status === "active"
            ),
          ];
        }
        return [current];
      })();
  return new Set(scopedUsers.flatMap((user) => user.channels || []));
}

async function updateCachedVideo(channelId: string, update: CachedVideo): Promise<void> {
  try {
    const cached = await getCachedChannelVideos(channelId);
    if (!cached?.videos) return;
    const videos = cached.videos.map((item) => {
      const video = item as CachedVideo;
      if (video.id !== update.id) return item;
      return {
        ...video,
        ...update,
        snippet: { ...video.snippet, ...update.snippet },
        status: { ...video.status, ...update.status },
      };
    });
    await cacheChannelVideos(channelId, videos);
  } catch {
    return;
  }
}

async function getAccessTokenForChannel(channelId: string): Promise<string | null> {
  // Always use per-channel OAuth token (has YouTube API scope)
  // Session tokens from credentials login don't have YouTube scope
  const token = await getValidAccessToken(channelId);
  return token;
}


export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { videoId, channelId, title, description, privacyStatus, thumbnailUrl, tags } = body;

    if (!videoId || !channelId) {
      return Response.json({ error: "videoId and channelId required" }, { status: 400 });
    }

    const approvedChannels = await getApprovedChannels(session.user.email);
    if (!approvedChannels.has(channelId)) {
      return Response.json({ error: "You can only edit assigned channels" }, { status: 403 });
    }

    const accessToken = await getAccessTokenForChannel(channelId);
    if (!accessToken) {
      return Response.json({ error: "No valid token for this channel. Please validate the channel token first." }, { status: 401 });
    }

    // Get current video details first
    const detailRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
    );
    const detailData = await detailRes.json();
    if (!detailData.items?.length) {
      return Response.json({ error: "Video not found" }, { status: 404 });
    }

    const video = detailData.items[0];
    const updateBody: Record<string, unknown> = {
      id: videoId,
      snippet: {
        ...video.snippet,
        categoryId: video.snippet.categoryId,
      },
      status: {
        ...video.status,
      },
    };

    if (title !== undefined) updateBody.snippet = { ...(updateBody.snippet as Record<string, unknown>), title };
    if (description !== undefined) updateBody.snippet = { ...(updateBody.snippet as Record<string, unknown>), description };
    if (tags !== undefined) updateBody.snippet = { ...(updateBody.snippet as Record<string, unknown>), tags };
    if (privacyStatus) updateBody.status = { ...(updateBody.status as Record<string, unknown>), privacyStatus };

    const updateRes = await fetch(
      "https://www.googleapis.com/youtube/v3/videos?part=snippet,status",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateBody),
      }
    );

    const updateData = await updateRes.json();
    if (!updateRes.ok) {
      return Response.json(
        { error: updateData.error?.message || "Failed to update video" },
        { status: updateRes.status }
      );
    }

    // Handle thumbnail update if provided
    if (thumbnailUrl) {
      // thumbnailUrl is a base64 data URL or external URL — we'd need to upload
      // For now, thumbnail change via URL is not supported by YouTube API without file upload
    }

    await updateCachedVideo(channelId, updateData as CachedVideo);
    return Response.json({ data: updateData });
  } catch (error) {
    console.error("[YouTube Video] Update error:", error);
    return Response.json({ error: "Failed to update video" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, videos } = body as { action: string; videos: { videoId: string; channelId: string }[] };

    if (!action || !videos || !Array.isArray(videos) || videos.length === 0) {
      return Response.json({ error: "action and videos array required" }, { status: 400 });
    }

    const approvedChannels = await getApprovedChannels(session.user.email);
    if (videos.some(({ channelId }) => !approvedChannels.has(channelId))) {
      return Response.json({ error: "You can only update assigned channels" }, { status: 403 });
    }

    const results: { videoId: string; success: boolean; error?: string }[] = [];

    if (action === "bulkDelete") {
      for (const { videoId, channelId } of videos) {
        const accessToken = await getAccessTokenForChannel(channelId);
        if (!accessToken) {
          results.push({ videoId, success: false, error: "No valid token" });
          continue;
        }
        try {
          const deleteRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?id=${videoId}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (deleteRes.ok || deleteRes.status === 204) {
            results.push({ videoId, success: true });
            // Remove from KV cache
            try {
              const cached = await getCachedChannelVideos(channelId);
              if (cached?.videos) {
                const filtered = cached.videos.filter((v) => v && (v as { id?: string }).id !== videoId);
                await cacheChannelVideos(channelId, filtered);
              }
            } catch { /* cache update best-effort */ }
          } else if (deleteRes.status === 404) {
            // Video already deleted on YouTube — treat as success, clean cache
            results.push({ videoId, success: true });
            try {
              const cached = await getCachedChannelVideos(channelId);
              if (cached?.videos) {
                const filtered = cached.videos.filter((v) => v && (v as { id?: string }).id !== videoId);
                await cacheChannelVideos(channelId, filtered);
              }
            } catch { /* cache cleanup best-effort */ }
          } else {
            const data = await deleteRes.json().catch(() => ({}));
            const errMsg = (data as Record<string, Record<string, string>>)?.error?.message || "Failed";
            const errReason = (data as { error?: { errors?: Array<{ reason?: string }> } })?.error?.errors?.[0]?.reason || "";
            const tokenInfo = await getChannelToken(channelId);
            const hasMismatch = tokenInfo?.googleChannelId && tokenInfo.googleChannelId !== channelId;
            console.error(`[YouTube Video] Delete failed for ${videoId} channel=${channelId} googleCh=${tokenInfo?.googleChannelId} (status ${deleteRes.status}): ${errMsg} reason=${errReason}`);
            if (deleteRes.status === 403) {
              const mismatchMsg = hasMismatch
                ? `Wrong Google account! Token is for channel ${tokenInfo.googleChannelId}, not ${channelId}. Re-validate with the correct account.`
                : "Delete permission denied. Please re-validate token with the Google account that OWNS this channel.";
              results.push({ videoId, success: false, error: mismatchMsg });
            } else {
              results.push({ videoId, success: false, error: errMsg });
            }
          }
        } catch (e) {
          console.error(`[YouTube Video] Delete network error for ${videoId}:`, e);
          results.push({ videoId, success: false, error: "Network error" });
        }
      }
    } else if (action === "bulkPrivacy") {
      const { privacyStatus } = body as { privacyStatus: string; action: string; videos: { videoId: string; channelId: string }[] };
      if (!privacyStatus) {
        return Response.json({ error: "privacyStatus required for bulkPrivacy" }, { status: 400 });
      }
      for (const { videoId, channelId } of videos) {
        const accessToken = await getAccessTokenForChannel(channelId);
        if (!accessToken) {
          results.push({ videoId, success: false, error: "No valid token" });
          continue;
        }
        try {
          const detailRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}`,
            { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
          );
          const detailData = await detailRes.json();
          if (!detailData.items?.length) {
            results.push({ videoId, success: false, error: "Video not found" });
            continue;
          }
          const video = detailData.items[0];
          const updateBody = {
            id: videoId,
            snippet: { ...video.snippet, categoryId: video.snippet.categoryId },
            status: { ...video.status, privacyStatus },
          };
          const updateRes = await fetch(
            "https://www.googleapis.com/youtube/v3/videos?part=snippet,status",
            {
              method: "PUT",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(updateBody),
            }
          );
          if (updateRes.ok) {
            await updateCachedVideo(channelId, {
              id: videoId,
              snippet: video.snippet as Record<string, unknown>,
              status: updateBody.status as Record<string, unknown>,
            });
            results.push({ videoId, success: true });
          } else {
            const data = await updateRes.json().catch(() => ({}));
            results.push({ videoId, success: false, error: (data as Record<string, Record<string, string>>)?.error?.message || "Failed" });
          }
        } catch {
          results.push({ videoId, success: false, error: "Network error" });
        }
      }
    } else {
      return Response.json({ error: "Invalid action. Use bulkDelete or bulkPrivacy" }, { status: 400 });
    }

    const successCount = results.filter((r) => r.success).length;
    return Response.json({ data: { results, successCount, totalCount: videos.length } });
  } catch (error) {
    console.error("[YouTube Video] Bulk action error:", error);
    return Response.json({ error: "Failed to perform bulk action" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const videoId = url.searchParams.get("videoId");
    const channelId = url.searchParams.get("channelId");

    if (!videoId || !channelId) {
      return Response.json({ error: "videoId and channelId required" }, { status: 400 });
    }

    const approvedChannels = await getApprovedChannels(session.user.email);
    if (!approvedChannels.has(channelId)) {
      return Response.json({ error: "You can only delete videos from assigned channels" }, { status: 403 });
    }

    const accessToken = await getAccessTokenForChannel(channelId);
    if (!accessToken) {
      return Response.json({ error: "No valid token for this channel. Please validate the channel token first." }, { status: 401 });
    }

    // Check for channel mismatch before attempting delete
    const channelAuthorization = await getChannelToken(channelId);
    if (channelAuthorization?.googleChannelId && channelAuthorization.googleChannelId !== channelId) {
      console.warn(`[YouTube Video] Blocked channel mismatch on delete for ${channelId}`);
      return Response.json(
        { error: "The stored authorization does not match this channel. Re-validate the channel with its owner account." },
        { status: 403 }
      );
    }

    const deleteRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!deleteRes.ok && deleteRes.status !== 204) {
      const data = await deleteRes.json().catch(() => ({}));
      const errMsg = (data as Record<string, Record<string, string>>)?.error?.message || "Failed to delete video";
      console.error(`[YouTube Video] Single delete failed for ${videoId} channel=${channelId} googleCh=${channelAuthorization?.googleChannelId} (status ${deleteRes.status}):`, errMsg);
      if (deleteRes.status === 404) {
        // Video already deleted or not found on YouTube — remove from local cache
        try {
          const cached = await getCachedChannelVideos(channelId);
          if (cached?.videos) {
            const filtered = cached.videos.filter((v) => v && (v as { id?: string }).id !== videoId);
            await cacheChannelVideos(channelId, filtered);
          }
        } catch { /* cache cleanup best-effort */ }
        return Response.json({ data: { success: true, alreadyDeleted: true } });
      }
      if (deleteRes.status === 403) {
        return Response.json(
          { error: "Delete permission denied by YouTube. Re-validate the channel with the correct owner account and confirm that it grants video-management access." },
          { status: 403 }
        );
      }
      return Response.json(
        { error: errMsg },
        { status: deleteRes.status }
      );
    }

    // Remove from KV cache
    try {
      const cached = await getCachedChannelVideos(channelId);
      if (cached?.videos) {
        const filtered = cached.videos.filter((v) => v && (v as { id?: string }).id !== videoId);
        await cacheChannelVideos(channelId, filtered);
      }
    } catch { /* cache update best-effort */ }

    return Response.json({ data: { success: true } });
  } catch (error) {
    console.error("[YouTube Video] Delete error:", error);
    return Response.json({ error: "Failed to delete video" }, { status: 500 });
  }
}
