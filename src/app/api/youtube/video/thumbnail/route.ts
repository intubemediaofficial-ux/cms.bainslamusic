import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getValidAccessToken } from "@/lib/channel-tokens";
import { getCachedChannelVideos, cacheChannelVideos } from "@/lib/youtube-cache";
import { kv } from "@/lib/redis";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);

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

async function updateCachedThumbnails(
  channelId: string,
  videoId: string,
  thumbnails: Record<string, unknown>
): Promise<void> {
  try {
    const cached = await getCachedChannelVideos(channelId);
    if (!cached?.videos) return;
    const videos = cached.videos.map((item) => {
      const video = item as CachedVideo;
      if (video.id !== videoId) return item;
      return { ...video, snippet: { ...video.snippet, thumbnails } };
    });
    await cacheChannelVideos(channelId, videos);
  } catch {
    return;
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }

  const videoId = form.get("videoId");
  const channelId = form.get("channelId");
  const file = form.get("file");
  if (typeof videoId !== "string" || typeof channelId !== "string" || !videoId || !channelId) {
    return Response.json({ error: "videoId and channelId required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "Thumbnail file required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json({ error: "Thumbnail must be a JPG or PNG image" }, { status: 400 });
  }
  if (file.size > MAX_THUMBNAIL_BYTES) {
    return Response.json({ error: "Thumbnail must be 2 MB or smaller" }, { status: 400 });
  }

  const approvedChannels = await getApprovedChannels(session.user.email);
  if (!approvedChannels.has(channelId)) {
    return Response.json({ error: "You can only edit assigned channels" }, { status: 403 });
  }

  const accessToken = await getValidAccessToken(channelId);
  if (!accessToken) {
    return Response.json(
      { error: "No valid token for this channel. Please validate the channel token first." },
      { status: 401 }
    );
  }

  try {
    const uploadRes = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": file.type,
          "Content-Length": String(file.size),
        },
        body: Buffer.from(await file.arrayBuffer()),
      }
    );
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      return Response.json(
        { error: uploadData.error?.message || "Failed to upload thumbnail" },
        { status: uploadRes.status }
      );
    }
    const thumbnails = uploadData.items?.[0] ?? {};
    await updateCachedThumbnails(channelId, videoId, thumbnails);
    return Response.json({ data: { thumbnails } });
  } catch (error) {
    console.error("[YouTube Thumbnail] Upload error:", error);
    return Response.json({ error: "Failed to upload thumbnail" }, { status: 500 });
  }
}
