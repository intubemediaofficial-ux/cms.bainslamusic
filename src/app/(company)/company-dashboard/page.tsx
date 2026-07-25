"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Radio,
  DollarSign,
  Eye,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Loader2,
  Search,
  ChevronRight,
  ExternalLink,
  ArrowDownCircle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { useExchangeRate } from "@/lib/hooks/useExchangeRate";
import { useYouTubeData } from "@/lib/hooks/useYouTubeData";
import DateRangeFilter, { computeRange } from "@/components/dashboard/DateRangeFilter";
import type { DateRange } from "@/components/dashboard/DateRangeFilter";
import RevenueComparisonChart from "@/components/features/RevenueComparisonChart";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ClientUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  channels: string[];
  pendingChannels?: string[];
  status: "active" | "inactive" | "pending";
  joinedDate: string;
  category: string;
  parentId?: string;
}

interface CachedChannelData {
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  subscribers: number;
  views: number;
  videoCount: number;
  estimatedRevenue: number;
  rpm: number;
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

interface WithdrawRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  requestDate: string;
  processedDate: string;
  adminNote: string;
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
  createdDate: string;
}

interface AnalyticsResponse {
  columnHeaders?: Array<{ name?: string | null }>;
  rows?: Array<Array<string | number>>;
}

interface PerChannelAnalytics {
  performance: AnalyticsResponse | null;
  prevPerformance: AnalyticsResponse | null;
  revenue: AnalyticsResponse | null;
  prevRevenue: AnalyticsResponse | null;
  dailyRevenue: AnalyticsResponse | null;
  revenueViews: AnalyticsResponse | null;
}

interface AnalyticsChannel {
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

interface DashboardFullData {
  channels?: AnalyticsChannel[];
  perChannelAnalytics?: Record<string, PerChannelAnalytics>;
  tokenizedChannels?: string[];
}

function sumMetric(data: AnalyticsResponse | null | undefined, metricName: string): number {
  if (!data?.rows?.length || !data.columnHeaders) return 0;
  const index = data.columnHeaders.findIndex((header) => header.name === metricName);
  if (index === -1) return 0;
  return data.rows.reduce((sum, row) => sum + (Number(row[index]) || 0), 0);
}

function percentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default function CompanyDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { rate: INR_RATE } = useExchangeRate("USD");

  const [clients, setClients] = useState<ClientUser[]>([]);
  const [cachedData, setCachedData] = useState<CachedClientData[]>([]);
  const [scopedChannelIds, setScopedChannelIds] = useState<string[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState<"all" | "active">("all");
  const [datePreset, setDatePreset] = useState("28d");
  const [dateRange, setDateRange] = useState<DateRange>(() => computeRange("28d"));

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "company") {
      router.push("/login");
    }
  }, [session, status, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [clientsRes, cachedRes, scopeRes, withdrawRes, paymentsRes] = await Promise.all([
        fetch("/api/users?action=myClients"),
        fetch("/api/client-data?action=getAllCachedData"),
        fetch("/api/users?action=channelScope", { cache: "no-store" }),
        fetch("/api/payments?type=withdrawals"),
        fetch("/api/payments"),
      ]);
      if (clientsRes.ok) {
        const j = await clientsRes.json();
        setClients(j.data || []);
      }
      if (cachedRes.ok) {
        const j = await cachedRes.json();
        setCachedData(j.data || []);
      }
      if (scopeRes.ok) {
        const j = await scopeRes.json();
        setScopedChannelIds(j.data?.channelIds || []);
      } else {
        setScopedChannelIds([]);
      }
      if (withdrawRes.ok) {
        const j = await withdrawRes.json();
        setWithdrawals(j.data || []);
      }
      if (paymentsRes.ok) {
        const j = await paymentsRes.json();
        setPayments(j.data || []);
      }
    } catch (err) {
      setScopedChannelIds([]);
      console.error("Failed to fetch company data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session?.user?.role === "company") fetchData();
  }, [session, fetchData]);

  const clientDataMap = useMemo(() => {
    const map = new Map<string, CachedClientData>();
    for (const cached of cachedData) {
      const client = clients.find((item) => item.email.toLowerCase() === cached.email?.toLowerCase());
      if (client) map.set(client.id, cached);
    }
    return map;
  }, [cachedData, clients]);

  const cachedChannelMap = useMemo(() => {
    const map = new Map<string, CachedChannelData>();
    for (const cached of cachedData) {
      for (const channel of cached.channels || []) map.set(channel.channelId, channel);
    }
    return map;
  }, [cachedData]);

  const allChannelIds = useMemo(
    () =>
      Array.from(new Set(scopedChannelIds)).filter(
        (id) => id && !id.startsWith("UCtest") && id !== "test"
      ),
    [scopedChannelIds]
  );

  const channelOwnerMap = useMemo(() => {
    const map = new Map<string, ClientUser>();
    for (const client of clients) {
      for (const channelId of client.channels || []) map.set(channelId, client);
    }
    return map;
  }, [clients]);

  const analyticsParams = useMemo(() => ({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    prevStartDate: dateRange.prevStartDate,
    prevEndDate: dateRange.prevEndDate,
    ...(allChannelIds.length > 0 ? { channelIds: allChannelIds.join(",") } : {}),
  }), [dateRange, allChannelIds]);

  const { data: dashData, loading: analyticsLoading, error: analyticsError } = useYouTubeData<DashboardFullData>(
    "dashboardFull",
    analyticsParams,
    {}
  );

  const channelAnalytics = useMemo(() => {
    const liveChannels = new Map<string, AnalyticsChannel>();
    for (const channel of dashData?.channels || []) {
      if (channel.id) liveChannels.set(channel.id, channel);
    }

    return allChannelIds.map((channelId) => {
      const analytics = dashData?.perChannelAnalytics?.[channelId];
      const cached = cachedChannelMap.get(channelId);
      const live = liveChannels.get(channelId);
      const currentRevenue = analytics
        ? sumMetric(analytics.revenueViews, "estimatedRevenue") || sumMetric(analytics.revenue, "estimatedRevenue")
        : cached?.estimatedRevenue || 0;
      const previousRevenue = analytics ? sumMetric(analytics.prevRevenue, "estimatedRevenue") : 0;
      const views = analytics ? sumMetric(analytics.performance, "views") : cached?.views || 0;
      const subscribers = live?.statistics?.subscriberCount
        ? Number(live.statistics.subscriberCount)
        : cached?.subscribers || 0;
      const owner = channelOwnerMap.get(channelId);

      return {
        channelId,
        channelName: live?.snippet?.title || cached?.channelTitle || channelId,
        thumbnail: live?.snippet?.thumbnails?.default?.url || cached?.thumbnail || "",
        clientName: owner?.name || "—",
        currentRevenue,
        previousRevenue,
        views,
        subscribers,
        rpm: views > 0 ? (currentRevenue / views) * 1000 : cached?.rpm || 0,
      };
    }).sort((a, b) => b.currentRevenue - a.currentRevenue);
  }, [allChannelIds, dashData, cachedChannelMap, channelOwnerMap]);

  const dailyRevenue = useMemo(() => {
    const totals = new Map<string, number>();
    for (const analytics of Object.values(dashData?.perChannelAnalytics || {})) {
      const headers = analytics.dailyRevenue?.columnHeaders?.map((header) => header.name || "") || [];
      const dateIndex = headers.indexOf("day");
      const revenueIndex = headers.indexOf("estimatedRevenue");
      if (dateIndex === -1 || revenueIndex === -1) continue;
      for (const row of analytics.dailyRevenue?.rows || []) {
        const date = String(row[dateIndex]);
        totals.set(date, (totals.get(date) || 0) + (Number(row[revenueIndex]) || 0));
      }
    }
    return Array.from(totals.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, revenue]) => ({ date: date.slice(5), revenue: Math.round(revenue * 100) / 100 }));
  }, [dashData]);

  const cachedTotals = useMemo(() => {
    let revenue = 0;
    let views = 0;
    let subscribers = 0;
    const approvedChannelIds = new Set(allChannelIds);

    for (const cached of cachedData) {
      for (const channel of cached.channels || []) {
        if (!approvedChannelIds.has(channel.channelId)) continue;
        revenue += channel.estimatedRevenue || 0;
        views += channel.views || 0;
        subscribers += channel.subscribers || 0;
      }
    }
    return { revenue, views, subscribers };
  }, [allChannelIds, cachedData]);

  const analyticsTotals = useMemo(() => {
    const revenue = channelAnalytics.reduce((sum, channel) => sum + channel.currentRevenue, 0);
    const previousRevenue = channelAnalytics.reduce((sum, channel) => sum + channel.previousRevenue, 0);
    const views = channelAnalytics.reduce((sum, channel) => sum + channel.views, 0);
    const subscribers = channelAnalytics.reduce((sum, channel) => sum + channel.subscribers, 0);
    return {
      revenue: revenue || cachedTotals.revenue,
      previousRevenue,
      views: views || cachedTotals.views,
      subscribers: subscribers || cachedTotals.subscribers,
      rpm: views > 0 ? (revenue / views) * 1000 : 0,
    };
  }, [channelAnalytics, cachedTotals]);

  const totalClients = clients.length;
  const totalChannels = allChannelIds.length || clients.reduce((sum, client) => sum + (client.channels?.length || 0), 0);
  const totalRevenue = analyticsTotals.revenue;
  const totalViews = analyticsTotals.views;
  const activeClients = clients.filter((client) => client.status === "active").length;

  const filteredClients = clients.filter((client) => {
    if (clientFilter === "active" && client.status !== "active") return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return client.name.toLowerCase().includes(query) || client.email.toLowerCase().includes(query);
  });

  const filteredClientTotals = filteredClients.reduce((totals, client) => {
    const cached = clientDataMap.get(client.id);
    totals.channels += client.channels?.length || 0;
    totals.revenue += cached?.totalRevenue || 0;
    totals.views += cached?.totalViews || 0;
    return totals;
  }, { channels: 0, revenue: 0, views: 0 });

  const recentPayments = [...payments].sort((a, b) => b.createdDate.localeCompare(a.createdDate)).slice(0, 10);

  const scrollToSection = (sectionId: string, filter?: "all" | "active") => {
    if (filter) setClientFilter(filter);
    requestAnimationFrame(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  if (status === "loading" || (session?.user?.role !== "company" && status !== "unauthenticated")) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Company Dashboard</h1>
        <p className="text-sm text-muted mt-1">
          Overview of all your clients and their channel performance.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button
          type="button"
          onClick={() => scrollToSection("clients-section", "all")}
          className="bg-white rounded-xl border border-border p-5 text-left hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
            <div className="min-w-0 flex-1"><p className="text-sm text-muted">Total Clients</p><p className="text-xl font-bold text-foreground">{totalClients}</p></div>
            <ChevronRight className="w-4 h-4 text-muted group-hover:text-blue-600" />
          </div>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("clients-section", "active")}
          className="bg-white rounded-xl border border-border p-5 text-left hover:border-green-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-600" /></div>
            <div className="min-w-0 flex-1"><p className="text-sm text-muted">Active Clients</p><p className="text-xl font-bold text-green-600">{activeClients}</p></div>
            <ChevronRight className="w-4 h-4 text-muted group-hover:text-green-600" />
          </div>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("channel-analytics")}
          className="bg-white rounded-xl border border-border p-5 text-left hover:border-purple-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><Radio className="w-5 h-5 text-purple-600" /></div>
            <div className="min-w-0 flex-1"><p className="text-sm text-muted">Total Channels</p><p className="text-xl font-bold text-foreground">{totalChannels}</p></div>
            <ChevronRight className="w-4 h-4 text-muted group-hover:text-purple-600" />
          </div>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("revenue-analytics")}
          className="bg-white rounded-xl border border-border p-5 text-left hover:border-amber-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center"><DollarSign className="w-5 h-5 text-amber-600" /></div>
            <div className="min-w-0 flex-1"><p className="text-sm text-muted">Total Revenue</p><p className="text-xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p></div>
            <ChevronRight className="w-4 h-4 text-muted group-hover:text-amber-600" />
          </div>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("channel-analytics")}
          className="bg-white rounded-xl border border-border p-5 text-left hover:border-red-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center"><Eye className="w-5 h-5 text-red-600" /></div>
            <div className="min-w-0 flex-1"><p className="text-sm text-muted">Total Views</p><p className="text-xl font-bold text-foreground">{formatNumber(totalViews)}</p></div>
            <ChevronRight className="w-4 h-4 text-muted group-hover:text-red-600" />
          </div>
        </button>
      </div>

      {/* Clients Table */}
      <div id="clients-section" className="bg-white rounded-xl border border-border p-5 scroll-mt-20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-foreground">{clientFilter === "active" ? "Active Clients" : "Your Clients"}</h2>
            {clientFilter === "active" && (
              <button type="button" onClick={() => setClientFilter("all")} className="text-xs text-primary hover:underline">Show all</button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={() => router.push("/company-clients")}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Users className="w-4 h-4" />
              Manage Clients
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No clients yet. Add your first client from the Manage Clients page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted">Client</th>
                  <th className="text-left py-3 px-4 font-medium text-muted">Email</th>
                  <th className="text-center py-3 px-4 font-medium text-muted">Channels</th>
                  <th className="text-right py-3 px-4 font-medium text-muted">Revenue ($)</th>
                  <th className="text-right py-3 px-4 font-medium text-muted">Revenue (INR)</th>
                  <th className="text-right py-3 px-4 font-medium text-muted">Views</th>
                  <th className="text-center py-3 px-4 font-medium text-muted">Status</th>
                  <th className="text-center py-3 px-4 font-medium text-muted">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const cd = clientDataMap.get(client.id);
                  const rev = cd?.totalRevenue || 0;
                  const views = cd?.totalViews || 0;
                  return (
                    <tr key={client.id} className="border-b border-border/50 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground">{client.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted">{client.email}</td>
                      <td className="py-3 px-4 text-center font-medium">{client.channels?.length || 0}</td>
                      <td className="py-3 px-4 text-right font-medium text-green-600">{formatCurrency(rev)}</td>
                      <td className="py-3 px-4 text-right font-medium text-amber-600">
                        {INR_RATE > 0 ? `₹${(rev * INR_RATE).toFixed(0)}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">{formatNumber(views)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          client.status === "active" ? "bg-green-100 text-green-700" :
                          client.status === "pending" ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => router.push(`/company-clients?view=${client.id}`)}
                          className="inline-flex items-center gap-1 text-primary hover:text-primary-dark text-xs font-medium"
                        >
                          View <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-3 px-4">Total ({filteredClients.length} clients)</td>
                  <td className="py-3 px-4"></td>
                  <td className="py-3 px-4 text-center">{filteredClientTotals.channels}</td>
                  <td className="py-3 px-4 text-right text-green-600">{formatCurrency(filteredClientTotals.revenue)}</td>
                  <td className="py-3 px-4 text-right text-amber-600">
                    {INR_RATE > 0 ? `₹${(filteredClientTotals.revenue * INR_RATE).toFixed(0)}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right">{formatNumber(filteredClientTotals.views)}</td>
                  <td className="py-3 px-4"></td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div id="revenue-analytics" className="space-y-5 scroll-mt-20">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Company Revenue Analytics
            </h2>
            <p className="text-sm text-muted">Combined YouTube analytics for your clients only.</p>
          </div>
          <DateRangeFilter
            value={datePreset}
            onChange={(preset, range) => {
              setDatePreset(preset);
              setDateRange(range);
            }}
          />
        </div>

        {analyticsError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Live analytics could not be loaded. Last synced channel data is shown where available.
          </div>
        )}

        {analyticsLoading ? (
          <div className="bg-white rounded-xl border border-border py-12 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted">Loading company analytics...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-xs font-medium text-green-700">Revenue ({dateRange.label})</p>
                <p className="text-xl font-bold text-green-900">{formatCurrency(analyticsTotals.revenue)}</p>
                <p className={`text-xs mt-1 flex items-center gap-1 ${percentageChange(analyticsTotals.revenue, analyticsTotals.previousRevenue) >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {percentageChange(analyticsTotals.revenue, analyticsTotals.previousRevenue) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(percentageChange(analyticsTotals.revenue, analyticsTotals.previousRevenue)).toFixed(1)}% vs previous period
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-medium text-amber-700">Revenue (INR)</p>
                <p className="text-xl font-bold text-amber-900">₹{formatNumber(Math.round(analyticsTotals.revenue * INR_RATE))}</p>
                <p className="text-xs text-amber-600 mt-1">Live USD to INR rate</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-medium text-blue-700">Period Views</p>
                <p className="text-xl font-bold text-blue-900">{formatNumber(analyticsTotals.views)}</p>
                <p className="text-xs text-blue-600 mt-1">Across all client channels</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <p className="text-xs font-medium text-purple-700">Subscribers</p>
                <p className="text-xl font-bold text-purple-900">{formatNumber(analyticsTotals.subscribers)}</p>
                <p className="text-xs text-purple-600 mt-1">Combined channel audience</p>
              </div>
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                <p className="text-xs font-medium text-cyan-700">Average RPM</p>
                <p className="text-xl font-bold text-cyan-900">{formatCurrency(analyticsTotals.rpm)}</p>
                <p className="text-xs text-cyan-600 mt-1">Revenue per 1,000 views</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-border p-5">
                <h3 className="font-semibold text-foreground mb-4">Revenue Trend</h3>
                {dailyRevenue.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyRevenue} margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `$${value}`} />
                        <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]} />
                        <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-sm text-muted">Daily revenue will appear when client channel tokens are valid.</div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-border p-5">
                <h3 className="font-semibold text-foreground mb-4">Top 5 Channels</h3>
                {channelAnalytics.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-sm text-muted">No client channels found.</div>
                ) : (
                  <div className="space-y-3">
                    {channelAnalytics.slice(0, 5).map((channel, index) => (
                      <div key={channel.channelId} className="flex items-center gap-3 rounded-lg border border-border p-3">
                        <span className="w-6 text-center text-sm font-bold text-muted">{index + 1}</span>
                        {channel.thumbnail ? (
                          <img src={channel.thumbnail} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center"><Radio className="w-4 h-4 text-purple-600" /></div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-foreground truncate">{channel.channelName}</p>
                          <p className="text-xs text-muted truncate">{channel.clientName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">{formatCurrency(channel.currentRevenue)}</p>
                          <p className="text-xs text-muted">RPM {formatCurrency(channel.rpm)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <RevenueComparisonChart
              channels={channelAnalytics.map((channel) => ({
                channelName: channel.channelName,
                currentRevenue: channel.currentRevenue,
                previousRevenue: channel.previousRevenue,
              }))}
              currentLabel={dateRange.label}
              previousLabel="Previous Period"
            />
          </>
        )}
      </div>

      <div id="channel-analytics" className="bg-white rounded-xl border border-border p-5 scroll-mt-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2"><Radio className="w-5 h-5 text-purple-600" />All Client Channels</h2>
            <p className="text-xs text-muted mt-1">Per-channel performance for {dateRange.label}</p>
          </div>
          <span className="text-sm font-medium text-muted">{channelAnalytics.length} channels</span>
        </div>
        {channelAnalytics.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted">No channel data available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 font-medium text-muted">Channel</th>
                  <th className="text-left py-3 px-3 font-medium text-muted">Client</th>
                  <th className="text-right py-3 px-3 font-medium text-muted">Revenue</th>
                  <th className="text-right py-3 px-3 font-medium text-muted">Previous</th>
                  <th className="text-right py-3 px-3 font-medium text-muted">Views</th>
                  <th className="text-right py-3 px-3 font-medium text-muted">Subscribers</th>
                  <th className="text-right py-3 px-3 font-medium text-muted">RPM</th>
                </tr>
              </thead>
              <tbody>
                {channelAnalytics.map((channel) => (
                  <tr key={channel.channelId} className="border-b border-border/50 hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 min-w-[220px]">
                        {channel.thumbnail ? <img src={channel.thumbnail} alt="" className="w-8 h-8 rounded-full object-cover" /> : <Radio className="w-5 h-5 text-purple-500" />}
                        <div className="min-w-0"><p className="font-medium text-foreground truncate max-w-[220px]">{channel.channelName}</p><p className="text-[10px] text-muted font-mono">{channel.channelId}</p></div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted">{channel.clientName}</td>
                    <td className="py-3 px-3 text-right font-semibold text-green-600">{formatCurrency(channel.currentRevenue)}</td>
                    <td className="py-3 px-3 text-right text-muted">{formatCurrency(channel.previousRevenue)}</td>
                    <td className="py-3 px-3 text-right">{formatNumber(channel.views)}</td>
                    <td className="py-3 px-3 text-right">{formatNumber(channel.subscribers)}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(channel.rpm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {recentPayments.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-foreground flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-600" />Monthly Client Payments</h2>
              <p className="text-xs text-muted mt-1">Recent payment records for your clients.</p>
            </div>
            <button type="button" onClick={() => router.push("/payments")} className="text-sm font-medium text-primary hover:underline">View all payments</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border"><th className="text-left py-3 px-3 font-medium text-muted">Month</th><th className="text-left py-3 px-3 font-medium text-muted">Client</th><th className="text-right py-3 px-3 font-medium text-muted">Total Revenue</th><th className="text-right py-3 px-3 font-medium text-muted">Share %</th><th className="text-right py-3 px-3 font-medium text-muted">Net Payment</th><th className="text-right py-3 px-3 font-medium text-muted">Paid</th><th className="text-center py-3 px-3 font-medium text-muted">Status</th></tr></thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border/50 hover:bg-slate-50">
                    <td className="py-3 px-3 font-medium">{payment.month}</td>
                    <td className="py-3 px-3"><p className="font-medium text-foreground">{payment.userName}</p><p className="text-xs text-muted">{payment.userEmail}</p></td>
                    <td className="py-3 px-3 text-right">{formatCurrency(payment.totalAmount)}</td>
                    <td className="py-3 px-3 text-right">{payment.revenueSharePercent}%</td>
                    <td className="py-3 px-3 text-right font-semibold text-green-600">{formatCurrency(payment.netTotal)}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(payment.paidAmount)}</td>
                    <td className="py-3 px-3 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${payment.status === "paid" ? "bg-green-100 text-green-700" : payment.status === "partial" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{payment.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Withdrawal Requests */}
      {withdrawals.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-amber-600" />
              Client Withdrawal Requests
            </h2>
            <span className="text-xs text-muted">{withdrawals.filter((w) => w.status === "pending").length} pending</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted">Client</th>
                  <th className="text-left py-2 px-3 font-medium text-muted">Email</th>
                  <th className="text-right py-2 px-3 font-medium text-muted">Amount</th>
                  <th className="text-center py-2 px-3 font-medium text-muted">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-muted">Date</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.slice(0, 10).map((w) => (
                  <tr key={w.id} className="border-b border-border/30">
                    <td className="py-2 px-3 font-medium">{w.userName}</td>
                    <td className="py-2 px-3 text-muted">{w.userEmail}</td>
                    <td className="py-2 px-3 text-right font-medium text-green-600">${w.amount.toFixed(2)}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        w.status === "pending" ? "bg-amber-100 text-amber-700" :
                        w.status === "paid" ? "bg-green-100 text-green-700" :
                        w.status === "approved" ? "bg-blue-100 text-blue-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {w.status === "pending" ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {w.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-muted text-xs">{new Date(w.requestDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-Client Channel Breakdown */}
      {filteredClients.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4">Client Channel Details</h2>
          <div className="space-y-4">
            {filteredClients.map((client) => {
              const cd = clientDataMap.get(client.id);
              const channels = cd?.channels || [];
              if (channels.length === 0) return null;
              return (
                <div key={client.id} className="border border-border/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-sm">{client.name}</span>
                      <span className="text-xs text-muted">({channels.length} channels)</span>
                    </div>
                    <a
                      href={`/company-clients?view=${client.id}`}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      Full Details <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 px-3 font-medium text-muted">Channel</th>
                          <th className="text-right py-2 px-3 font-medium text-muted">Subscribers</th>
                          <th className="text-right py-2 px-3 font-medium text-muted">Views</th>
                          <th className="text-right py-2 px-3 font-medium text-muted">Revenue ($)</th>
                          <th className="text-right py-2 px-3 font-medium text-muted">RPM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channels.map((ch) => (
                          <tr key={ch.channelId} className="border-b border-border/30">
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                {ch.thumbnail && (
                                  <img src={ch.thumbnail} alt="" className="w-5 h-5 rounded-full" />
                                )}
                                <span className="font-medium">{ch.channelTitle || ch.channelId}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right">{formatNumber(ch.subscribers)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(ch.views)}</td>
                            <td className="py-2 px-3 text-right text-green-600">{formatCurrency(ch.estimatedRevenue)}</td>
                            <td className="py-2 px-3 text-right">${ch.rpm?.toFixed(2) || "0.00"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
