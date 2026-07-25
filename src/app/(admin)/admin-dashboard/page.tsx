"use client";

import { Fragment, useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Radio,
  DollarSign,
  Eye,
  TrendingUp,
  TrendingDown,
  Shield,
  UserPlus,
  Activity,
  Search,
  Filter,
  Loader2,
  Crown,
  BarChart3,
  Video,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  Calendar,
  Pencil,
  Power,
  Trash2,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { useYouTubeData } from "@/lib/hooks/useYouTubeData";
import DateRangeFilter, { computeRange } from "@/components/dashboard/DateRangeFilter";
import type { DateRange } from "@/components/dashboard/DateRangeFilter";
import { useExchangeRate } from "@/lib/hooks/useExchangeRate";

interface ClientUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  channels: string[];
  status: "active" | "inactive";
  joinedDate: string;
  category: string;
  role?: "client" | "company";
  parentId?: string;
  revenueSharePercent?: number;
}

interface ChannelInfo {
  id: string;
  title: string;
  thumbnailUrl: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  customUrl: string;
  clientName: string;
  clientEmail: string;
}

interface AnalyticsResponse {
  columnHeaders?: Array<{ name?: string | null }>;
  rows?: Array<Array<string | number>>;
}

interface ChannelItem {
  id?: string | null;
  snippet?: {
    title?: string | null;
    thumbnails?: { default?: { url?: string | null } | null } | null;
  };
  statistics?: {
    viewCount?: string | null;
    subscriberCount?: string | null;
    videoCount?: string | null;
  };
}

interface PerChannelAnalytics {
  performance: AnalyticsResponse | null;
  prevPerformance: AnalyticsResponse | null;
  revenue: AnalyticsResponse | null;
  prevRevenue: AnalyticsResponse | null;
  dailyRevenue: AnalyticsResponse | null;
  revenueViews: AnalyticsResponse | null;
}

interface DashboardFullData {
  channels?: ChannelItem[];
  currentRevenue?: AnalyticsResponse | null;
  prevRevenue?: AnalyticsResponse | null;
  currentPerformance?: AnalyticsResponse | null;
  prevPerformance?: AnalyticsResponse | null;
  dailyRevenue?: AnalyticsResponse | null;
  perChannelAnalytics?: Record<string, PerChannelAnalytics>;
  channelRevenueMap?: Record<string, { revenue: number; views: number; rpm: number }>;
  tokenizedChannels?: string[];
  _debug?: {
    totalChannelIds: number;
    tokenizedCount: number;
    channelTokenErrors: Record<string, string>;
    perChannelErrors: Record<string, string>;
    hasAdminToken: boolean;
  };
}

interface Payment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  month: string;
  totalAmount: number;
  revenueSharePercent: number;
  netTotal: number;
  paidAmount: number;
  status: "pending" | "paid" | "partial";
}

interface AccountSummary {
  channelIds: string[];
  revenue: number;
  netPayment: number;
  paidAmount: number;
}

function sumMetric(data: AnalyticsResponse | undefined | null, metricName: string): number {
  if (!data?.rows?.length || !data.columnHeaders) return 0;
  const headers = data.columnHeaders.map((h) => h.name || "");
  const idx = headers.indexOf(metricName);
  if (idx === -1) return 0;
  return data.rows.reduce((sum, row) => sum + (Number(row[idx]) || 0), 0);
}

function getDailyRevenueChartData(data: AnalyticsResponse | null | undefined) {
  if (!data?.rows?.length || !data.columnHeaders) return [];
  const headers = data.columnHeaders.map((h) => h.name || "");
  const dayIdx = headers.indexOf("day");
  const revIdx = headers.indexOf("estimatedRevenue");
  if (dayIdx === -1 || revIdx === -1) return [];
  return data.rows.map((row) => ({
    date: String(row[dayIdx]).slice(5),
    fullDate: String(row[dayIdx]),
    revenue: Math.round((Number(row[revIdx]) || 0) * 100) / 100,
  }));
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"channels" | "name" | "status">("channels");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState("28d");
  const [dateRange, setDateRange] = useState<DateRange>(() => computeRange("28d"));
  const [tokenStatuses, setTokenStatuses] = useState<Record<string, { status: string; channelTitle?: string; updatedAt?: string }>>({});
  const [dailyRevDays, setDailyRevDays] = useState<1 | 3 | 7 | 30 | "all" | string>(7);
  const [tokenFilter, setTokenFilter] = useState<"all" | "valid" | "invalid" | null>(null);
  const [quickView, setQuickView] = useState<"users" | "channels" | null>(null);
  const [expandedQuickViewUser, setExpandedQuickViewUser] = useState<string | null>(null);
  const [expandedTopClient, setExpandedTopClient] = useState<string | null>(null);
  const [companyActionId, setCompanyActionId] = useState<string | null>(null);
  const [companyActionError, setCompanyActionError] = useState<string | null>(null);
  const { rate: INR_RATE } = useExchangeRate("USD");

  // Cached client data from KV (auto-saved when clients load their dashboards)
  interface CachedChannelData {
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
  }
  interface CachedClientData {
    userId: string;
    email: string;
    channels: CachedChannelData[];
    totalRevenue: number;
    totalViews: number;
    totalSubscribers: number;
    lastUpdated: string;
  }
  const [cachedClientData, setCachedClientData] = useState<CachedClientData[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Realtime 48-hour state
  const [realtime48, setRealtime48] = useState<{
    views: number; subscribers: number; watchTime: number; revenue: number;
    dailyBreakdown: Array<{ date: string; views: number; subscribers: number; watchTime: number; revenue: number }>;
  } | null>(null);
  const [realtime48Loading, setRealtime48Loading] = useState(false);
  const [realtimeEnabled, setRealtimeEnabled] = useState<boolean | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<string>("all");
  const [realtimeUserSettings, setRealtimeUserSettings] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await fetch("/api/users");
      if (res.ok) {
        const json = await res.json();
        setClients(json.data || []);
      } else {
        const json = await res.json().catch(() => ({}));
        if (json.kvError) {
          setFetchError(`Storage error: ${json.details || "Unable to read user data from KV"}. Please check Vercel KV connection.`);
        } else if (res.status === 401) {
          setFetchError("Unauthorized — please re-login as admin.");
        } else {
          setFetchError(`Failed to load users (HTTP ${res.status})`);
        }
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error);
      setFetchError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the durable server snapshot immediately. Scheduled jobs refresh it separately.
  const fetchCachedData = useCallback(async () => {
    try {
      const [res, paymentsRes] = await Promise.all([
        fetch("/api/client-data?action=getAllCachedData"),
        fetch("/api/payments"),
      ]);
      if (res.ok) {
        const json = await res.json();
        setCachedClientData(json.data || []);
      }
      if (paymentsRes.ok) {
        const json = await paymentsRes.json();
        setPayments(json.data || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "admin") {
      queueMicrotask(() => {
        fetchClients();
        fetchCachedData();
      });
    }
  }, [status, session, fetchClients, fetchCachedData]);

  // Collect all channel IDs from clients + cached data (to handle test IDs in KV)
  const allChannelIds = useMemo(() => {
    const kvIds = clients.reduce<string[]>((acc, c) => [...acc, ...c.channels], []);
    const cachedIds = cachedClientData.flatMap((cd) => cd.channels.map((ch) => ch.channelId));
    const allSet = new Set([...kvIds, ...cachedIds]);
    // Prefer real IDs over test IDs
    const realIds = Array.from(allSet).filter((id) => !id.startsWith("UCtest") && id !== "test");
    return realIds.length > 0 ? realIds : Array.from(allSet);
  }, [clients, cachedClientData]);

  // Fetch token statuses for all channels
  useEffect(() => {
    if (allChannelIds.length === 0) return;
    const fetchTokenStatuses = async () => {
      try {
        const res = await fetch(`/api/channel-tokens?action=bulkTokenStatus&channelIds=${allChannelIds.join(",")}`);
        if (res.ok) {
          const json = await res.json();
          setTokenStatuses(json.data?.statuses || {});
        }
      } catch { /* silent */ }
    };
    fetchTokenStatuses();
  }, [allChannelIds]);

  const ytApiParams = useMemo(() => ({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    prevStartDate: dateRange.prevStartDate,
    prevEndDate: dateRange.prevEndDate,
    cacheOnly: "true",
    ...(allChannelIds.length > 0 ? { channelIds: allChannelIds.join(",") } : {}),
  }), [dateRange, allChannelIds]);

  const { data: dashData, loading: ytLoading, cached: dashCached, lastUpdated: dashLastUpdated } = useYouTubeData<DashboardFullData>(
    "dashboardFull",
    ytApiParams,
    {}
  );

  // Fetch realtime 48h data for admin
  useEffect(() => {
    queueMicrotask(() => {
      if (realtimeEnabled !== true || allChannelIds.length === 0) {
        setRealtime48(null);
        return;
      }
      const ids = realtimeChannel === "all" ? allChannelIds : [realtimeChannel];
      setRealtime48Loading(true);
      fetch(`/api/youtube?action=realtime48&channelIds=${ids.join(",")}`)
        .then(res => res.json())
        .then(data => { if (data.data && !data.data.disabled) setRealtime48(data.data); })
        .catch(() => {})
        .finally(() => setRealtime48Loading(false));
    });
  }, [realtimeEnabled, realtimeChannel, allChannelIds]);

  // Fetch realtime user settings (admin control)
  useEffect(() => {
    const adminEmail = session?.user?.email?.toLowerCase();
    if (!adminEmail) return;

    fetch("/api/admin-settings?setting=realtime")
      .then(res => res.json())
      .then(data => {
        const settings = data.data || {};
        setRealtimeUserSettings(settings);
        setRealtimeEnabled(settings[adminEmail] ?? true);
      })
      .catch(() => setRealtimeEnabled(false));
  }, [session?.user?.email]);

  const toggleAdminRealtime = async (enabled: boolean) => {
    const adminEmail = session?.user?.email?.toLowerCase();
    if (!adminEmail || realtimeEnabled === null) return;

    const previous = realtimeEnabled;
    setRealtimeEnabled(enabled);
    try {
      const res = await fetch("/api/admin-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting: "realtime", email: adminEmail, enabled }),
      });
      if (!res.ok) throw new Error("Failed to save realtime setting");
      const data = await res.json();
      setRealtimeUserSettings(data.data || {});
    } catch {
      setRealtimeEnabled(previous);
    }
  };

  const toggleUserRealtime = async (email: string, enabled: boolean) => {
    try {
      const res = await fetch("/api/admin-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting: "realtime", email, enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setRealtimeUserSettings(data.data || {});
      }
    } catch { /* silent */ }
  };

  // Aggregate cached client data totals
  const cachedTotals = useMemo(() => {
    let totalRevenue = 0;
    let totalViews = 0;
    let totalSubscribers = 0;
    for (const cd of cachedClientData) {
      totalRevenue += cd.totalRevenue || 0;
      totalViews += cd.totalViews || 0;
      totalSubscribers += cd.totalSubscribers || 0;
    }
    return { totalRevenue, totalViews, totalSubscribers };
  }, [cachedClientData]);

  // Build cached channel map for quick lookup
  const cachedChannelMap = useMemo(() => {
    const map: Record<string, CachedChannelData> = {};
    for (const cd of cachedClientData) {
      for (const ch of cd.channels) {
        map[ch.channelId] = ch;
      }
    }
    return map;
  }, [cachedClientData]);

  const channelMetricsMap = useMemo(() => {
    const map: Record<string, { revenue: number; views: number; subscribers: number }> = {};
    const channelRevenueMap = dashData?.channelRevenueMap || {};

    for (const channelId of allChannelIds) {
      const live = channelRevenueMap[channelId];
      const cached = cachedChannelMap[channelId];

      map[channelId] = {
        revenue: live?.revenue || cached?.estimatedRevenue || 0,
        views: live?.views || cached?.views || 0,
        subscribers: cached?.subscribers || 0,
      };
    }

    return map;
  }, [allChannelIds, cachedChannelMap, dashData?.channelRevenueMap]);

  const channelOwnerMap = useMemo(() => {
    const map: Record<string, ClientUser> = {};
    for (const client of clients) {
      for (const channelId of client.channels || []) {
        if (!map[channelId]) map[channelId] = client;
      }
    }
    return map;
  }, [clients]);

  const accountSummaryMap = useMemo(() => {
    const childrenByParent = new Map<string, ClientUser[]>();
    for (const client of clients) {
      if (!client.parentId) continue;
      const children = childrenByParent.get(client.parentId) || [];
      children.push(client);
      childrenByParent.set(client.parentId, children);
    }

    const paymentsByUser = new Map<string, { netPayment: number; paidAmount: number }>();
    for (const payment of payments) {
      const totals = paymentsByUser.get(payment.userId) || { netPayment: 0, paidAmount: 0 };
      totals.netPayment += payment.netTotal || 0;
      totals.paidAmount += payment.paidAmount || 0;
      paymentsByUser.set(payment.userId, totals);
    }

    const map: Record<string, AccountSummary> = {};
    for (const client of clients) {
      const scopedUsers = client.role === "company"
        ? [client, ...(childrenByParent.get(client.id) || [])]
        : [client];
      const channelIds = Array.from(
        new Set(scopedUsers.flatMap((scopedUser) => scopedUser.channels || []))
      );
      let netPayment = 0;
      let paidAmount = 0;
      for (const scopedUser of scopedUsers) {
        const paymentTotals = paymentsByUser.get(scopedUser.id);
        netPayment += paymentTotals?.netPayment || 0;
        paidAmount += paymentTotals?.paidAmount || 0;
      }

      map[client.id] = {
        channelIds,
        revenue: channelIds.reduce(
          (total, channelId) => total + (channelMetricsMap[channelId]?.revenue || 0),
          0
        ),
        netPayment,
        paidAmount,
      };
    }

    return map;
  }, [channelMetricsMap, clients, payments]);

  // Aggregate YouTube analytics data (with cached data fallback)
  const ytStats = useMemo(() => {
    const perChannelAnalytics = dashData?.perChannelAnalytics || {};
    const perChannelEntries = Object.values(perChannelAnalytics);

    let curEstRevenue = sumMetric(dashData?.currentRevenue, "estimatedRevenue");
    let curAdRevenue = sumMetric(dashData?.currentRevenue, "estimatedAdRevenue");
    let curGrossRevenue = sumMetric(dashData?.currentRevenue, "grossRevenue");
    let prevEstRevenue = sumMetric(dashData?.prevRevenue, "estimatedRevenue");

    let curViews = sumMetric(dashData?.currentPerformance, "views");
    let prevViews = sumMetric(dashData?.prevPerformance, "views");
    let curSubs = sumMetric(dashData?.currentPerformance, "subscribersGained") - sumMetric(dashData?.currentPerformance, "subscribersLost");
    let prevSubs = sumMetric(dashData?.prevPerformance, "subscribersGained") - sumMetric(dashData?.prevPerformance, "subscribersLost");

    for (const pca of perChannelEntries) {
      // Prefer revenueViews (flat total) for estimatedRevenue — most accurate for any date range
      const curRevFromViews = sumMetric(pca.revenueViews, "estimatedRevenue");
      curEstRevenue += curRevFromViews || sumMetric(pca.revenue, "estimatedRevenue");
      curAdRevenue += sumMetric(pca.revenue, "estimatedAdRevenue");
      curGrossRevenue += sumMetric(pca.revenue, "grossRevenue");
      prevEstRevenue += sumMetric(pca.prevRevenue, "estimatedRevenue");
      curViews += sumMetric(pca.performance, "views");
      prevViews += sumMetric(pca.prevPerformance, "views");
      curSubs += sumMetric(pca.performance, "subscribersGained") - sumMetric(pca.performance, "subscribersLost");
      prevSubs += sumMetric(pca.prevPerformance, "subscribersGained") - sumMetric(pca.prevPerformance, "subscribersLost");
    }

    // Use cached data as fallback when YouTube API returns 0
    const useCachedRevenue = curEstRevenue === 0 && cachedTotals.totalRevenue > 0;
    if (useCachedRevenue) curEstRevenue = cachedTotals.totalRevenue;

    const curCPM = curViews > 0 ? (curEstRevenue / curViews) * 1000 : 0;
    const prevCPM = prevViews > 0 ? (prevEstRevenue / prevViews) * 1000 : 0;
    const curRPM = curViews > 0 ? (curEstRevenue / curViews) * 1000 : 0;
    const prevRPM = prevViews > 0 ? (prevEstRevenue / prevViews) * 1000 : 0;

    let totalSubscribers = (dashData?.channels || []).reduce((sum, ch) => sum + Number(ch?.statistics?.subscriberCount || 0), 0);
    let totalViewsAll = (dashData?.channels || []).reduce((sum, ch) => sum + Number(ch?.statistics?.viewCount || 0), 0);

    // Use cached totals as fallback
    if (totalSubscribers === 0 && cachedTotals.totalSubscribers > 0) totalSubscribers = cachedTotals.totalSubscribers;
    if (totalViewsAll === 0 && cachedTotals.totalViews > 0) totalViewsAll = cachedTotals.totalViews;

    return {
      curEstRevenue, prevEstRevenue,
      curViews, prevViews,
      curSubs, prevSubs,
      curCPM, prevCPM,
      curRPM, prevRPM,
      totalSubscribers, totalViewsAll,
      usedCachedData: useCachedRevenue || (totalSubscribers > 0 && cachedTotals.totalSubscribers > 0),
    };
  }, [dashData, cachedTotals]);

  // Per-Channel Daily Revenue table data
  const perChannelDailyRevenue = useMemo(() => {
    const perChannel = dashData?.perChannelAnalytics || {};
    const channelList = dashData?.channels || [];
    const channelNameMap: Record<string, string> = {};
    for (const ch of channelList) {
      if (ch.id) channelNameMap[ch.id] = ch.snippet?.title || ch.id;
    }

    const result: { channelId: string; channelName: string; clientName: string; dailyMap: Record<string, number>; monthTotal: number }[] = [];
    const allFullDates = new Set<string>();

    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    for (const [cid, pca] of Object.entries(perChannel)) {
      const daily = getDailyRevenueChartData(pca.dailyRevenue);
      const dailyMap: Record<string, number> = {};
      let monthTotal = 0;
      for (const d of daily) {
        const key = d.fullDate || d.date;
        dailyMap[key] = d.revenue;
        allFullDates.add(key);
        if (d.fullDate && d.fullDate.startsWith(currentMonthPrefix)) {
          monthTotal += d.revenue;
        }
      }
      const client = clients.find((c) => c.channels.includes(cid));
      result.push({
        channelId: cid,
        channelName: channelNameMap[cid] || cid,
        clientName: client?.name || "-",
        dailyMap,
        monthTotal,
      });
    }

    const sortedDates = Array.from(allFullDates).sort((a, b) => b.localeCompare(a));
    let filteredDates: string[];
    if (typeof dailyRevDays === "string" && dailyRevDays.match(/^\d{4}-\d{2}$/)) {
      // Month filter like "2026-05"
      filteredDates = sortedDates.filter((d) => d.startsWith(dailyRevDays as string));
    } else if (dailyRevDays === 30) {
      filteredDates = sortedDates.filter((d) => d.startsWith(currentMonthPrefix));
    } else if (dailyRevDays === "all") {
      filteredDates = sortedDates;
    } else {
      filteredDates = sortedDates.slice(0, typeof dailyRevDays === "number" ? dailyRevDays : 7);
    }

    const currentMonthName = now.toLocaleString("en-US", { month: "short", year: "numeric" });

    return { channels: result, dates: filteredDates, currentMonthName };
  }, [dashData, dailyRevDays, clients]);

  const stats = useMemo(() => {
    const totalClients = clients.length;
    const totalCompanies = clients.filter((c) => c.role === "company").length;
    const activeClients = clients.filter((c) => c.status === "active").length;
    const inactiveClients = clients.filter((c) => c.status === "inactive").length;
    const totalChannels = new Set(clients.flatMap((client) => client.channels || [])).size;
    const avgChannelsPerClient = totalClients > 0 ? totalChannels / totalClients : 0;
    const clientsWithChannels = clients.filter(
      (client) => (accountSummaryMap[client.id]?.channelIds.length || 0) > 0
    ).length;
    const clientsWithoutChannels = clients.filter(
      (client) => (accountSummaryMap[client.id]?.channelIds.length || 0) === 0
    ).length;
    const categories = clients.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    // Token counts
    const validTokens = allChannelIds.filter((id) => tokenStatuses[id]?.status === "valid").length;
    const invalidTokens = allChannelIds.length - validTokens;
    return {
      totalClients,
      totalCompanies,
      activeClients,
      inactiveClients,
      totalChannels,
      avgChannelsPerClient,
      clientsWithChannels,
      clientsWithoutChannels,
      categories,
      validTokens,
      invalidTokens,
    };
  }, [accountSummaryMap, clients, allChannelIds, tokenStatuses]);

  const filteredTokenChannelIds = useMemo(() => {
    if (!tokenFilter) return [];
    if (tokenFilter === "all") return allChannelIds;
    return allChannelIds.filter((channelId) =>
      tokenFilter === "valid"
        ? tokenStatuses[channelId]?.status === "valid"
        : tokenStatuses[channelId]?.status !== "valid"
    );
  }, [allChannelIds, tokenFilter, tokenStatuses]);

  const filteredClients = useMemo(() => {
    let result = [...clients];

    if (clientFilter === "companies") {
      result = result.filter((c) => c.role === "company");
    } else if (clientFilter === "active") {
      result = result.filter((c) => c.status === "active");
    } else if (clientFilter === "inactive") {
      result = result.filter((c) => c.status === "inactive");
    } else if (clientFilter === "with-channels") {
      result = result.filter((c) => (accountSummaryMap[c.id]?.channelIds.length || 0) > 0);
    } else if (clientFilter === "without-channels") {
      result = result.filter((c) => (accountSummaryMap[c.id]?.channelIds.length || 0) === 0);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (accountSummaryMap[c.id]?.channelIds || []).some((ch) => ch.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "channels") cmp = (accountSummaryMap[a.id]?.channelIds.length || 0) - (accountSummaryMap[b.id]?.channelIds.length || 0);
      else if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [accountSummaryMap, clients, clientFilter, searchQuery, sortBy, sortDir]);

  const topClientsByChannels = useMemo(() => {
    return [...clients]
      .sort(
        (a, b) =>
          (accountSummaryMap[b.id]?.channelIds.length || 0) -
          (accountSummaryMap[a.id]?.channelIds.length || 0)
      )
      .slice(0, 5);
  }, [accountSummaryMap, clients]);

  const categoryBreakdown = useMemo(() => {
    return Object.entries(stats.categories)
      .sort(([, a], [, b]) => b - a);
  }, [stats.categories]);

  const showUsers = (filter: string) => {
    setClientFilter(filter);
    setTokenFilter(null);
    setExpandedQuickViewUser(null);
    setQuickView("users");
  };

  const showTokenChannels = (filter: "all" | "valid" | "invalid") => {
    setTokenFilter(filter);
    setExpandedQuickViewUser(null);
    setQuickView("channels");
  };

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const updateCompanyStatus = async (company: ClientUser) => {
    setCompanyActionId(company.id);
    setCompanyActionError(null);
    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: company.id,
          status: company.status === "active" ? "inactive" : "active",
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to update company status");
      setClients((current) =>
        current.map((item) =>
          item.id === company.id
            ? { ...item, status: company.status === "active" ? "inactive" : "active" }
            : item
        )
      );
    } catch (error) {
      setCompanyActionError(error instanceof Error ? error.message : "Failed to update company status");
    } finally {
      setCompanyActionId(null);
    }
  };

  const deleteCompany = async (company: ClientUser) => {
    if (!window.confirm(`Delete company account "${company.name}"?`)) return;
    setCompanyActionId(company.id);
    setCompanyActionError(null);
    try {
      const response = await fetch(`/api/users?id=${encodeURIComponent(company.id)}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to delete company");
      setClients((current) => current.filter((item) => item.id !== company.id));
      setExpandedClient(null);
    } catch (error) {
      setCompanyActionError(error instanceof Error ? error.message : "Failed to delete company");
    } finally {
      setCompanyActionId(null);
    }
  };

  const quickViewTitle = quickView === "channels"
    ? tokenFilter === "valid"
      ? "Valid Token Channels"
      : tokenFilter === "invalid"
        ? "Invalid Token Channels"
        : "All Channels"
    : clientFilter === "companies"
      ? "Companies"
      : clientFilter === "active"
        ? "Active Users"
        : clientFilter === "inactive"
          ? "Inactive Users"
          : clientFilter === "with-channels"
            ? "Users with Channels"
            : "Total Users";

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted">Loading dashboard...</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-4 py-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-2xl mx-auto">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-red-900">Dashboard Data Error</h2>
              <p className="text-sm text-red-700 mt-1">{fetchError}</p>
              <button
                onClick={() => fetchClients()}
                className="mt-4 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Shield className="w-4 h-4 text-red-500" />
        <span className="text-red-500 font-medium">Admin Panel</span>
        <span>›</span>
        <span className="text-foreground font-medium">Dashboard</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted mt-1">Overview of all clients, channels, and system metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setSyncing(true);
              try {
                await fetch("/api/sync-client-data?mode=stats");
                const res = await fetch("/api/client-data?action=getAllCachedData");
                if (res.ok) {
                  const json = await res.json();
                  if (json.data?.length) setCachedClientData(json.data);
                }
              } catch { /* silent */ }
              finally { setSyncing(false); }
            }}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Refreshing..." : "Refresh Cached Stats"}
          </button>
          <button
            onClick={fetchClients}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {dashCached && dashLastUpdated && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Showing cached data — Last updated: {new Date(dashLastUpdated).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
      )}

      {/* Syncing indicator */}
      {syncing && cachedClientData.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-yellow-600" />
          <p className="text-sm text-yellow-700">
            <strong>Syncing YouTube data for all clients...</strong> This may take a minute on first load.
          </p>
        </div>
      )}

      {/* Cached Data Info */}
      {cachedClientData.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-blue-700">
            Cached data from <strong>{cachedClientData.length}</strong> client(s) — 
            Last synced: {(() => {
              const latest = cachedClientData.reduce((a, b) => 
                new Date(a.lastUpdated) > new Date(b.lastUpdated) ? a : b
              );
              return new Date(latest.lastUpdated).toLocaleString("en-IN");
            })()}
          </p>
          <p className="text-xs text-blue-500">
            Revenue: ${cachedClientData.reduce((s, c) => s + (c.totalRevenue || 0), 0).toFixed(2)} | 
            Subs: {cachedClientData.reduce((s, c) => s + (c.totalSubscribers || 0), 0).toLocaleString()}
          </p>
        </div>
      )}

      {/* Stats Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <button onClick={() => showUsers("all")} className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted">Total Users</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalClients}</p>
            </div>
          </div>
        </button>

        <button onClick={() => showUsers("companies")} className="bg-white rounded-xl border border-emerald-200 p-5 hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Crown className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted">Companies</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.totalCompanies}</p>
            </div>
          </div>
        </button>

        <button onClick={() => showUsers("active")} className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted">Active Users</p>
              <p className="text-2xl font-bold text-foreground">{stats.activeClients}</p>
            </div>
          </div>
        </button>

        <button onClick={() => showTokenChannels("all")} className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Radio className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted">Total Channels</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalChannels}</p>
            </div>
          </div>
        </button>

        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted">Avg Channels/User</p>
              <p className="text-2xl font-bold text-foreground">{stats.avgChannelsPerClient.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards Row 2 — Token Status & More */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => showTokenChannels("valid")} className="bg-white rounded-xl border border-green-200 p-5 hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted">Valid Token Channels</p>
              <p className="text-2xl font-bold text-green-700">{stats.validTokens}</p>
              <p className="text-[10px] text-green-600 mt-0.5">Click to view →</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => showTokenChannels("invalid")}
          className="bg-white rounded-xl border border-red-200 p-5 hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted">Invalid Token Channels</p>
              <p className="text-2xl font-bold text-red-700">{stats.invalidTokens}</p>
              <p className="text-[10px] text-red-500 mt-0.5">Click to view &amp; validate →</p>
            </div>
          </div>
        </button>

        <button onClick={() => showUsers("with-channels")} className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
              <Radio className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm text-muted">Users with Channels</p>
              <p className="text-2xl font-bold text-foreground">{stats.clientsWithChannels}</p>
            </div>
          </div>
        </button>

        <button onClick={() => showUsers("inactive")} className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted">Inactive Users</p>
              <p className="text-2xl font-bold text-foreground">{stats.inactiveClients}</p>
            </div>
          </div>
        </button>
      </div>

      {quickView && (
        <section className="rounded-xl border border-primary/20 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Quick View</p>
              <h2 className="text-lg font-bold text-foreground">{quickViewTitle}</h2>
            </div>
            <div className="flex items-center gap-2">
              {quickView === "users" && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search users"
                    className="w-48 rounded-lg border border-border py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary"
                  />
                </div>
              )}
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {quickView === "users" ? filteredClients.length : filteredTokenChannelIds.length}
              </span>
              <button
                onClick={() => {
                  setQuickView(null);
                  setExpandedQuickViewUser(null);
                }}
                className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-foreground"
                title="Close quick view"
                aria-label="Close quick view"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[32rem] overflow-y-auto">
            {quickView === "users" ? (
              filteredClients.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted">No matching users found</p>
              ) : (
                filteredClients.map((client) => {
                  const summary = accountSummaryMap[client.id] || {
                    channelIds: [],
                    revenue: 0,
                    netPayment: 0,
                    paidAmount: 0,
                  };
                  const expanded = expandedQuickViewUser === client.id;
                  return (
                    <div key={client.id} className="border-b border-border/50 last:border-b-0">
                      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">{client.name}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${client.role === "company" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                              {client.role === "company" ? "Company" : "Client"}
                            </span>
                          </div>
                          <p className="truncate text-xs text-muted">{client.email}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-4 text-xs">
                          <button
                            onClick={() => setExpandedQuickViewUser(expanded ? null : client.id)}
                            disabled={summary.channelIds.length === 0}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-purple-600 hover:bg-purple-50 disabled:cursor-default disabled:opacity-60"
                            title={summary.channelIds.length > 0 ? "View channel revenue" : "No channels assigned"}
                          >
                            {summary.channelIds.length} channels
                            {summary.channelIds.length > 0 && (expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
                          </button>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{formatCurrency(summary.revenue)}</p>
                            <p className="text-[10px] text-muted">Revenue</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-amber-600">₹{formatNumber(Math.round(summary.revenue * INR_RATE))}</p>
                            <p className="text-[10px] text-muted">Revenue INR</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 font-medium ${client.status === "active" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                            {client.status}
                          </span>
                          <button
                            onClick={() => router.push(`/admin-clients?edit=${encodeURIComponent(client.id)}`)}
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                            title="Edit user"
                            aria-label={`Edit ${client.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="grid grid-cols-1 gap-2 bg-slate-50/70 px-4 py-3 md:grid-cols-2">
                          {summary.channelIds.map((channelId) => {
                            const cached = cachedChannelMap[channelId];
                            const metrics = channelMetricsMap[channelId];
                            const owner = channelOwnerMap[channelId];
                            const valid = tokenStatuses[channelId]?.status === "valid";
                            return (
                              <div key={channelId} className="rounded-lg border border-border bg-white p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                      {tokenStatuses[channelId]?.channelTitle || cached?.channelTitle || channelId}
                                    </p>
                                    <p className="truncate font-mono text-[10px] text-muted">{channelId}</p>
                                    {client.role === "company" && owner && (
                                      <p className="mt-1 truncate text-[10px] text-blue-600">Client: {owner.name}</p>
                                    )}
                                  </div>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${valid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                    {valid ? "Valid" : "Invalid"}
                                  </span>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs">
                                  <span className="text-muted">{formatNumber(metrics?.views || 0)} views</span>
                                  <div className="text-right">
                                    <p className="font-bold text-green-600">{formatCurrency(metrics?.revenue || 0)}</p>
                                    <p className="text-[10px] text-amber-600">₹{formatNumber(Math.round((metrics?.revenue || 0) * INR_RATE))}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )
            ) : filteredTokenChannelIds.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">No matching channels found</p>
            ) : (
              filteredTokenChannelIds.map((channelId) => {
                const tokenStatus = tokenStatuses[channelId]?.status;
                const valid = tokenStatus === "valid";
                const metrics = channelMetricsMap[channelId];
                const owner = channelOwnerMap[channelId];
                return (
                  <div key={channelId} className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 px-4 py-3 last:border-b-0 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {tokenStatuses[channelId]?.channelTitle || cachedChannelMap[channelId]?.channelTitle || channelId}
                      </p>
                      <p className="truncate font-mono text-xs text-muted">{channelId}</p>
                      {owner && <p className="truncate text-[10px] text-blue-600">{owner.name} · {owner.email}</p>}
                    </div>
                    <div className="flex items-center gap-5 text-xs">
                      <div className="text-right">
                        <p className="font-bold text-green-600">{formatCurrency(metrics?.revenue || 0)}</p>
                        <p className="text-[10px] text-muted">Revenue</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-amber-600">₹{formatNumber(Math.round((metrics?.revenue || 0) * INR_RATE))}</p>
                        <p className="text-[10px] text-muted">INR</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 font-semibold ${valid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {valid ? "Valid" : "Invalid"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* ===== REALTIME 48 HOURS (Admin) ===== */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h3 className="text-sm font-bold text-purple-800">Last 48 Hours (Realtime)</h3>
            {realtime48Loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={realtimeChannel}
              onChange={(e) => setRealtimeChannel(e.target.value)}
              disabled={realtimeEnabled !== true}
              className="text-xs border border-purple-200 rounded-lg px-2 py-1 bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="all">All Channels</option>
              {allChannelIds.map(id => {
                const cached = cachedChannelMap[id];
                return <option key={id} value={id}>{cached?.channelTitle || id}</option>;
              })}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-purple-700 cursor-pointer">
              <input
                type="checkbox"
                checked={realtimeEnabled === true}
                disabled={realtimeEnabled === null}
                onChange={(e) => void toggleAdminRealtime(e.target.checked)}
                className="rounded border-purple-300 disabled:cursor-wait"
              />
              {realtimeEnabled === null ? "Loading..." : "Enabled"}
            </label>
          </div>
        </div>
        {realtimeEnabled === true && realtime48 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <p className="text-xs text-muted mb-1">Views</p>
                <p className="text-lg font-bold text-foreground">{formatNumber(realtime48.views)}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <p className="text-xs text-muted mb-1">Subscribers</p>
                <p className="text-lg font-bold text-foreground">+{formatNumber(realtime48.subscribers)}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <p className="text-xs text-muted mb-1">Watch Time (hrs)</p>
                <p className="text-lg font-bold text-foreground">{formatNumber(Math.round(realtime48.watchTime / 60))}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <p className="text-xs text-muted mb-1">Revenue (Est.)</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(realtime48.revenue)}</p>
                {INR_RATE > 0 && <p className="text-xs text-muted">≈ ₹{(realtime48.revenue * INR_RATE).toFixed(0)}</p>}
              </div>
            </div>
            {realtime48.dailyBreakdown.length > 0 && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                {realtime48.dailyBreakdown.map(d => (
                  <div key={d.date} className="flex items-center justify-between px-3 py-1.5 bg-white/70 rounded border border-purple-50 text-xs">
                    <span className="font-medium text-purple-700">{d.date}</span>
                    <span className="text-muted">{formatNumber(d.views)} views • ${d.revenue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {realtimeEnabled === false && (
          <p className="text-sm text-purple-600">Realtime is OFF — API quota saved. Enable to see last 48h data.</p>
        )}

        {/* Admin: User Realtime Controls */}
        {clients.length > 0 && (
          <div className="mt-4 pt-4 border-t border-purple-200">
            <h4 className="text-xs font-semibold text-purple-800 mb-2">User Realtime Access Control</h4>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {clients.filter(c => c.status === "active").map(c => (
                <div key={c.id} className="flex items-center justify-between px-3 py-1.5 bg-white rounded border border-purple-50">
                  <span className="text-xs text-foreground">{c.name} ({c.email})</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={realtimeUserSettings[c.email] !== false}
                      onChange={(e) => toggleUserRealtime(c.email, e.target.checked)}
                      className="rounded border-purple-300"
                    />
                    <span className="text-[10px] text-muted">{realtimeUserSettings[c.email] === false ? "OFF" : "ON"}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {tokenFilter && (
        <div id="token-channels-section" className={`bg-white rounded-xl border overflow-hidden ${tokenFilter === "valid" ? "border-green-200" : tokenFilter === "invalid" ? "border-red-200" : "border-border"}`}>
          <div className={`flex items-center justify-between p-4 border-b ${tokenFilter === "valid" ? "border-green-100 bg-green-50" : tokenFilter === "invalid" ? "border-red-100 bg-red-50" : "border-border bg-muted/20"}`}>
            <div className="flex items-center gap-2">
              {tokenFilter === "valid" ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : tokenFilter === "invalid" ? <XCircle className="w-5 h-5 text-red-500" /> : <Radio className="w-5 h-5 text-purple-600" />}
              <h2 className={`text-base font-semibold ${tokenFilter === "valid" ? "text-green-900" : tokenFilter === "invalid" ? "text-red-900" : "text-foreground"}`}>
                {tokenFilter === "all" ? "All Channels" : `${tokenFilter === "valid" ? "Valid" : "Invalid"} Token Channels`} ({filteredTokenChannelIds.length})
              </h2>
            </div>
            <button onClick={() => setTokenFilter(null)} className="text-xs text-muted hover:text-foreground font-medium">
              Close
            </button>
          </div>
          <div className="p-4">
            {filteredTokenChannelIds.length === 0 ? (
              <p className="text-center text-muted py-4 text-sm font-medium">No channels found.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredTokenChannelIds.map((channelId) => {
                  const client = clients.find((item) => item.channels.includes(channelId));
                  const cached = cachedChannelMap[channelId];
                  const tokenStatus = tokenStatuses[channelId];
                  const isValid = tokenStatus?.status === "valid";
                  return (
                    <div key={channelId} className={`flex items-center gap-3 p-3 rounded-lg border ${isValid ? "bg-green-50/50 border-green-100" : "bg-red-50/50 border-red-100"}`}>
                      {cached?.thumbnail ? (
                        <img src={cached.thumbnail} alt="" className="w-8 h-8 rounded-full shrink-0" />
                      ) : (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isValid ? "bg-green-100" : "bg-red-100"}`}>
                          <Radio className={`w-4 h-4 ${isValid ? "text-green-500" : "text-red-400"}`} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{cached?.channelTitle || channelId}</p>
                        <p className="text-xs text-muted truncate">User: {client?.name || "Unknown"} • {client?.email || "—"}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${isValid ? "bg-green-100 text-green-700" : tokenStatus?.status === "expired" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                        {isValid ? "Valid" : tokenStatus?.status === "expired" ? "Expired" : "Not Validated"}
                      </span>
                      {!isValid && (
                        <a href={`/channels?validate=${channelId}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors shrink-0">
                          Validate
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Approvals — New Clients + Pending Channels */}
      {(() => {
        const pendingUsers = clients.filter((c) => c.status === "inactive" || c.status === ("pending" as string));
        const pendingChannelsList: { channelId: string; userId: string; userName: string; userEmail: string }[] = [];
        for (const c of clients) {
          const pc = (c as unknown as { pendingChannels?: string[] }).pendingChannels;
          if (pc?.length) {
            for (const chId of pc) {
              pendingChannelsList.push({ channelId: chId, userId: c.id, userName: c.name, userEmail: c.email });
            }
          }
        }
        if (pendingUsers.length === 0 && pendingChannelsList.length === 0) return null;
        return (
          <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-amber-100 bg-amber-50">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-semibold text-amber-900">
                  Pending Approvals ({pendingUsers.length + pendingChannelsList.length})
                </h2>
              </div>
              <button
                onClick={() => router.push("/admin-clients")}
                className="text-xs text-amber-700 hover:text-amber-900 font-medium"
              >
                Manage Users →
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[350px] overflow-y-auto">
              {pendingUsers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">New Users Waiting Approval</p>
                  {pendingUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-lg border border-amber-100 mb-2">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                        <UserPlus className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                        <p className="text-xs text-muted">{user.email} {user.phone && `• ${user.phone}`}</p>
                      </div>
                      <span className="text-xs text-muted">{user.joinedDate}</span>
                      <button
                        onClick={async () => {
                          const res = await fetch("/api/users", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: user.id, status: "active" }),
                          });
                          if (res.ok) fetchClients();
                        }}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors shrink-0"
                      >
                        Approve
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {pendingChannelsList.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Channels Waiting Approval</p>
                  {pendingChannelsList.map((pc) => {
                    const cached = cachedChannelMap[pc.channelId];
                    return (
                      <div key={`${pc.userId}-${pc.channelId}`} className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-lg border border-amber-100 mb-2">
                        {cached?.thumbnail ? (
                          <img src={cached.thumbnail} alt="" className="w-8 h-8 rounded-full shrink-0" />
                        ) : (
                          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                            <Radio className="w-4 h-4 text-amber-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {cached?.channelTitle || pc.channelId}
                          </p>
                          <p className="text-xs text-muted truncate">Client: {pc.userName} • {pc.userEmail}</p>
                        </div>
                        <button
                          onClick={async () => {
                            const res = await fetch("/api/users", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ type: "approve_channel", userId: pc.userId, channelId: pc.channelId }),
                            });
                            if (res.ok) fetchClients();
                          }}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors shrink-0"
                        >
                          Approve
                        </button>
                        <button
                          onClick={async () => {
                            const res = await fetch("/api/users", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ type: "reject_channel", userId: pc.userId, channelId: pc.channelId }),
                            });
                            if (res.ok) fetchClients();
                          }}
                          className="px-2.5 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded-lg hover:bg-red-200 transition-colors shrink-0"
                        >
                          Reject
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* YouTube Analytics — Real-time Revenue, Views, Subscribers, CPM, RPM */}
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold text-foreground">YouTube Analytics (All Clients)</h2>
          </div>
          <DateRangeFilter
            value={datePreset}
            onChange={(p, range) => {
              setDatePreset(p);
              setDateRange(range);
            }}
          />
        </div>
        {/* Token status info */}
        {(() => {
          const validCount = Object.values(tokenStatuses).filter((s) => s.status === "valid").length;
          const totalCount = allChannelIds.length;
          const invalidChannels = allChannelIds.filter((id) => !tokenStatuses[id] || tokenStatuses[id].status !== "valid");
          if (totalCount === 0) return null;
          if (validCount === 0) return (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              {cachedClientData.length > 0 ? (
                <>
                  <strong>Showing cached data.</strong> Live YouTube API tokens not found — displaying last synced data.
                  {syncing && <span className="ml-2 text-xs">(Syncing fresh data...)</span>}
                </>
              ) : (
                <>
                  <strong>No channel tokens found.</strong> Revenue & analytics data requires valid OAuth tokens.
                  Click &quot;Sync YouTube Data&quot; or wait for clients to validate tokens.
                </>
              )}
              <span className="block mt-1 text-xs text-amber-600">
                {totalCount} channel(s) without valid token
              </span>
              {dashData?._debug && Object.keys(dashData._debug.channelTokenErrors).length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-medium">Token Details</summary>
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(dashData._debug.channelTokenErrors).map(([id, err]) => (
                      <li key={id}><code>{id}</code>: {err}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
          if (validCount < totalCount) return (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              Analytics for <strong>{validCount}</strong> of <strong>{totalCount}</strong> channels.
              {invalidChannels.length > 0 && (
                <span className="block mt-1 text-xs text-blue-600">
                  Token pending: {invalidChannels.map((id) => {
                    const client = clients.find((c) => c.channels.includes(id));
                    return client ? `${id} (${client.name})` : id;
                  }).join(", ")}
                </span>
              )}
            </div>
          );
          return null;
        })()}
        {ytLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted">Loading analytics...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium">Revenue</p>
              <p className="text-xl font-bold text-green-900">{formatCurrency(ytStats.curEstRevenue)}</p>
              {pctChange(ytStats.curEstRevenue, ytStats.prevEstRevenue) !== null && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${
                  (pctChange(ytStats.curEstRevenue, ytStats.prevEstRevenue) || 0) >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {(pctChange(ytStats.curEstRevenue, ytStats.prevEstRevenue) || 0) >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(pctChange(ytStats.curEstRevenue, ytStats.prevEstRevenue) || 0).toFixed(1)}%
                </div>
              )}
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs text-blue-600 font-medium">Views</p>
              <p className="text-xl font-bold text-blue-900">{formatNumber(ytStats.curViews)}</p>
              {pctChange(ytStats.curViews, ytStats.prevViews) !== null && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${
                  (pctChange(ytStats.curViews, ytStats.prevViews) || 0) >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {(pctChange(ytStats.curViews, ytStats.prevViews) || 0) >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(pctChange(ytStats.curViews, ytStats.prevViews) || 0).toFixed(1)}%
                </div>
              )}
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <p className="text-xs text-purple-600 font-medium">Subscribers (net)</p>
              <p className="text-xl font-bold text-purple-900">{ytStats.curSubs >= 0 ? "+" : ""}{formatNumber(ytStats.curSubs)}</p>
              {pctChange(ytStats.curSubs, ytStats.prevSubs) !== null && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${
                  (pctChange(ytStats.curSubs, ytStats.prevSubs) || 0) >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {(pctChange(ytStats.curSubs, ytStats.prevSubs) || 0) >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(pctChange(ytStats.curSubs, ytStats.prevSubs) || 0).toFixed(1)}%
                </div>
              )}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs text-amber-600 font-medium">CPM</p>
              <p className="text-xl font-bold text-amber-900">{formatCurrency(ytStats.curCPM)}</p>
              {pctChange(ytStats.curCPM, ytStats.prevCPM) !== null && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${
                  (pctChange(ytStats.curCPM, ytStats.prevCPM) || 0) >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {(pctChange(ytStats.curCPM, ytStats.prevCPM) || 0) >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(pctChange(ytStats.curCPM, ytStats.prevCPM) || 0).toFixed(1)}%
                </div>
              )}
            </div>
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
              <p className="text-xs text-cyan-600 font-medium">RPM</p>
              <p className="text-xl font-bold text-cyan-900">{formatCurrency(ytStats.curRPM)}</p>
              {pctChange(ytStats.curRPM, ytStats.prevRPM) !== null && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${
                  (pctChange(ytStats.curRPM, ytStats.prevRPM) || 0) >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {(pctChange(ytStats.curRPM, ytStats.prevRPM) || 0) >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(pctChange(ytStats.curRPM, ytStats.prevRPM) || 0).toFixed(1)}%
                </div>
              )}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-600 font-medium">Total Subscribers</p>
              <p className="text-xl font-bold text-slate-900">{formatNumber(ytStats.totalSubscribers)}</p>
              <p className="text-xs text-muted mt-1">All channels</p>
            </div>
          </div>
        )}
      </div>

      {/* Per-Channel Daily Revenue Table */}
      {perChannelDailyRevenue.channels.length > 0 && perChannelDailyRevenue.dates.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-foreground">Per-Channel Daily Revenue</h2>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {([1, 3, 7, "all"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDailyRevDays(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    dailyRevDays === d
                      ? "bg-primary text-white"
                      : "bg-slate-100 text-muted hover:bg-slate-200"
                  }`}
                >
                  {d === 1 ? "Latest" : d === "all" ? "All" : `${d} Days`}
                </button>
              ))}
              <span className="text-xs text-muted mx-0.5">|</span>
              {(() => {
                const months: { value: string; label: string }[] = [];
                const now = new Date();
                for (let i = 0; i < 6; i++) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                  const label = d.toLocaleString("en-US", { month: "short" });
                  months.push({ value: val, label });
                }
                return months.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setDailyRevDays(m.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      dailyRevDays === m.value
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-muted hover:bg-slate-200"
                    }`}
                  >
                    {m.label}
                  </button>
                ));
              })()}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 font-medium text-muted text-xs">Channel</th>
                  <th className="text-left py-2 pr-3 font-medium text-muted text-xs">Client</th>
                  {perChannelDailyRevenue.dates.map((date) => (
                    <th key={date} className="text-right py-2 px-2 font-medium text-muted text-xs whitespace-nowrap">{date.length > 5 ? date.slice(5) : date}</th>
                  ))}
                  <th className="text-right py-2 px-2 font-semibold text-amber-700 text-xs whitespace-nowrap">{perChannelDailyRevenue.currentMonthName}</th>
                  <th className="text-right py-2 pl-3 font-semibold text-foreground text-xs">Total</th>
                  <th className="text-right py-2 pl-3 font-semibold text-amber-600 text-xs">INR</th>
                </tr>
              </thead>
              <tbody>
                {perChannelDailyRevenue.channels.map((ch) => {
                  const total = perChannelDailyRevenue.dates.reduce((s, d) => s + (ch.dailyMap[d] || 0), 0);
                  return (
                    <tr key={ch.channelId} className="border-b border-border/50 hover:bg-slate-50">
                      <td className="py-2 pr-3 text-foreground font-medium truncate max-w-[180px]" title={ch.channelName}>{ch.channelName}</td>
                      <td className="py-2 pr-3 text-muted text-xs truncate max-w-[120px]" title={ch.clientName}>{ch.clientName}</td>
                      {perChannelDailyRevenue.dates.map((date) => (
                        <td key={date} className="text-right py-2 px-2 text-muted tabular-nums">
                          ${(ch.dailyMap[date] || 0).toFixed(2)}
                        </td>
                      ))}
                      <td className="text-right py-2 px-2 font-semibold text-amber-700 tabular-nums">${ch.monthTotal.toFixed(2)}</td>
                      <td className="text-right py-2 pl-3 font-semibold text-foreground tabular-nums">${total.toFixed(2)}</td>
                      <td className="text-right py-2 pl-3 font-semibold text-amber-600 tabular-nums">₹{formatNumber(Math.round(total * INR_RATE))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-slate-50">
                  <td className="py-2 pr-3 font-bold text-foreground" colSpan={2}>Total</td>
                  {perChannelDailyRevenue.dates.map((date) => {
                    const dayTotal = perChannelDailyRevenue.channels.reduce((s, ch) => s + (ch.dailyMap[date] || 0), 0);
                    return (
                      <td key={date} className="text-right py-2 px-2 font-bold text-foreground tabular-nums">
                        ${dayTotal.toFixed(2)}
                      </td>
                    );
                  })}
                  <td className="text-right py-2 px-2 font-bold text-amber-700 tabular-nums">
                    ${perChannelDailyRevenue.channels.reduce((s, ch) => s + ch.monthTotal, 0).toFixed(2)}
                  </td>
                  {(() => {
                    const grandTotal = perChannelDailyRevenue.channels.reduce((s, ch) =>
                      s + perChannelDailyRevenue.dates.reduce((ss, d) => ss + (ch.dailyMap[d] || 0), 0), 0
                    );
                    return (
                      <>
                        <td className="text-right py-2 pl-3 font-bold text-primary tabular-nums">${grandTotal.toFixed(2)}</td>
                        <td className="text-right py-2 pl-3 font-bold text-amber-600 tabular-nums">₹{formatNumber(Math.round(grandTotal * INR_RATE))}</td>
                      </>
                    );
                  })()}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-muted mt-3">YouTube revenue data is ~2 days delayed. Latest available date shown first.</p>
        </div>
      )}

      {/* Top Clients + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clients by Channels */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-foreground">Top Clients</h2>
            </div>
            <span className="text-xs text-muted">By channel count & revenue</span>
          </div>
          <div className="p-4">
            {topClientsByChannels.length === 0 ? (
              <p className="text-center text-muted py-8 text-sm">No clients yet</p>
            ) : (
              <div className="space-y-3">
                {topClientsByChannels.map((client, idx) => {
                  const summary = accountSummaryMap[client.id] || {
                    channelIds: [],
                    revenue: 0,
                    netPayment: 0,
                    paidAmount: 0,
                  };
                  const expanded = expandedTopClient === client.id;
                  return (
                    <div key={client.id} className="overflow-hidden rounded-lg bg-slate-50">
                      <div className="flex items-center gap-3 p-3 hover:bg-slate-100 transition-colors">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-slate-400" : idx === 2 ? "bg-amber-700" : "bg-slate-300"
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                          <p className="text-xs text-muted truncate">{client.email}</p>
                        </div>
                        <button
                          onClick={() => setExpandedTopClient(expanded ? null : client.id)}
                          disabled={summary.channelIds.length === 0}
                          className="rounded-lg px-2 py-1 text-right hover:bg-purple-50 disabled:cursor-default disabled:opacity-60"
                          title={summary.channelIds.length > 0 ? "View channels and revenue" : "No channels assigned"}
                        >
                          <p className="flex items-center justify-end gap-1 text-sm font-bold text-purple-600">
                            {summary.channelIds.length}
                            {summary.channelIds.length > 0 && (expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </p>
                          <p className="text-xs text-muted">channels</p>
                        </button>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">{formatCurrency(summary.revenue)}</p>
                          <p className="text-xs text-muted">revenue</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-amber-600">₹{formatNumber(Math.round(summary.revenue * INR_RATE))}</p>
                          <p className="text-xs text-muted">revenue INR</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          client.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {client.status}
                        </span>
                      </div>
                      {expanded && (
                        <div className="max-h-52 space-y-1 overflow-y-auto border-t border-border/50 bg-white p-2">
                          {summary.channelIds.map((channelId) => {
                            const cached = cachedChannelMap[channelId];
                            const metrics = channelMetricsMap[channelId];
                            const owner = channelOwnerMap[channelId];
                            return (
                              <div key={channelId} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-slate-50">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">{cached?.channelTitle || tokenStatuses[channelId]?.channelTitle || channelId}</p>
                                  {client.role === "company" && owner && <p className="truncate text-[10px] text-blue-600">{owner.name}</p>}
                                </div>
                                <p className="shrink-0 font-bold text-green-600">{formatCurrency(metrics?.revenue || 0)}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-semibold text-foreground">Category Breakdown</h2>
            </div>
            <span className="text-xs text-muted">Client distribution</span>
          </div>
          <div className="p-4">
            {categoryBreakdown.length === 0 ? (
              <p className="text-center text-muted py-8 text-sm">No data</p>
            ) : (
              <div className="space-y-3">
                {categoryBreakdown.map(([category, count]) => {
                  const pct = stats.totalClients > 0 ? (count / stats.totalClients) * 100 : 0;
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{category}</span>
                        <span className="text-muted">{count} clients ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Company Overview — Drill-down */}
      {clients.filter((c) => c.role === "company").length > 0 && (
        <div id="company-overview" className="bg-white rounded-xl border border-border p-5 scroll-mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Crown className="w-5 h-5 text-emerald-600" />
              Company Overview
            </h2>
            <span className="text-xs text-muted">{clients.filter((c) => c.role === "company").length} companies</span>
          </div>
          {companyActionError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {companyActionError}
            </div>
          )}
          <div className="space-y-4">
            {clients.filter((c) => c.role === "company").map((company) => {
              const companyClients = clients.filter((c) => c.parentId === company.id && c.role !== "company");
              const companyHasDirectPayment = payments.some((payment) => payment.userId === company.id);
              const companyAccounts = company.channels.length > 0 || companyHasDirectPayment
                ? [company, ...companyClients]
                : companyClients;
              const companySummary = accountSummaryMap[company.id] || {
                channelIds: [],
                revenue: 0,
                netPayment: 0,
                paidAmount: 0,
              };
              return (
                <div key={company.id} className="border border-border/50 rounded-lg overflow-hidden">
                  <div className="flex items-stretch">
                    <button
                      onClick={() => setExpandedClient(expandedClient === `company-${company.id}` ? null : `company-${company.id}`)}
                      className="min-w-0 flex-1 flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                          {company.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-foreground">{company.name}</p>
                          <p className="text-xs text-muted">{company.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-xs text-muted">Clients</p>
                          <p className="font-bold text-blue-600">{companyClients.length}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted">Channels</p>
                          <p className="font-bold text-purple-600">{companySummary.channelIds.length}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted">Revenue</p>
                          <p className="font-bold text-green-600">{formatCurrency(companySummary.revenue)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted">Revenue INR</p>
                          <p className="font-bold text-amber-600">{INR_RATE > 0 ? `₹${(companySummary.revenue * INR_RATE).toFixed(0)}` : "—"}</p>
                        </div>
                        {expandedClient === `company-${company.id}` ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                      </div>
                    </button>
                    <div className="flex items-center gap-1 border-l border-border/50 px-3">
                      <button
                        onClick={() => router.push(`/admin-vendors?companyId=${encodeURIComponent(company.id)}`)}
                        className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                        title="Open Company Vendor Management"
                        aria-label={`Open ${company.name} Vendor Management`}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => router.push(`/admin-clients?edit=${encodeURIComponent(company.id)}`)}
                        className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                        title="Edit account or password"
                        aria-label={`Edit ${company.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => updateCompanyStatus(company)}
                        disabled={companyActionId === company.id}
                        className={`rounded-lg p-2 disabled:opacity-50 ${company.status === "active" ? "text-amber-600 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"}`}
                        title={company.status === "active" ? "Deactivate company" : "Activate company"}
                        aria-label={`${company.status === "active" ? "Deactivate" : "Activate"} ${company.name}`}
                      >
                        {companyActionId === company.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => deleteCompany(company)}
                        disabled={companyActionId === company.id}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="Delete company"
                        aria-label={`Delete ${company.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {expandedClient === `company-${company.id}` && (
                    <div className="border-t border-border/50 bg-slate-50/50 p-4 space-y-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => router.push(`/admin-vendors?companyId=${encodeURIComponent(company.id)}`)}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Open Company Vendor Management
                        </button>
                      </div>
                      {companyAccounts.length === 0 ? (
                        <p className="text-sm text-muted text-center py-4">No clients or company channels added yet</p>
                      ) : (
                        companyAccounts.map((cl) => {
                          const isCompanyAccount = cl.id === company.id;
                          const directPayments = payments.filter((payment) => payment.userId === cl.id);
                          const accountSummary = isCompanyAccount
                            ? {
                                channelIds: Array.from(new Set(cl.channels || [])),
                                revenue: (cl.channels || []).reduce(
                                  (total, channelId) => total + (channelMetricsMap[channelId]?.revenue || 0),
                                  0
                                ),
                                netPayment: directPayments.reduce((total, payment) => total + (payment.netTotal || 0), 0),
                                paidAmount: directPayments.reduce((total, payment) => total + (payment.paidAmount || 0), 0),
                              }
                            : accountSummaryMap[cl.id] || {
                                channelIds: [],
                                revenue: 0,
                                netPayment: 0,
                                paidAmount: 0,
                              };
                          return (
                            <div key={cl.id} className="bg-white rounded-lg border border-border/50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                    {cl.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-sm">{cl.name}</p>
                                      {isCompanyAccount && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">Company Account</span>}
                                    </div>
                                    <p className="text-xs text-muted">{cl.email}</p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-xs">
                                  <span className="font-medium text-purple-600">{accountSummary.channelIds.length} channels</span>
                                  <span className="text-green-600 font-semibold">Revenue {formatCurrency(accountSummary.revenue)}</span>
                                  <span className="text-blue-600 font-semibold">Net Payment {formatCurrency(accountSummary.netPayment)}</span>
                                  <span className="text-emerald-600 font-semibold">Paid {formatCurrency(accountSummary.paidAmount)}</span>
                                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cl.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                    {cl.status}
                                  </span>
                                </div>
                              </div>
                              {accountSummary.channelIds.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-border/30">
                                        <th className="text-left py-1.5 px-2 font-medium text-muted">Channel</th>
                                        <th className="text-right py-1.5 px-2 font-medium text-muted">Subs</th>
                                        <th className="text-right py-1.5 px-2 font-medium text-muted">Views</th>
                                        <th className="text-right py-1.5 px-2 font-medium text-muted">Revenue</th>
                                        <th className="text-right py-1.5 px-2 font-medium text-muted">Revenue INR</th>
                                        <th className="text-right py-1.5 px-2 font-medium text-muted">Token</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {accountSummary.channelIds.map((channelId) => {
                                        const cached = cachedChannelMap[channelId];
                                        const metrics = channelMetricsMap[channelId];
                                        const valid = tokenStatuses[channelId]?.status === "valid";
                                        return (
                                          <tr key={channelId} className="border-b border-border/20">
                                            <td className="py-1.5 px-2">
                                              <div className="flex items-center gap-1.5">
                                                {cached?.thumbnail && <img src={cached.thumbnail} alt="" className="w-4 h-4 rounded-full" />}
                                                <div>
                                                  <p>{tokenStatuses[channelId]?.channelTitle || cached?.channelTitle || channelId}</p>
                                                  <p className="font-mono text-[9px] text-muted">{channelId}</p>
                                                </div>
                                              </div>
                                            </td>
                                            <td className="py-1.5 px-2 text-right">{formatNumber(metrics?.subscribers || 0)}</td>
                                            <td className="py-1.5 px-2 text-right">{formatNumber(metrics?.views || 0)}</td>
                                            <td className="py-1.5 px-2 text-right font-semibold text-green-600">{formatCurrency(metrics?.revenue || 0)}</td>
                                            <td className="py-1.5 px-2 text-right font-semibold text-amber-600">₹{formatNumber(Math.round((metrics?.revenue || 0) * INR_RATE))}</td>
                                            <td className="py-1.5 px-2 text-right">
                                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${valid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                                {valid ? "Valid" : "Invalid"}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Clients with Channels — Filterable Table */}
      <div id="users-section" className="bg-white rounded-xl border border-border overflow-hidden scroll-mt-4">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Users & Channels</h2>
          <button
            onClick={() => router.push("/admin-clients")}
            className="text-sm text-primary hover:text-primary-dark font-medium"
          >
            Manage Users →
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-border bg-slate-50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or channel ID..."
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              />
            </div>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">All Users</option>
              <option value="companies">Companies Only</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
              <option value="with-channels">With Channels</option>
              <option value="without-channels">Without Channels</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">#</th>
                <th
                  className="text-left px-4 py-3 font-semibold text-foreground cursor-pointer hover:text-primary"
                  onClick={() => toggleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    Client
                    {sortBy === "name" && (sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Contact</th>
                <th
                  className="text-left px-4 py-3 font-semibold text-foreground cursor-pointer hover:text-primary"
                  onClick={() => toggleSort("channels")}
                >
                  <div className="flex items-center gap-1">
                    Channels
                    {sortBy === "channels" && (sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  className="text-left px-4 py-3 font-semibold text-foreground cursor-pointer hover:text-primary"
                  onClick={() => toggleSort("status")}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortBy === "status" && (sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Revenue</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Revenue INR</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Joined</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client, idx) => {
                const summary = accountSummaryMap[client.id] || {
                  channelIds: [],
                  revenue: 0,
                  netPayment: 0,
                  paidAmount: 0,
                };
                return (
                  <Fragment key={client.id}>
                    <tr className="border-b border-border hover:bg-slate-50">
                      <td className="px-4 py-3 text-muted">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                            {client.name[0]}
                          </div>
                          <div>
                            <span className="font-medium text-foreground block">{client.name}</span>
                            <span className="text-[10px] text-muted">{client.role === "company" ? "Company" : client.category}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-xs text-muted">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[160px]">{client.email}</span>
                          </div>
                          {client.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted">
                              <Phone className="w-3 h-3" />
                              <span>{client.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}
                          disabled={summary.channelIds.length === 0}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-purple-600 hover:bg-purple-50 disabled:cursor-default disabled:opacity-60"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          {summary.channelIds.length}
                          {summary.channelIds.length > 0 && (expandedClient === client.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          client.status === "active"
                            ? "bg-green-100 text-green-700"
                            : client.status === ("pending" as string)
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {client.status === "active" ? "Active" : client.status === ("pending" as string) ? "Pending" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-600">{formatCurrency(summary.revenue)}</td>
                      <td className="px-4 py-3 font-semibold text-amber-600">₹{formatNumber(Math.round(summary.revenue * INR_RATE))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-muted">
                          <Calendar className="w-3 h-3" />
                          <span>{client.joinedDate}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {summary.channelIds.length > 0 && (
                          <button
                            onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark font-medium"
                          >
                            {expandedClient === client.id ? "Hide" : "View"} Channels
                            {expandedClient === client.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedClient === client.id && summary.channelIds.length > 0 && (
                      <tr className="bg-slate-50">
                        <td colSpan={9} className="px-8 py-4">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                              Channels and revenue for {client.name}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {summary.channelIds.map((chId) => {
                                const ts = tokenStatuses[chId];
                                const isValid = ts?.status === "valid";
                                const cached = cachedChannelMap[chId];
                                const metrics = channelMetricsMap[chId];
                                const owner = channelOwnerMap[chId];
                                return (
                                  <div key={chId} className="flex flex-col gap-1 p-2 bg-white rounded-lg border border-border">
                                    <div className="flex items-center gap-2">
                                      {cached?.thumbnail ? (
                                        <img src={cached.thumbnail} alt="" className="w-6 h-6 rounded-full shrink-0" />
                                      ) : (
                                        <Radio className="w-4 h-4 text-purple-500 shrink-0" />
                                      )}
                                      <span className="text-sm font-medium text-foreground truncate flex-1">
                                        {ts?.channelTitle || cached?.channelTitle || chId}
                                      </span>
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                                        isValid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                      }`}>
                                        {isValid ? "Token Valid" : "No Token"}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 pl-6 text-[10px] text-muted">
                                      <span>{formatNumber(metrics?.subscribers || 0)} subs</span>
                                      <span>{formatNumber(metrics?.views || 0)} views</span>
                                      <span className="font-semibold text-green-600">{formatCurrency(metrics?.revenue || 0)}</span>
                                      <span className="font-semibold text-amber-600">₹{formatNumber(Math.round((metrics?.revenue || 0) * INR_RATE))}</span>
                                    </div>
                                    {client.role === "company" && owner && <p className="pl-6 text-[10px] text-blue-600">Client: {owner.name}</p>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p>No clients found matching your filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-border bg-slate-50 text-sm text-muted">
          Showing {filteredClients.length} of {clients.length} clients
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => router.push("/admin-clients")}
          className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <UserPlus className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-foreground">Create New User</h3>
          </div>
          <p className="text-sm text-muted">Register a new client with email, password, and channel assignments.</p>
        </button>

        <button
          onClick={() => router.push("/admin-channels")}
          className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <Radio className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-foreground">Manage Channels</h3>
          </div>
          <p className="text-sm text-muted">View and manage all YouTube channels across clients.</p>
        </button>

        <button
          onClick={() => router.push("/admin-reports")}
          className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold text-foreground">View Reports</h3>
          </div>
          <p className="text-sm text-muted">Revenue reports and analytics across all clients.</p>
        </button>
      </div>
    </div>
  );
}
