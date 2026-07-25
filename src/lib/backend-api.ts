/**
 * Backend API client for InTubeMedia CMS
 * Connects frontend (Vercel) to backend (DigitalOcean) at api.intubemedia.com
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface BackendResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

async function backendFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<BackendResponse<T>> {
  if (!BACKEND_URL) return { error: "Backend not configured" };
  const url = `${BACKEND_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    const json = await res.json();
    if (!res.ok) {
      return { error: json.error || `Backend error: ${res.status}` };
    }
    return { data: json as T };
  } catch (err) {
    console.error(`[BackendAPI] ${path} failed:`, err);
    return { error: err instanceof Error ? err.message : "Backend unavailable" };
  }
}

// ---------- Health ----------

export interface HealthStatus {
  status: string;
  checks: { server: string; database: string; redis: string };
  uptime: number;
  timestamp: string;
}

export async function getHealth(): Promise<HealthStatus | null> {
  const res = await backendFetch<HealthStatus>("/api/health");
  return res.data ?? null;
}

// ---------- Revenue ----------

export interface DailyRevenue {
  date: string;
  estimatedRevenue: number;
  estimatedAdRevenue: number;
  grossRevenue: number;
  currency: string;
  inrAmount: number;
}

export interface ChannelRevenueResponse {
  channelId: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalInr: number;
  currency: string;
  dailyData: DailyRevenue[];
}

export async function getChannelRevenue(
  channelId: string,
  startDate: string,
  endDate: string,
  section = "frontend"
): Promise<ChannelRevenueResponse | null> {
  const params = new URLSearchParams({ startDate, endDate, section });
  const res = await backendFetch<ChannelRevenueResponse>(
    `/api/revenue/channel/${channelId}?${params}`
  );
  return res.data ?? null;
}

export interface MultiChannelRevenueResponse {
  channels: Record<string, ChannelRevenueResponse>;
  totalRevenue: number;
  totalInr: number;
}

export async function getMultiChannelRevenue(
  channelIds: string[],
  startDate: string,
  endDate: string,
  section = "frontend"
): Promise<MultiChannelRevenueResponse | null> {
  const res = await backendFetch<MultiChannelRevenueResponse>("/api/revenue/multi", {
    method: "POST",
    body: JSON.stringify({ channelIds, startDate, endDate, section }),
  });
  return res.data ?? null;
}

export interface TopChannel {
  channelId: string;
  totalRevenue: number;
  totalInr: number;
  title?: string;
  thumbnail?: string;
}

export async function getTopChannels(
  startDate: string,
  endDate: string,
  limit = 5
): Promise<TopChannel[]> {
  const params = new URLSearchParams({ startDate, endDate, limit: String(limit) });
  const res = await backendFetch<TopChannel[]>(`/api/revenue/top-channels?${params}`);
  return res.data ?? [];
}

// ---------- Channels ----------

export interface BackendChannel {
  channel_id: string;
  user_id: number | null;
  title: string;
  custom_url: string;
  thumbnail_url: string;
  status: string;
  linked_at: string;
  subscriber_count: number;
  video_count: number;
  view_count: number;
  sync_status: string;
  last_synced_at: string | null;
  owner_name: string | null;
  owner_email: string | null;
}

export async function getBackendChannels(
  status = "active",
  userId?: string
): Promise<BackendChannel[]> {
  const params = new URLSearchParams({ status });
  if (userId) params.set("userId", userId);
  const res = await backendFetch<BackendChannel[]>(`/api/channels?${params}`);
  return res.data ?? [];
}

export async function addBackendChannel(data: {
  channelId: string;
  userId?: string;
  title?: string;
  customUrl?: string;
  thumbnailUrl?: string;
}): Promise<BackendChannel | null> {
  const res = await backendFetch<BackendChannel>("/api/channels", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data ?? null;
}

export async function removeBackendChannel(channelId: string): Promise<boolean> {
  const res = await backendFetch(`/api/channels/${channelId}`, { method: "DELETE" });
  return !res.error;
}

// ---------- Admin ----------

export async function expireChannelToken(
  channelId: string,
  adminId: string
): Promise<boolean> {
  const res = await backendFetch("/api/admin/token/expire", {
    method: "POST",
    body: JSON.stringify({ channelId, adminId }),
  });
  return !res.error;
}

export async function expireAllUserTokens(
  userId: string,
  adminId: string
): Promise<boolean> {
  const res = await backendFetch("/api/admin/token/expire-all", {
    method: "POST",
    body: JSON.stringify({ userId, adminId }),
  });
  return !res.error;
}

export async function permanentRemoveChannel(
  channelId: string,
  adminId: string
): Promise<boolean> {
  const res = await backendFetch("/api/admin/channel/permanent-remove", {
    method: "POST",
    body: JSON.stringify({ channelId, adminId }),
  });
  return !res.error;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  channel_count: number;
  valid_tokens: number;
  created_at: string;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const res = await backendFetch<AdminUser[]>("/api/admin/users");
  return res.data ?? [];
}

// ---------- Exchange Rates ----------

export interface ExchangeRateResponse {
  currency: string;
  date: string;
  rate_to_inr: number;
  source: string;
}

export async function getExchangeRate(
  currency = "USD",
  date?: string
): Promise<number> {
  const params = new URLSearchParams({ currency });
  if (date) params.set("date", date);
  const res = await backendFetch<ExchangeRateResponse>(
    `/api/exchange-rates?${params}`
  );
  return res.data?.rate_to_inr ?? 84.5;
}

// ---------- Sync ----------

export async function triggerChannelSync(channelId: string): Promise<boolean> {
  const res = await backendFetch(`/api/sync/channel/${channelId}/revenue`, {
    method: "POST",
  });
  return !res.error;
}

export async function getSyncStatus(
  channelId: string
): Promise<{ sync_status: string; last_synced_at: string | null } | null> {
  const res = await backendFetch<{
    sync_status: string;
    last_synced_at: string | null;
  }>(`/api/sync/status/${channelId}`);
  return res.data ?? null;
}
