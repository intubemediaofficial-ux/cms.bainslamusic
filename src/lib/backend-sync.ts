/**
 * Backend sync utilities — keeps Vercel KV and DigitalOcean PostgreSQL in sync.
 * Called from API routes when channels are added, removed, or updated.
 */

const BACKEND_URL = process.env.BACKEND_URL || "";

async function callBackend(path: string, method = "GET", body?: unknown) {
  if (!BACKEND_URL) return null;
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      console.warn(`[BackendSync] ${method} ${path} returned ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[BackendSync] ${method} ${path} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Sync a channel to the backend database after it's added on the frontend.
 */
export async function syncChannelToBackend(channelData: {
  channelId: string;
  title?: string;
  customUrl?: string;
  thumbnailUrl?: string;
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number;
}) {
  return callBackend("/api/channels", "POST", {
    channelId: channelData.channelId,
    title: channelData.title || "",
    customUrl: channelData.customUrl || "",
    thumbnailUrl: channelData.thumbnailUrl || "",
  });
}

/**
 * Notify backend when a channel is removed/delinked on the frontend.
 */
export async function removeChannelFromBackend(channelId: string) {
  return callBackend(`/api/channels/${channelId}`, "DELETE");
}

/**
 * Notify backend when a channel is permanently removed by admin.
 */
export async function permanentRemoveFromBackend(channelId: string, adminId: string) {
  return callBackend("/api/admin/channel/permanent-remove", "POST", {
    channelId,
    adminId,
  });
}

/**
 * Notify backend to expire all tokens for a user.
 */
export async function expireAllTokensOnBackend(userId: string, adminId: string) {
  return callBackend("/api/admin/token/expire-all", "POST", {
    userId,
    adminId,
  });
}

/**
 * Trigger revenue sync for a channel on the backend.
 */
export async function triggerRevenueSync(channelId: string) {
  return callBackend(`/api/sync/channel/${channelId}/revenue`, "POST");
}

/**
 * Get backend health status to check if backend is available.
 */
export async function isBackendAvailable(): Promise<boolean> {
  if (!BACKEND_URL) return false;
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.status === "healthy";
    }
    return false;
  } catch {
    return false;
  }
}
