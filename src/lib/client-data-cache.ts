import { kv } from "@/lib/redis";

export interface CachedChannelData {
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  subscribers: number;
  views: number;
  videoCount: number;
  estimatedRevenue: number;
  rpm: number;
  cpm: number;
  lastUpdated: string;
  statsUpdatedAt?: string;
  revenueUpdatedAt?: string;
  revenueSyncedThrough?: string;
}

export interface CachedClientData {
  userId: string;
  email: string;
  channels: CachedChannelData[];
  totalRevenue: number;
  totalViews: number;
  totalSubscribers: number;
  lastUpdated: string;
  lastStatsSync?: string;
  lastRevenueSync?: string;
  source?: string;
}

const CACHE_PREFIX = "client_data_cache:";
const CACHE_BACKUP_PREFIX = "client_data_backup:";
const CACHE_SNAPSHOT_PREFIX = "client_data_snapshot:";
const SNAPSHOT_TTL_SECONDS = 45 * 24 * 60 * 60;

export interface CacheClientDataOptions {
  preserveRevenue?: boolean;
  source?: string;
}

function isKVAvailable(): boolean {
  return true; // Always available — using DigitalOcean Redis
}

function hasPositiveRevenue(data: CachedClientData): boolean {
  return data.channels.some((channel) => channel.estimatedRevenue > 0);
}

function mergeCachedClientData(
  previous: CachedClientData | null,
  incoming: CachedClientData,
  options: CacheClientDataOptions
): CachedClientData {
  const previousChannels = new Map(
    (previous?.channels || []).map((channel) => [channel.channelId, channel])
  );
  const channels = incoming.channels.map((channel) => {
    const previousChannel = previousChannels.get(channel.channelId);
    if (options.preserveRevenue === false || !previousChannel) return channel;
    return {
      ...channel,
      estimatedRevenue: previousChannel.estimatedRevenue,
      rpm: previousChannel.rpm,
      cpm: previousChannel.cpm,
      revenueUpdatedAt: previousChannel.revenueUpdatedAt,
      revenueSyncedThrough: previousChannel.revenueSyncedThrough,
    };
  });

  return {
    ...incoming,
    channels,
    totalRevenue: channels.reduce(
      (total, channel) => total + (channel.estimatedRevenue || 0),
      0
    ),
    totalViews: channels.reduce(
      (total, channel) => total + (channel.views || 0),
      0
    ),
    totalSubscribers: channels.reduce(
      (total, channel) => total + (channel.subscribers || 0),
      0
    ),
    source: options.source || incoming.source,
  };
}

export async function cacheClientData(
  userId: string,
  data: CachedClientData,
  options: CacheClientDataOptions = { preserveRevenue: true }
): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    const currentKey = `${CACHE_PREFIX}${userId}`;
    const previous = await kv.get<CachedClientData>(currentKey);
    const merged = mergeCachedClientData(previous, data, options);

    if (previous) {
      const previousUpdatedAt = Date.parse(previous.lastUpdated);
      const snapshotDate = Number.isFinite(previousUpdatedAt)
        ? new Date(previousUpdatedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      await kv.setex(
        `${CACHE_SNAPSHOT_PREFIX}${userId}:${snapshotDate}`,
        SNAPSHOT_TTL_SECONDS,
        previous
      );
      if (hasPositiveRevenue(previous)) {
        await kv.set(`${CACHE_BACKUP_PREFIX}${userId}`, previous);
      }
    }

    await kv.set(currentKey, merged);
    const backup = await kv.get<CachedClientData>(`${CACHE_BACKUP_PREFIX}${userId}`);
    if (!backup || hasPositiveRevenue(merged)) {
      await kv.set(`${CACHE_BACKUP_PREFIX}${userId}`, merged);
    }
  } catch (error) {
    console.error(`[Cache] Failed to cache data for ${userId}:`, error);
    throw error;
  }
}

export async function getCachedClientDataBackup(userId: string): Promise<CachedClientData | null> {
  if (!isKVAvailable()) return null;
  try {
    return await kv.get<CachedClientData>(`${CACHE_BACKUP_PREFIX}${userId}`);
  } catch (error) {
    console.error(`[Cache] Failed to get backup data for ${userId}:`, error);
    return null;
  }
}

export async function restoreCachedClientDataBackup(
  userId: string,
  allowedChannelIds: string[]
): Promise<CachedClientData | null> {
  const backup = await getCachedClientDataBackup(userId);
  if (!backup) return null;

  const allowedChannels = new Set(allowedChannelIds);
  const channels = (backup.channels || []).filter((channel) =>
    allowedChannels.has(channel.channelId)
  );
  const restored: CachedClientData = {
    ...backup,
    channels,
    totalRevenue: channels.reduce(
      (total, channel) => total + (channel.estimatedRevenue || 0),
      0
    ),
    totalViews: channels.reduce((total, channel) => total + (channel.views || 0), 0),
    totalSubscribers: channels.reduce(
      (total, channel) => total + (channel.subscribers || 0),
      0
    ),
    lastUpdated: new Date().toISOString(),
    source: "backup_restore",
  };
  await kv.set(`${CACHE_PREFIX}${userId}`, restored);
  return restored;
}

export async function getCachedClientData(userId: string): Promise<CachedClientData | null> {
  if (!isKVAvailable()) return null;
  try {
    return await kv.get<CachedClientData>(`${CACHE_PREFIX}${userId}`);
  } catch (error) {
    console.error(`[Cache] Failed to get cached data for ${userId}:`, error);
    return null;
  }
}

interface ChannelListCache {
  channels?: Array<{ channel_id?: string; channelId?: string }>;
}

function cacheKeyContainsChannel(key: string, channelId: string): boolean {
  const channelList = key.slice(key.lastIndexOf(":") + 1);
  return channelList.split(",").includes(channelId);
}

async function removeChannelFromMonthlyCaches(channelId: string): Promise<void> {
  const monthlyKeys = [
    ...(await kv.keys("monthly_channel_analytics:*")),
    ...(await kv.keys("monthly_revenue_export:*")),
  ];

  for (const key of monthlyKeys) {
    const data = await kv.get<ChannelListCache>(key);
    if (!data?.channels?.length) continue;
    const channels = data.channels.filter(
      (channel) => (channel.channel_id || channel.channelId) !== channelId
    );
    if (channels.length !== data.channels.length) {
      await kv.set(key, { ...data, channels });
    }
  }
}

async function removeChannelFromYouTubeCaches(channelId: string): Promise<void> {
  const directKeys = [
    `yt_cache:videos:${channelId}`,
    `yt_cache:stats:${channelId}`,
    `yt_videos:${channelId}`,
    `yt_channel_stats:${channelId}`,
    `yt_dashboard:${channelId}`,
  ];
  await kv.del(...directKeys);

  const dashboardKeys = [
    ...(await kv.keys("yt_cache:dashboard:*")),
    ...(await kv.keys("yt_cache:dashboard-range:*")),
  ].filter((key) => cacheKeyContainsChannel(key, channelId));
  if (dashboardKeys.length > 0) await kv.del(...dashboardKeys);
}

export async function removeChannelFromAllCaches(channelId: string): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    const editableKeys = [
      ...(await kv.keys(`${CACHE_PREFIX}*`)),
      ...(await kv.keys(`${CACHE_BACKUP_PREFIX}*`)),
    ];
    for (const key of editableKeys) {
      const data = await kv.get<CachedClientData>(key);
      if (!data?.channels?.some((channel) => channel.channelId === channelId)) continue;

      const channels = data.channels.filter((channel) => channel.channelId !== channelId);
      await kv.set(key, {
        ...data,
        channels,
        totalRevenue: channels.reduce(
          (total, channel) => total + (channel.estimatedRevenue || 0),
          0
        ),
        totalViews: channels.reduce((total, channel) => total + (channel.views || 0), 0),
        totalSubscribers: channels.reduce(
          (total, channel) => total + (channel.subscribers || 0),
          0
        ),
      });
    }

    const snapshotKeys = await kv.keys(`${CACHE_SNAPSHOT_PREFIX}*`);
    for (const key of snapshotKeys) {
      const data = await kv.get<CachedClientData>(key);
      if (data?.channels?.some((channel) => channel.channelId === channelId)) {
        await kv.del(key);
      }
    }

    await Promise.all([
      removeChannelFromMonthlyCaches(channelId),
      removeChannelFromYouTubeCaches(channelId),
    ]);
  } catch (error) {
    console.error(`[Cache] Failed to remove channel ${channelId} from caches:`, error);
    throw error;
  }
}

export async function getAllCachedClientData(): Promise<CachedClientData[]> {
  if (!isKVAvailable()) return [];
  try {
    const keys = await kv.keys(`${CACHE_PREFIX}*`);
    if (keys.length === 0) return [];
    const results: CachedClientData[] = [];
    for (const key of keys) {
      const data = await kv.get<CachedClientData>(key);
      if (data) results.push(data);
    }
    return results;
  } catch (error) {
    console.error("[Cache] Failed to get all cached data:", error);
    return [];
  }
}

export interface BankDetails {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  upiId: string;
  panNumber: string;
}

const BANK_PREFIX = "bank_details:";

export async function saveBankDetails(userId: string, details: BankDetails): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    await kv.set(`${BANK_PREFIX}${userId}`, details);
  } catch (error) {
    console.error(`[Bank] Failed to save bank details for ${userId}:`, error);
  }
}

export async function getBankDetails(userId: string): Promise<BankDetails | null> {
  if (!isKVAvailable()) return null;
  try {
    return await kv.get<BankDetails>(`${BANK_PREFIX}${userId}`);
  } catch (error) {
    console.error(`[Bank] Failed to get bank details for ${userId}:`, error);
    return null;
  }
}

export interface Agreement {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  uploadedBy: string;
  notes: string;
}

const AGREEMENT_PREFIX = "agreements:";

export async function saveAgreements(userId: string, agreements: Agreement[]): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    await kv.set(`${AGREEMENT_PREFIX}${userId}`, agreements);
  } catch (error) {
    console.error(`[Agreement] Failed to save agreements for ${userId}:`, error);
  }
}

export async function getAgreements(userId: string): Promise<Agreement[]> {
  if (!isKVAvailable()) return [];
  try {
    return await kv.get<Agreement[]>(`${AGREEMENT_PREFIX}${userId}`) || [];
  } catch (error) {
    console.error(`[Agreement] Failed to get agreements for ${userId}:`, error);
    return [];
  }
}

// Warning/Notification System
export interface AdminWarning {
  id: string;
  message: string;
  type: "maintenance" | "warning" | "info";
  createdAt: string;
  createdBy: string;
}

const GLOBAL_WARNING_KEY = "admin_global_warning";
const CLIENT_WARNING_PREFIX = "client_warning:";

export async function setGlobalWarning(warning: AdminWarning | null): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    if (warning) {
      await kv.set(GLOBAL_WARNING_KEY, warning);
    } else {
      await kv.del(GLOBAL_WARNING_KEY);
    }
  } catch (error) {
    console.error("[Warning] Failed to set global warning:", error);
  }
}

export async function getGlobalWarning(): Promise<AdminWarning | null> {
  if (!isKVAvailable()) return null;
  try {
    return await kv.get<AdminWarning>(GLOBAL_WARNING_KEY);
  } catch (error) {
    console.error("[Warning] Failed to get global warning:", error);
    return null;
  }
}

export async function setClientWarning(userId: string, warning: AdminWarning | null): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    if (warning) {
      await kv.set(`${CLIENT_WARNING_PREFIX}${userId}`, warning);
    } else {
      await kv.del(`${CLIENT_WARNING_PREFIX}${userId}`);
    }
  } catch (error) {
    console.error(`[Warning] Failed to set client warning for ${userId}:`, error);
  }
}

export async function getClientWarning(userId: string): Promise<AdminWarning | null> {
  if (!isKVAvailable()) return null;
  try {
    return await kv.get<AdminWarning>(`${CLIENT_WARNING_PREFIX}${userId}`);
  } catch (error) {
    console.error(`[Warning] Failed to get client warning for ${userId}:`, error);
    return null;
  }
}

// Support Request System
export interface SupportRequest {
  id: string;
  clientEmail: string;
  clientName: string;
  message: string;
  screenshot?: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string;
  adminResponse?: string;
}

const SUPPORT_REQUESTS_KEY = "support_requests";

export async function getSupportRequests(): Promise<SupportRequest[]> {
  if (!isKVAvailable()) return [];
  try {
    return await kv.get<SupportRequest[]>(SUPPORT_REQUESTS_KEY) || [];
  } catch (error) {
    console.error("[Support] Failed to get support requests:", error);
    return [];
  }
}

export async function addSupportRequest(request: SupportRequest): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    const existing = await getSupportRequests();
    existing.unshift(request);
    // Keep last 100 requests
    await kv.set(SUPPORT_REQUESTS_KEY, existing.slice(0, 100));
  } catch (error) {
    console.error("[Support] Failed to add support request:", error);
  }
}

export async function resolveSupportRequest(requestId: string, adminResponse?: string): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    const existing = await getSupportRequests();
    const updated = existing.map((r) =>
      r.id === requestId
        ? { ...r, status: "resolved" as const, resolvedAt: new Date().toISOString(), adminResponse: adminResponse || "" }
        : r
    );
    await kv.set(SUPPORT_REQUESTS_KEY, updated);
  } catch (error) {
    console.error("[Support] Failed to resolve support request:", error);
  }
}

// ===== Admin Settings =====
const ADMIN_SETTINGS_KEY = "admin_settings";

export interface AdminSettings {
  requireUserApproval: boolean; // if true, new users need admin approval; if false, auto-active
}

const DEFAULT_SETTINGS: AdminSettings = {
  requireUserApproval: true, // default: approval required
};

export async function getAdminSettings(): Promise<AdminSettings> {
  if (!isKVAvailable()) return DEFAULT_SETTINGS;
  try {
    const data = await kv.get<AdminSettings>(ADMIN_SETTINGS_KEY);
    return data || DEFAULT_SETTINGS;
  } catch (error) {
    console.error("[Settings] Failed to get admin settings:", error);
    return DEFAULT_SETTINGS;
  }
}

export async function setAdminSettings(settings: AdminSettings): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    await kv.set(ADMIN_SETTINGS_KEY, settings);
  } catch (error) {
    console.error("[Settings] Failed to save admin settings:", error);
  }
}
