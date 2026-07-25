"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Eye,
  Users,
  Play,
  MessageSquare,
  ThumbsUp,
  Wifi,
  WifiOff,
  Loader2,
  Share2,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Video,
  Download,
  X,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useSession } from "next-auth/react";
import MetricCard from "@/components/dashboard/MetricCard";
import DateRangeFilter, { computeRange } from "@/components/dashboard/DateRangeFilter";
import type { DateRange } from "@/components/dashboard/DateRangeFilter";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { useYouTubeData } from "@/lib/hooks/useYouTubeData";
import { useExchangeRate, toINR } from "@/lib/hooks/useExchangeRate";
import { ChannelHealthSummary } from "@/components/features/ChannelHealthCard";
import RevenueComparisonChart from "@/components/features/RevenueComparisonChart";

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

interface AnalyticsResponse {
  columnHeaders?: Array<{ name?: string | null }>;
  rows?: Array<Array<string | number>>;
}

interface TopVideoItem {
  id?: string | null;
  snippet?: {
    title?: string | null;
    thumbnails?: {
      medium?: { url?: string | null } | null;
      default?: { url?: string | null } | null;
    } | null;
  } | null;
  statistics?: {
    viewCount?: string | null;
    likeCount?: string | null;
    commentCount?: string | null;
  } | null;
}

interface ChannelRevenueInfo {
  revenue: number;
  views: number;
  rpm: number;
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
  currentPerformance?: AnalyticsResponse | null;
  prevPerformance?: AnalyticsResponse | null;
  currentRevenue?: AnalyticsResponse | null;
  prevRevenue?: AnalyticsResponse | null;
  dailyRevenue?: AnalyticsResponse | null;
  topVideos?: {
    analytics?: AnalyticsResponse | null;
    videos?: TopVideoItem[];
  };
  hasOwnChannel?: boolean;
  channelRevenueMap?: Record<string, ChannelRevenueInfo>;
  lastDayRevenue?: number;
  lastDayDate?: string;
  perChannelAnalytics?: Record<string, PerChannelAnalytics>;
  tokenizedChannels?: string[];
}

function sumMetric(data: AnalyticsResponse | undefined | null, metricName: string): number {
  if (!data?.rows?.length || !data.columnHeaders) return 0;
  const headers = data.columnHeaders.map((h) => h.name || "");
  const idx = headers.indexOf(metricName);
  if (idx === -1) return 0;
  return data.rows.reduce((sum, row) => sum + (Number(row[idx]) || 0), 0);
}

function sumRevenueMetric(data: AnalyticsResponse | undefined | null, metricName: string): number {
  if (!data?.rows?.length || !data.columnHeaders) return 0;
  const headers = data.columnHeaders.map((h) => h.name || "");
  const idx = headers.indexOf(metricName);
  if (idx === -1) return 0;
  return data.rows.reduce((sum, row) => sum + (Number(row[idx]) || 0), 0);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return ((current - previous) / Math.abs(previous)) * 100;
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

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && !!session?.user?.email;

  const [datePreset, setDatePreset] = useState("28d");
  const [dateRange, setDateRange] = useState<DateRange>(() => computeRange("28d"));
  const [dailyRevDays, setDailyRevDays] = useState<1 | 3 | 7 | 30 | "all">(7);

  const { rate: INR_RATE, lastFetched: rateLastFetched } = useExchangeRate("USD");

  // Channel detail modal month filter
  const [channelModalPeriod, setChannelModalPeriod] = useState<string>("current");

  const [serverChannelIds, setServerChannelIds] = useState<string[]>([]);

  // Channel detail modal
  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/users?action=channelScope", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        const ids = (json.data?.channelIds || []).filter(
          (channelId: string) => !channelId.startsWith("UCtest") && channelId !== "test"
        );
        setServerChannelIds(ids);
      })
      .catch(() => setServerChannelIds([]));
  }, [isAuthenticated, session?.user?.email]);

  const allChannelIds = useMemo(
    () => Array.from(new Set(serverChannelIds)),
    [serverChannelIds]
  );

  const isMonthPreset = /^\d{4}-\d{2}$/.test(datePreset);

  const apiParams = useMemo(() => ({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    prevStartDate: dateRange.prevStartDate,
    prevEndDate: dateRange.prevEndDate,
    ...(isMonthPreset ? { monthly: datePreset } : { rangeCache: "true" }),
    ...(allChannelIds.length > 0 ? { channelIds: allChannelIds.join(",") } : {}),
  }), [dateRange, allChannelIds, isMonthPreset, datePreset]);

  const { data: dashData, isReal, error, loading, cached: dashCached, lastUpdated: dashLastUpdated } = useYouTubeData<DashboardFullData>(
    "dashboardFull",
    apiParams,
    {}
  );

  const channels = useMemo(() => dashData?.channels || [], [dashData?.channels]);
  const hasNoChannelsAdded = allChannelIds.length === 0;

  const totalViews = channels.reduce((sum, ch) => sum + Number(ch?.statistics?.viewCount || 0), 0);
  const totalSubscribers = channels.reduce((sum, ch) => sum + Number(ch?.statistics?.subscriberCount || 0), 0);
  const totalVideos = channels.reduce((sum, ch) => sum + Number(ch?.statistics?.videoCount || 0), 0);

  const perChannelAnalytics = dashData?.perChannelAnalytics || {};
  const perChannelEntries = Object.values(perChannelAnalytics);

  let curEstRevenue = sumRevenueMetric(dashData?.currentRevenue, "estimatedRevenue");
  let curAdRevenue = sumRevenueMetric(dashData?.currentRevenue, "estimatedAdRevenue");
  let curGrossRevenue = sumRevenueMetric(dashData?.currentRevenue, "grossRevenue");
  let prevEstRevenue = sumRevenueMetric(dashData?.prevRevenue, "estimatedRevenue");
  let prevAdRevenue = sumRevenueMetric(dashData?.prevRevenue, "estimatedAdRevenue");
  let prevGrossRevenue = sumRevenueMetric(dashData?.prevRevenue, "grossRevenue");

  for (const pca of perChannelEntries) {
    // Prefer revenueViews (flat total) for estimatedRevenue — most accurate for any date range
    const curRevFromViews = sumRevenueMetric(pca.revenueViews, "estimatedRevenue");
    curEstRevenue += curRevFromViews || sumRevenueMetric(pca.revenue, "estimatedRevenue");
    curAdRevenue += sumRevenueMetric(pca.revenue, "estimatedAdRevenue");
    curGrossRevenue += sumRevenueMetric(pca.revenue, "grossRevenue");
    prevEstRevenue += sumRevenueMetric(pca.prevRevenue, "estimatedRevenue");
    prevAdRevenue += sumRevenueMetric(pca.prevRevenue, "estimatedAdRevenue");
    prevGrossRevenue += sumRevenueMetric(pca.prevRevenue, "grossRevenue");
  }

  // Premium Revenue = non-ad revenue (YouTube Premium, Super Chat, etc.)
  const curPremiumRevenue = Math.max(0, curEstRevenue - curAdRevenue);
  const prevPremiumRevenue = Math.max(0, prevEstRevenue - prevAdRevenue);

  let curViews = sumMetric(dashData?.currentPerformance, "views");
  let prevViews = sumMetric(dashData?.prevPerformance, "views");
  let curSubs = sumMetric(dashData?.currentPerformance, "subscribersGained") - sumMetric(dashData?.currentPerformance, "subscribersLost");
  let prevSubs = sumMetric(dashData?.prevPerformance, "subscribersGained") - sumMetric(dashData?.prevPerformance, "subscribersLost");
  let curLikes = sumMetric(dashData?.currentPerformance, "likes");
  let prevLikes = sumMetric(dashData?.prevPerformance, "likes");
  let curWatchTime = sumMetric(dashData?.currentPerformance, "estimatedMinutesWatched");
  let prevWatchTime = sumMetric(dashData?.prevPerformance, "estimatedMinutesWatched");

  for (const pca of perChannelEntries) {
    curViews += sumMetric(pca.performance, "views");
    prevViews += sumMetric(pca.prevPerformance, "views");
    curSubs += sumMetric(pca.performance, "subscribersGained") - sumMetric(pca.performance, "subscribersLost");
    prevSubs += sumMetric(pca.prevPerformance, "subscribersGained") - sumMetric(pca.prevPerformance, "subscribersLost");
    curLikes += sumMetric(pca.performance, "likes");
    prevLikes += sumMetric(pca.prevPerformance, "likes");
    curWatchTime += sumMetric(pca.performance, "estimatedMinutesWatched");
    prevWatchTime += sumMetric(pca.prevPerformance, "estimatedMinutesWatched");
  }

  const curCPM = curViews > 0 ? (curEstRevenue / curViews) * 1000 : 0;
  const prevCPM = prevViews > 0 ? (prevEstRevenue / prevViews) * 1000 : 0;
  const curRPM = curViews > 0 ? (curEstRevenue / curViews) * 1000 : 0;
  const prevRPM = prevViews > 0 ? (prevEstRevenue / prevViews) * 1000 : 0;

  const channelCount = channels.length || 1;
  const curRevenuePerChannel = curEstRevenue / channelCount;
  const prevRevenuePerChannel = prevEstRevenue / (channelCount || 1);

  const curVideosPublished = sumMetric(dashData?.currentPerformance, "videosPublished") || sumMetric(dashData?.currentPerformance, "videos");
  const prevVideosPerf = sumMetric(dashData?.prevPerformance, "videosPublished") || sumMetric(dashData?.prevPerformance, "videos");

  const adminDailyData = getDailyRevenueChartData(dashData?.dailyRevenue);
  const perChannelDailyDataArrays = perChannelEntries
    .map((pca) => getDailyRevenueChartData(pca.dailyRevenue))
    .filter((d) => d.length > 0);

  let dailyRevenueData = adminDailyData;
  if (perChannelDailyDataArrays.length > 0) {
    const dailyMap: Record<string, number> = {};
    for (const d of adminDailyData) {
      const key = d.fullDate || d.date;
      dailyMap[key] = (dailyMap[key] || 0) + d.revenue;
    }
    for (const arr of perChannelDailyDataArrays) {
      for (const d of arr) {
        const key = d.fullDate || d.date;
        dailyMap[key] = (dailyMap[key] || 0) + d.revenue;
      }
    }
    dailyRevenueData = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fullDate, revenue]) => ({ date: fullDate.length > 5 ? fullDate.slice(5) : fullDate, fullDate, revenue: Math.round(revenue * 100) / 100 }));
  }

  const avgDailyRevenue = dailyRevenueData.length > 0
    ? dailyRevenueData.reduce((s, d) => s + d.revenue, 0) / dailyRevenueData.length
    : 0;

  // Per-Channel Daily Revenue table data with selected date range support
  const perChannelDailyRevenue = useMemo(() => {
    const perChannel = dashData?.perChannelAnalytics || {};
    const channelList = dashData?.channels || [];
    const channelNameMap: Record<string, string> = {};
    for (const ch of channelList) {
      if (ch.id) channelNameMap[ch.id] = ch.snippet?.title || ch.id;
    }

    const result: { channelId: string; channelName: string; dailyMap: Record<string, number>; monthTotal: number }[] = [];
    const allFullDates = new Set<string>();

    // Use selected date range for filtering (not hardcoded current month)
    const filterStart = dateRange.startDate;
    const filterEnd = dateRange.endDate;

    for (const [cid, pca] of Object.entries(perChannel)) {
      const daily = getDailyRevenueChartData(pca.dailyRevenue);
      const dailyMap: Record<string, number> = {};
      let monthTotal = 0;
      for (const d of daily) {
        const key = d.fullDate || d.date;
        dailyMap[key] = d.revenue;
        allFullDates.add(key);
        // Sum revenue within the selected date range
        if (d.fullDate && d.fullDate >= filterStart && d.fullDate <= filterEnd) {
          monthTotal += d.revenue;
        }
      }
      result.push({
        channelId: cid,
        channelName: channelNameMap[cid] || cid,
        dailyMap,
        monthTotal,
      });
    }

    const sortedDates = Array.from(allFullDates).sort((a, b) => b.localeCompare(a));
    let filteredDates: string[];
    if (dailyRevDays === 30) {
      // Show dates within the selected range only
      filteredDates = sortedDates.filter((d) => d >= filterStart && d <= filterEnd);
    } else if (dailyRevDays === "all") {
      filteredDates = sortedDates;
    } else {
      filteredDates = sortedDates.slice(0, dailyRevDays);
    }

    // Label based on selected date range
    const startD = new Date(filterStart + "T00:00:00");
    const periodLabel = startD.toLocaleString("en-US", { month: "short", year: "numeric" });

    return { channels: result, dates: filteredDates, currentMonthName: periodLabel };
  }, [dashData, dailyRevDays, dateRange]);

  // Top videos
  const topVideos = isReal ? (dashData?.topVideos?.videos || []) : [];
  const topVideoAnalytics = dashData?.topVideos?.analytics;
  const videoAnalyticsMap: Record<string, { views: number; likes: number; subs: number; revenue: number }> = {};
  if (topVideoAnalytics?.rows && topVideoAnalytics.columnHeaders) {
    const headers = topVideoAnalytics.columnHeaders.map((h) => h.name || "");
    const videoIdx = headers.indexOf("video");
    const viewsIdx = headers.indexOf("views");
    const likesIdx = headers.indexOf("likes");
    const subsIdx = headers.indexOf("subscribersGained");
    const revIdx = headers.indexOf("estimatedRevenue");
    for (const row of topVideoAnalytics.rows) {
      const videoId = String(row[videoIdx]);
      videoAnalyticsMap[videoId] = {
        views: viewsIdx !== -1 ? Number(row[viewsIdx]) || 0 : 0,
        likes: likesIdx !== -1 ? Number(row[likesIdx]) || 0 : 0,
        subs: subsIdx !== -1 ? Number(row[subsIdx]) || 0 : 0,
        revenue: revIdx !== -1 ? Number(row[revIdx]) || 0 : 0,
      };
    }
  }

  const hasAnalyticsRevenue = Object.values(videoAnalyticsMap).some((v) => v.revenue > 0);
  const videosSortedByRevenue = [...topVideos]
    .map((v) => ({ ...v, analyticsRevenue: videoAnalyticsMap[v.id || ""]?.revenue || 0 }))
    .sort((a, b) => hasAnalyticsRevenue ? b.analyticsRevenue - a.analyticsRevenue : Number(b.statistics?.viewCount || 0) - Number(a.statistics?.viewCount || 0))
    .slice(0, 5);
  const videosSortedByViews = [...topVideos]
    .map((v) => ({ ...v, analyticsViews: videoAnalyticsMap[v.id || ""]?.views || Number(v.statistics?.viewCount || 0) }))
    .sort((a, b) => b.analyticsViews - a.analyticsViews)
    .slice(0, 5);
  const videosSortedBySubs = [...topVideos]
    .map((v) => ({ ...v, analyticsSubs: videoAnalyticsMap[v.id || ""]?.subs || 0 }))
    .sort((a, b) => b.analyticsSubs - a.analyticsSubs)
    .slice(0, 5);

  const channelRevenueMap = useMemo(() => dashData?.channelRevenueMap || {}, [dashData?.channelRevenueMap]);
  const lastDayRevenue = dashData?.lastDayRevenue || 0;
  const lastDayDate = dashData?.lastDayDate || "";

  const curRevenueChannels = Object.values(channelRevenueMap).filter((info) => info.revenue > 0).length;

  const channelsSortedByRevenue = [...channels]
    .map((ch) => ({
      ...ch,
      channelRevenue: channelRevenueMap[ch.id || ""]?.revenue || 0,
    }))
    .sort((a, b) => b.channelRevenue - a.channelRevenue)
    .slice(0, 5);

  const channelsSortedByRPM = [...channels]
    .map((ch) => {
      const revInfo = channelRevenueMap[ch.id || ""];
      const views = Number(ch.statistics?.viewCount || 0);
      const rpm = revInfo ? revInfo.rpm : (views > 0 && curEstRevenue > 0 ? (curEstRevenue / views) * 1000 : 0);
      return { ...ch, channelRPM: rpm };
    })
    .sort((a, b) => b.channelRPM - a.channelRPM)
    .slice(0, 5);

  const channelsSortedByVideos = [...channels]
    .map((ch) => ({
      ...ch,
      totalVideos: Number(ch.statistics?.videoCount || 0),
    }))
    .sort((a, b) => b.totalVideos - a.totalVideos)
    .slice(0, 5);

  const displayStart = dateRange.startDate.split("-").reverse().join("-");
  const displayEnd = dateRange.endDate.split("-").reverse().join("-");

  const handleDateChange = (preset: string, range: DateRange) => {
    setDatePreset(preset);
    setDateRange(range);
    // Auto-show all dates when month is selected
    if (/^\d{4}-\d{2}$/.test(preset)) {
      setDailyRevDays("all");
    }
  };

  // Month-wise Revenue Excel Download
  const handleMonthRevenueExcel = () => {
    const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const startD = new Date(dateRange.startDate + "T00:00:00");
    const monthName = MONTH_NAMES[startD.getMonth()];
    const year = startD.getFullYear();
    const reportTitle = `Channel Revenue Report ${monthName} ${year}`;

    const headers = ["Channel Name", "Channel Link", "Revenue ($)", `Revenue (INR @ ${INR_RATE})`];
    const rows: string[][] = [];
    for (const ch of channels) {
      const revInfo = channelRevenueMap[ch.id || ""];
      const revenue = revInfo?.revenue || 0;
      rows.push([
        `"${(ch.snippet?.title || "Unknown").replace(/"/g, '""')}"`,
        `https://www.youtube.com/channel/${ch.id || ""}`,
        revenue.toFixed(2),
        (revenue * INR_RATE).toFixed(2),
      ]);
    }
    // Add totals
    const totalRev = rows.reduce((s, r) => s + Number(r[2]), 0);
    rows.push([`"TOTAL"`, "", totalRev.toFixed(2), (totalRev * INR_RATE).toFixed(2)]);

    const titleRow = `"${reportTitle}",,,""`; 
    const csv = [titleRow, "", headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Channel_Revenue_Report_${monthName}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Realtime 48-hour data
  const [realtime48, setRealtime48] = useState<{
    views: number; subscribers: number; watchTime: number; revenue: number;
    dailyBreakdown: Array<{ date: string; views: number; subscribers: number; watchTime: number; revenue: number }>;
    disabled?: boolean; message?: string;
  } | null>(null);
  const [realtime48Loading, setRealtime48Loading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || allChannelIds.length === 0) return;
    queueMicrotask(() => {
      setRealtime48Loading(true);
      fetch(`/api/youtube?action=realtime48&channelIds=${allChannelIds.join(",")}`)
        .then(res => res.json())
        .then(data => { if (data.data) setRealtime48(data.data); })
        .catch(() => {})
        .finally(() => setRealtime48Loading(false));
    });
  }, [isAuthenticated, allChannelIds]);

  return (
    <div className="space-y-5 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          {isAuthenticated && allChannelIds.length > 0 && (
            <p className="text-xs text-muted mt-0.5">
              Showing data for {allChannelIds.length} assigned channel{allChannelIds.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated && isReal && (
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200">
              <Wifi className="w-3.5 h-3.5" />
              Live YouTube Data
            </div>
          )}
          {isAuthenticated && loading && (
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading...
            </div>
          )}
          {!isAuthenticated && (
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <WifiOff className="w-3.5 h-3.5" />
              Sign in to see data
            </div>
          )}
          <button
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg text-muted hover:bg-slate-50 transition-colors"
            title="Share dashboard"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>
      </div>

      {dashCached && dashLastUpdated && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>Showing cached data — Last updated: {new Date(dashLastUpdated).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
      )}

      {/* Not authenticated */}
      {!isAuthenticated && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted">Loading dashboard...</p>
          </div>
        </div>
      )}

      {isAuthenticated && loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted">Loading your YouTube data...</p>
          </div>
        </div>
      )}

      {isAuthenticated && !loading && hasNoChannelsAdded && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No Channels Added</h3>
            <p className="text-sm text-muted mb-4">
              Dashboard sirf added channels ka data dikhata hai. Pehle Channels section mein channels add karo.
            </p>
            <a
              href="/channels"
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors inline-block"
            >
              Go to Channels
            </a>
          </div>
        </div>
      )}

      {isAuthenticated && !loading && !hasNoChannelsAdded && !isReal && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <WifiOff className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Could Not Load Data</h3>
            <p className="text-sm text-muted mb-4">{error || "YouTube API returned no data. Please try again."}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
              <a
                href="/channels"
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
              >
                Review Channel Authorization
              </a>
            </div>
          </div>
        </div>
      )}

      {isAuthenticated && !loading && !hasNoChannelsAdded && isReal && (
        <>
          {/* ===== NOTE ===== */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-700">
            <span className="font-semibold shrink-0">Note:</span>
            <span>All date ranges end at {displayEnd} (today minus 3 days) due to YouTube&apos;s data reporting delay.</span>
          </div>

          {/* ===== REALTIME 48 HOURS ===== */}
          {realtime48 && !realtime48.disabled && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <h3 className="text-sm font-bold text-purple-800">Last 48 Hours (Realtime)</h3>
                {realtime48Loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />}
              </div>
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
                  {INR_RATE > 0 && <p className="text-xs text-muted">≈ ₹{toINR(realtime48.revenue, INR_RATE).toFixed(0)}</p>}
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
            </div>
          )}
          {realtime48?.disabled && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <h3 className="text-sm font-bold text-amber-800">Realtime 48 Hours — Admin Approval Required</h3>
              </div>
              <p className="text-sm text-amber-700">
                Realtime analytics is currently <strong>OFF</strong> for your account. Admin must enable it before you can view last 48 hours data for your channels. Please contact admin to turn ON realtime access.
              </p>
            </div>
          )}

          {/* ===== DATE RANGE FILTER + DOWNLOAD ===== */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <DateRangeFilter value={datePreset} onChange={handleDateChange} />
            <button
              onClick={handleMonthRevenueExcel}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Revenue Excel
            </button>
          </div>

          {/* ===== COMBINED DASHBOARD OVERVIEW ===== */}
          <div className="relative bg-slate-50 rounded-xl border border-border p-5">
            {loading && (
              <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Dashboard Overview
              <span className="text-xs font-normal text-muted ml-2">
                ({channels.length} channel{channels.length !== 1 ? "s" : ""} | {dateRange.label}: {displayStart} to {displayEnd})
              </span>
            </h3>

            {/* Row 1: Revenue Metrics (5 columns) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
              <MetricCard
                title="Estimated Revenue"
                value={formatCurrency(curEstRevenue)}
                change={pctChange(curEstRevenue, prevEstRevenue)}
                tooltip="Estimated revenue in selected period"
                color="#f59e0b"
              />
              <MetricCard
                title="Ad Revenue"
                value={formatCurrency(curAdRevenue)}
                change={pctChange(curAdRevenue, prevAdRevenue)}
                tooltip="Ad revenue in selected period"
                color="#3b82f6"
              />
              <MetricCard
                title="Premium Revenue"
                value={formatCurrency(curPremiumRevenue)}
                change={pctChange(curPremiumRevenue, prevPremiumRevenue)}
                tooltip="YouTube Premium revenue in selected period"
                color="#22c55e"
              />
              <MetricCard
                title="Revenue (INR)"
                value={`₹${formatNumber(Math.round(curEstRevenue * INR_RATE))}`}
                tooltip={`Estimated revenue in INR (1 USD = ₹${INR_RATE})${rateLastFetched ? ` | Updated: ${rateLastFetched}` : ""}. Total: $${curEstRevenue.toFixed(2)} × ${INR_RATE}`}
                color="#f59e0b"
              />
              <MetricCard
                title="Revenue Per Channel"
                value={formatCurrency(curRevenuePerChannel)}
                change={pctChange(curRevenuePerChannel, prevRevenuePerChannel)}
                tooltip="Average revenue per channel in selected period"
                color="#f97316"
              />
            </div>

            {/* Row 2: Performance Metrics (5 columns) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
              <MetricCard
                title="Avg CPM"
                value={formatCurrency(curCPM)}
                change={pctChange(curCPM, prevCPM)}
                tooltip="Average CPM in selected period"
                color="#8b5cf6"
              />
              <MetricCard
                title="Avg RPM"
                value={formatCurrency(curRPM)}
                change={pctChange(curRPM, prevRPM)}
                tooltip="Average RPM in selected period"
                color="#ec4899"
              />
              <MetricCard
                title="Total Channels"
                value={String(channelCount)}
                tooltip="Number of YouTube channels linked"
                color="#06b6d4"
              />
              <MetricCard
                title="Revenue Channels"
                value={String(curRevenueChannels)}
                tooltip="Channels with revenue > $0 in selected period"
                color="#22c55e"
              />
              <MetricCard
                title="Videos"
                value={formatNumber(curVideosPublished || totalVideos)}
                change={pctChange(curVideosPublished || totalVideos, prevVideosPerf || totalVideos)}
                tooltip="Total videos in selected period"
                color="#84cc16"
              />
            </div>

            {/* Row 3: Engagement Metrics (5 columns) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
              <MetricCard
                title="Views"
                value={formatNumber(curViews || totalViews)}
                change={pctChange(curViews, prevViews)}
                tooltip="Total views in selected period"
                color="#eab308"
              />
              <MetricCard
                title="Subscribers"
                value={formatNumber(curSubs || totalSubscribers)}
                change={pctChange(curSubs, prevSubs)}
                tooltip="Subscribers in selected period"
                color="#14b8a6"
              />
              <MetricCard
                title="Likes"
                value={formatNumber(curLikes)}
                change={pctChange(curLikes, prevLikes)}
                tooltip="Total likes in selected period"
                color="#ef4444"
              />
              <MetricCard
                title="Watch Time (hrs)"
                value={formatNumber(Math.round(curWatchTime / 60))}
                change={pctChange(curWatchTime, prevWatchTime)}
                tooltip="Total watch time in hours for selected period"
                color="#6366f1"
              />
              <MetricCard
                title="Last Day Revenue"
                value={formatCurrency(lastDayRevenue)}
                tooltip={lastDayDate ? `Revenue on ${lastDayDate}` : "Last day revenue"}
                color="#0ea5e9"
              />
            </div>

            {/* Last Day Revenue */}
            {lastDayRevenue > 0 && (
              <div className="mt-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">Last Day Revenue</span>
                    {lastDayDate && (
                      <span className="text-xs text-amber-600">({lastDayDate})</span>
                    )}
                  </div>
                  <span className="text-lg font-bold text-amber-700">{formatCurrency(lastDayRevenue)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ===== PER-CHANNEL DAILY REVENUE TABLE (moved above Top 5) ===== */}
          {perChannelDailyRevenue.channels.length > 0 && perChannelDailyRevenue.dates.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-5 max-w-full overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-sm">Per-Channel Daily Revenue</h3>
                <div className="flex items-center gap-1.5">
                  {([1, 3, 7, 30, "all"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDailyRevDays(d)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        dailyRevDays === d
                          ? "bg-primary text-white"
                          : "bg-slate-100 text-muted hover:bg-slate-200"
                      }`}
                    >
                      {d === 1 ? "Latest" : d === 30 ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][new Date().getMonth()] : d === "all" ? "All" : `${d} Days`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-medium text-muted text-xs">Channel</th>
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
                          <td className="py-2 pr-4 text-foreground font-medium truncate max-w-[200px]" title={ch.channelName}>{ch.channelName}</td>
                          {perChannelDailyRevenue.dates.map((date) => (
                            <td key={date} className="text-right py-2 px-2 text-muted tabular-nums">
                              ${(ch.dailyMap[date] || 0).toFixed(2)}
                            </td>
                          ))}
                          <td className="text-right py-2 px-2 font-semibold text-amber-700 tabular-nums">
                            ${ch.monthTotal.toFixed(2)}
                          </td>
                          <td className="text-right py-2 pl-3 font-semibold text-foreground tabular-nums">${total.toFixed(2)}</td>
                          <td className="text-right py-2 pl-3 font-semibold text-amber-600 tabular-nums">₹{formatNumber(Math.round(total * INR_RATE))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-slate-50">
                      <td className="py-2 pr-4 font-bold text-foreground">Total</td>
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
                            <td className="text-right py-2 pl-3 font-bold text-primary tabular-nums">
                              ${grandTotal.toFixed(2)}
                            </td>
                            <td className="text-right py-2 pl-3 font-bold text-amber-600 tabular-nums">
                              ₹{formatNumber(Math.round(grandTotal * INR_RATE))}
                            </td>
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

          {/* ===== REVENUE TREND CHART ===== */}
          {dailyRevenueData.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-sm">Revenue Trend</h3>
                <span className="text-xs text-muted">{dateRange.label}</span>
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyRevenueData.filter((d) => { const fd = d.fullDate || ""; return fd >= dateRange.startDate && fd <= dateRange.endDate; })}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
                    />
                    <ReferenceLine
                      y={avgDailyRevenue}
                      stroke="#94a3b8"
                      strokeDasharray="5 5"
                      label={{ value: `Avg: $${avgDailyRevenue.toFixed(2)}`, fill: "#64748b", fontSize: 11, position: "right" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ===== TOP 5 VIDEO LEADERBOARDS ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top 5 by Revenue */}
            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-500" />
                Top 5 Videos by Revenue
              </h3>
              {!hasAnalyticsRevenue && videosSortedByRevenue.length > 0 && (
                <p className="text-xs text-amber-600 mb-1">Showing by views (revenue data unavailable)</p>
              )}
              <div className="space-y-2">
                {videosSortedByRevenue.length > 0 ? videosSortedByRevenue.map((video, i) => {
                  const thumbnail = video.snippet?.thumbnails?.default?.url || "";
                  return (
                    <div key={video.id || i} className="flex items-center gap-3 py-1.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-muted"}`}>
                        {i + 1}
                      </span>
                      {thumbnail && <img src={thumbnail} alt="" className="w-8 h-8 rounded-full object-cover" />}
                      <span className="flex-1 text-sm text-foreground truncate">{video.snippet?.title || "Untitled"}</span>
                      <span className="text-sm font-semibold text-amber-600">{hasAnalyticsRevenue ? formatCurrency(video.analyticsRevenue) : formatNumber(Number(video.statistics?.viewCount || 0)) + " views"}</span>
                    </div>
                  );
                }) : (
                  <p className="text-xs text-muted py-4 text-center">No video data available</p>
                )}
              </div>
            </div>

            {/* Top 5 by Views */}
            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-500" />
                Top 5 Videos by Views
              </h3>
              <div className="space-y-2">
                {videosSortedByViews.length > 0 ? videosSortedByViews.map((video, i) => {
                  const thumbnail = video.snippet?.thumbnails?.default?.url || "";
                  return (
                    <div key={video.id || i} className="flex items-center gap-3 py-1.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-muted"}`}>
                        {i + 1}
                      </span>
                      {thumbnail && <img src={thumbnail} alt="" className="w-8 h-8 rounded-full object-cover" />}
                      <span className="flex-1 text-sm text-foreground truncate">{video.snippet?.title || "Untitled"}</span>
                      <span className="text-sm font-semibold text-foreground">{formatNumber(video.analyticsViews)}</span>
                    </div>
                  );
                }) : (
                  <p className="text-xs text-muted py-4 text-center">No video data available</p>
                )}
              </div>
            </div>

            {/* Top 5 by Subscriber Gain */}
            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-green-500" />
                Top 5 Videos by Subscriber Gain
              </h3>
              <div className="space-y-2">
                {videosSortedBySubs.length > 0 ? videosSortedBySubs.map((video, i) => {
                  const thumbnail = video.snippet?.thumbnails?.default?.url || "";
                  return (
                    <div key={video.id || i} className="flex items-center gap-3 py-1.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-muted"}`}>
                        {i + 1}
                      </span>
                      {thumbnail && <img src={thumbnail} alt="" className="w-8 h-8 rounded-full object-cover" />}
                      <span className="flex-1 text-sm text-foreground truncate">{video.snippet?.title || "Untitled"}</span>
                      <span className="text-sm font-semibold text-foreground">{formatNumber(video.analyticsSubs)}</span>
                    </div>
                  );
                }) : (
                  <p className="text-xs text-muted py-4 text-center">No subscriber data available</p>
                )}
              </div>
            </div>
          </div>

          {/* ===== TOP 5 CHANNEL LEADERBOARDS (clickable) ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Top 5 Channels by Revenue Generated */}
            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-500" />
                Top 5 Channels by Revenue
              </h3>
              <div className="space-y-2">
                {channelsSortedByRevenue.length > 0 ? channelsSortedByRevenue.map((ch, i) => {
                  const thumbnail = ch.snippet?.thumbnails?.default?.url || "";
                  return (
                    <div
                      key={ch.id || i}
                      className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-slate-50 rounded-lg px-1 -mx-1 transition-colors"
                      onClick={() => setSelectedChannel(ch)}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-muted"}`}>
                        {i + 1}
                      </span>
                      {thumbnail && <img src={thumbnail} alt="" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />}
                      <span className="flex-1 text-sm text-foreground truncate">{ch.snippet?.title || "Unknown"}</span>
                      <span className="text-sm font-semibold text-amber-600">{formatCurrency(ch.channelRevenue)}</span>
                    </div>
                  );
                }) : (
                  <p className="text-xs text-muted py-4 text-center">No revenue data available</p>
                )}
              </div>
            </div>

            {/* Top 5 Channels by RPM */}
            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                Top 5 Channels by RPM
              </h3>
              <div className="space-y-2">
                {channelsSortedByRPM.length > 0 ? channelsSortedByRPM.map((ch, i) => {
                  const thumbnail = ch.snippet?.thumbnails?.default?.url || "";
                  return (
                    <div
                      key={ch.id || i}
                      className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-slate-50 rounded-lg px-1 -mx-1 transition-colors"
                      onClick={() => setSelectedChannel(ch)}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-muted"}`}>
                        {i + 1}
                      </span>
                      {thumbnail && <img src={thumbnail} alt="" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />}
                      <span className="flex-1 text-sm text-foreground truncate">{ch.snippet?.title || "Unknown"}</span>
                      <span className="text-sm font-semibold text-purple-600">{formatCurrency(ch.channelRPM)}</span>
                    </div>
                  );
                }) : (
                  <p className="text-xs text-muted py-4 text-center">No RPM data available</p>
                )}
              </div>
            </div>

            {/* Top 5 Channels by Videos Published */}
            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <Video className="w-4 h-4 text-red-500" />
                Top 5 Channels by Videos Published
              </h3>
              <div className="space-y-2">
                {channelsSortedByVideos.length > 0 ? channelsSortedByVideos.map((ch, i) => {
                  const thumbnail = ch.snippet?.thumbnails?.default?.url || "";
                  return (
                    <div
                      key={ch.id || i}
                      className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-slate-50 rounded-lg px-1 -mx-1 transition-colors"
                      onClick={() => setSelectedChannel(ch)}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-muted"}`}>
                        {i + 1}
                      </span>
                      {thumbnail && <img src={thumbnail} alt="" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />}
                      <span className="flex-1 text-sm text-foreground truncate">{ch.snippet?.title || "Unknown"}</span>
                      <span className="text-sm font-semibold text-red-600">{formatNumber(ch.totalVideos)} videos</span>
                    </div>
                  );
                }) : (
                  <p className="text-xs text-muted py-4 text-center">No channels found</p>
                )}
              </div>
            </div>
          </div>

          {/* ===== TOP VIDEOS TABLE ===== */}
          {topVideos.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Top Performing Videos</h3>
                <a href="/videos" className="text-sm text-accent hover:underline">View all</a>
              </div>
              <div className="space-y-3">
                {topVideos.slice(0, 10).map((video, index) => {
                  const analyticsRow = videoAnalyticsMap[video.id || ""];
                  const views = analyticsRow?.views || Number(video.statistics?.viewCount || 0);
                  const likes = analyticsRow?.likes || Number(video.statistics?.likeCount || 0);
                  const comments = Number(video.statistics?.commentCount || 0);
                  const thumbnail = video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || "";

                  return (
                    <div
                      key={video.id || index}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-sm font-bold text-muted w-6">{index + 1}</span>
                      <div className="w-24 h-14 bg-slate-200 rounded-lg overflow-hidden shrink-0">
                        {thumbnail && <img src={thumbnail} alt={video.snippet?.title || ""} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{video.snippet?.title || "Untitled"}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-muted flex items-center gap-1">
                            <Play className="w-3 h-3" />{formatNumber(views)}
                          </span>
                          <span className="text-xs text-muted flex items-center gap-1">
                            <ThumbsUp className="w-3 h-3" />{formatNumber(likes)}
                          </span>
                          <span className="text-xs text-muted flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />{formatNumber(comments)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Channel Health Scores */}
      {channels.length > 0 && channelRevenueMap && (() => {
        const healthData = channels.map((ch) => {
          const revInfo = channelRevenueMap[ch.id || ""];
          const prevPca = perChannelAnalytics[ch.id || ""];
          const prevRevRaw = prevPca?.prevRevenue as { rows?: unknown[][]; columnHeaders?: Array<{ name?: string | null }> } | null | undefined;
          let prevRev = 0;
          if (prevRevRaw?.rows?.length && prevRevRaw.columnHeaders) {
            const hd = prevRevRaw.columnHeaders.map((h) => h.name || "");
            const ri = hd.indexOf("estimatedRevenue");
            if (ri !== -1) prevRev = prevRevRaw.rows.reduce((s, r) => s + (Number(r[ri]) || 0), 0);
          }
          return {
            channelName: ch.snippet?.title || ch.id || "",
            thumbnail: ch.snippet?.thumbnails?.default?.url || undefined,
            currentRevenue: revInfo?.revenue || 0,
            previousRevenue: prevRev,
            currentViews: revInfo?.views || Number(ch.statistics?.viewCount || 0),
            previousViews: 0,
            subscribers: Number(ch.statistics?.subscriberCount || 0),
            subscriberChange: 0,
            videoCount: Number(ch.statistics?.videoCount || 0),
          };
        }).filter((h) => h.currentRevenue > 0 || h.subscribers > 0);
        if (healthData.length === 0) return null;
        return <ChannelHealthSummary channels={healthData} />;
      })()}

      {/* Revenue Comparison Chart */}
      {channels.length > 1 && channelRevenueMap && (() => {
        const compData = channels.map((ch) => ({
          channelName: ch.snippet?.title || ch.id || "",
          currentRevenue: channelRevenueMap[ch.id || ""]?.revenue || 0,
          previousRevenue: 0,
        })).filter((c) => c.currentRevenue > 0);
        if (compData.length < 2) return null;
        return <RevenueComparisonChart channels={compData} currentLabel="Current Period" previousLabel="Previous Period" />;
      })()}

      {/* Channel Detail Modal */}
      {selectedChannel && (() => {
        const chId = selectedChannel.id || "";
        const chPca = perChannelAnalytics[chId];
        const chDailyData = chPca ? getDailyRevenueChartData(chPca.dailyRevenue) : [];
        const chRevInfo = channelRevenueMap[chId];

        // Compute per-month revenue from daily data
        const monthlyRevMap: Record<string, number> = {};
        for (const d of chDailyData) {
          if (d.fullDate) {
            const monthKey = d.fullDate.slice(0, 7); // "YYYY-MM"
            monthlyRevMap[monthKey] = (monthlyRevMap[monthKey] || 0) + d.revenue;
          }
        }
        const sortedMonths = Object.keys(monthlyRevMap).sort((a, b) => b.localeCompare(a));
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        // Compute revenue for selected period
        let modalRevenue = chRevInfo?.revenue || 0;
        let modalLabel = dateRange.label;
        if (channelModalPeriod !== "current" && channelModalPeriod.match(/^\d{4}-\d{2}$/)) {
          modalRevenue = monthlyRevMap[channelModalPeriod] || 0;
          const [y, m] = channelModalPeriod.split("-").map(Number);
          modalLabel = `${monthNames[m - 1]} ${y}`;
        } else if (channelModalPeriod === "28d") {
          // Sum last 28 days from daily data
          const last28 = chDailyData.slice(-28);
          modalRevenue = last28.reduce((s, d) => s + d.revenue, 0);
          modalLabel = "Last 28 Days";
        } else if (channelModalPeriod === "3m") {
          // Sum last 3 months
          const now = new Date();
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          const prefix = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, "0")}`;
          modalRevenue = chDailyData.filter((d) => d.fullDate && d.fullDate >= prefix).reduce((s, d) => s + d.revenue, 0);
          modalLabel = "Last 3 Months";
        }
        const modalRPM = chRevInfo && chRevInfo.views > 0 ? (modalRevenue / chRevInfo.views) * 1000 : 0;

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Channel Analysis</h2>
                <button onClick={() => { setSelectedChannel(null); setChannelModalPeriod("current"); }} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  {selectedChannel.snippet?.thumbnails?.default?.url && (
                    <img src={selectedChannel.snippet.thumbnails.default.url} alt="" className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                  )}
                  <div>
                    <h3 className="font-semibold text-foreground">{selectedChannel.snippet?.title || "Unknown"}</h3>
                    <p className="text-xs text-muted">{chId}</p>
                  </div>
                </div>

                {/* Period filter */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <button
                    onClick={() => setChannelModalPeriod("current")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${channelModalPeriod === "current" ? "bg-primary text-white" : "bg-slate-100 text-muted hover:bg-slate-200"}`}
                  >
                    {dateRange.label}
                  </button>
                  <button
                    onClick={() => setChannelModalPeriod("28d")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${channelModalPeriod === "28d" ? "bg-primary text-white" : "bg-slate-100 text-muted hover:bg-slate-200"}`}
                  >
                    28 Days
                  </button>
                  <button
                    onClick={() => setChannelModalPeriod("3m")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${channelModalPeriod === "3m" ? "bg-primary text-white" : "bg-slate-100 text-muted hover:bg-slate-200"}`}
                  >
                    3 Months
                  </button>
                  {sortedMonths.slice(0, 6).map((mk) => {
                    const [y, m] = mk.split("-").map(Number);
                    return (
                      <button
                        key={mk}
                        onClick={() => setChannelModalPeriod(mk)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${channelModalPeriod === mk ? "bg-primary text-white" : "bg-slate-100 text-muted hover:bg-slate-200"}`}
                      >
                        {monthNames[m - 1]} {y}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-muted mb-1">Subscribers</p>
                    <p className="text-lg font-bold text-foreground">{formatNumber(Number(selectedChannel.statistics?.subscriberCount || 0))}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-muted mb-1">Total Views</p>
                    <p className="text-lg font-bold text-foreground">{formatNumber(Number(selectedChannel.statistics?.viewCount || 0))}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-muted mb-1">Videos</p>
                    <p className="text-lg font-bold text-foreground">{formatNumber(Number(selectedChannel.statistics?.videoCount || 0))}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-muted mb-1">Revenue ({modalLabel})</p>
                    <p className="text-lg font-bold text-amber-600">{formatCurrency(modalRevenue)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-muted mb-1">RPM</p>
                    <p className="text-lg font-bold text-purple-600">{formatCurrency(channelModalPeriod === "current" ? (chRevInfo?.rpm || 0) : modalRPM)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-muted mb-1">Revenue (INR)</p>
                    <p className="text-lg font-bold text-amber-600">₹{formatNumber(Math.round(modalRevenue * INR_RATE))}</p>
                  </div>
                </div>

                {/* Monthly Revenue Breakdown */}
                {sortedMonths.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="text-xs font-semibold text-muted mb-2">Monthly Revenue</h4>
                    <div className="space-y-1.5">
                      {sortedMonths.map((mk) => {
                        const [y, m] = mk.split("-").map(Number);
                        const rev = monthlyRevMap[mk] || 0;
                        return (
                          <div key={mk} className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{monthNames[m - 1]} {y}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-amber-600">{formatCurrency(rev)}</span>
                              <span className="text-xs text-muted">₹{formatNumber(Math.round(rev * INR_RATE))}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-border">
                  <a
                    href={`https://www.youtube.com/channel/${chId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View on YouTube →
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
