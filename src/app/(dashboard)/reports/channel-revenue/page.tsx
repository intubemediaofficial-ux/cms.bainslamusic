"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  Wifi,
  WifiOff,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { useYouTubeData } from "@/lib/hooks/useYouTubeData";
import { useExchangeRate } from "@/lib/hooks/useExchangeRate";
import RevenueShareExport from "@/components/features/RevenueShareExport";

interface ChannelRevenueInfo {
  revenue: number;
  views: number;
  rpm: number;
}

interface YouTubeChannel {
  id?: string | null;
  snippet?: {
    title?: string | null;
    thumbnails?: {
      default?: { url?: string | null } | null;
      medium?: { url?: string | null } | null;
    } | null;
  } | null;
  statistics?: {
    subscriberCount?: string | null;
    videoCount?: string | null;
    viewCount?: string | null;
  } | null;
}

interface DashboardData {
  channels?: YouTubeChannel[];
  channelRevenueMap?: Record<string, ChannelRevenueInfo>;
}

function getMonthOptions() {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    months.push({ value, label });
  }
  return months;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDateRange(range: string) {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);

  // Check if it's a month range (YYYY-MM format)
  if (/^\d{4}-\d{2}$/.test(range)) {
    const [year, month] = range.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0); // last day of month
    // Don't go beyond yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const effectiveEnd = monthEnd > yesterday ? yesterday : monthEnd;
    return {
      startDate: fmtDate(monthStart),
      endDate: fmtDate(effectiveEnd),
    };
  }

  switch (range) {
    case "7d": start.setDate(start.getDate() - 7); break;
    case "28d": start.setDate(start.getDate() - 28); break;
    case "90d": start.setDate(start.getDate() - 90); break;
    case "365d": start.setDate(start.getDate() - 365); break;
  }
  return {
    startDate: fmtDate(start),
    endDate: fmtDate(end),
  };
}

export default function ChannelRevenuePage() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && !!session?.user?.email;

  const [activeChannelIds, setActiveChannelIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState("28d");
  const { rate: INR_RATE } = useExchangeRate("USD");

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/users?action=channelScope", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => setActiveChannelIds(json.data?.channelIds || []))
      .catch(() => setActiveChannelIds([]));
  }, [isAuthenticated, session?.user?.email]);

  const dates = getDateRange(dateRange);

  const isMonthRange = /^\d{4}-\d{2}$/.test(dateRange);

  const apiParams = useMemo(() => ({
    startDate: dates.startDate,
    endDate: dates.endDate,
    prevStartDate: dates.startDate,
    prevEndDate: dates.endDate,
    ...(isMonthRange ? { monthly: dateRange } : {}),
    ...(activeChannelIds.length > 0 ? { channelIds: activeChannelIds.join(",") } : {}),
  }), [dates.startDate, dates.endDate, activeChannelIds, isMonthRange, dateRange]);

  const { data: dashData, isReal, loading } = useYouTubeData<DashboardData>("dashboardFull", apiParams, {});

  const channels = dashData?.channels || [];
  const channelRevenueMap = dashData?.channelRevenueMap || {};

  const totalRevenue = Object.values(channelRevenueMap).reduce((s, r) => s + r.revenue, 0);
  const totalViews = channels.reduce((s, ch) => s + Number(ch.statistics?.viewCount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span>Reports</span>
        <span>&rsaquo;</span>
        <span className="text-foreground font-medium">Channel Revenue</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Channel Revenue</h1>
          <p className="text-sm text-muted mt-1">Revenue breakdown by channel with RPM.</p>
        </div>
        <div className="flex items-center gap-3">
          {isReal && (
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200">
              <Wifi className="w-3.5 h-3.5" />
              Live Data
            </div>
          )}
          {!isAuthenticated && (
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <WifiOff className="w-3.5 h-3.5" />
              Sign in to see data
            </div>
          )}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="28d">Last 28 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">Last 365 days</option>
            <optgroup label="By Month">
              {getMonthOptions().map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </optgroup>
          </select>
          {channels.length > 0 && (() => {
            const monthLabel = getMonthOptions().find((m) => m.value === dateRange)?.label;
            const monthName = monthLabel || dateRange;
            const exportHeaders = ["Month", "Channel", "Channel Link", "Subscribers", "Videos", "Views", "Est. Revenue ($)", "Revenue (INR)", "RPM ($)"];
            const exportRows = channels.map((ch) => {
              const revInfo = channelRevenueMap[ch.id || ""];
              const rev = revInfo ? revInfo.revenue : 0;
              return [
                monthName,
                ch.snippet?.title || "",
                `https://www.youtube.com/channel/${ch.id || ""}`,
                Number(ch.statistics?.subscriberCount || 0),
                Number(ch.statistics?.videoCount || 0),
                Number(ch.statistics?.viewCount || 0),
                rev.toFixed(2),
                Math.round(rev * INR_RATE).toString(),
                revInfo ? revInfo.rpm.toFixed(2) : "0.00",
              ] as (string | number)[];
            });
            const exportFilename = monthLabel ? `${monthLabel.replace(" ", "-")}-Channel-Revenue-Report` : "channel-revenue-report";
            return (
              <RevenueShareExport
                baseHeaders={exportHeaders}
                baseRows={exportRows}
                filename={exportFilename}
                csvTitle={`Channel Revenue Report - ${monthName}`}
                sheetName="Channel Revenue"
                totalRevenue={totalRevenue}
                exchangeRate={INR_RATE}
                pdfOptions={{
                  title: "Channel Revenue Report",
                  period: monthName,
                  channels: channels.map((ch) => {
                    const revInfo = channelRevenueMap[ch.id || ""];
                    const rev = revInfo ? revInfo.revenue : 0;
                    return {
                      channelName: ch.snippet?.title || "",
                      subscribers: Number(ch.statistics?.subscriberCount || 0),
                      views: Number(ch.statistics?.viewCount || 0),
                      videos: Number(ch.statistics?.videoCount || 0),
                      revenue: rev,
                      revenueINR: Math.round(rev * INR_RATE),
                      rpm: revInfo?.rpm || 0,
                    };
                  }),
                  totalRevenue,
                  totalRevenueINR: Math.round(totalRevenue * INR_RATE),
                  totalSubscribers: channels.reduce((s, c) => s + Number(c.statistics?.subscriberCount || 0), 0),
                  totalViews: channels.reduce((s, c) => s + Number(c.statistics?.viewCount || 0), 0),
                  exchangeRate: INR_RATE,
                  generatedBy: session?.user?.email || "User",
                }}
              />
            );
          })()}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Total Est. Revenue</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Avg. RPM</p>
              <p className="text-xl font-bold text-foreground">
                ${totalViews > 0 ? ((totalRevenue / totalViews) * 1000).toFixed(2) : "0.00"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted">Loading channel revenue data...</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">Channel</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Subscribers</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Videos</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Views</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Est. Revenue</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Revenue (INR)</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">RPM</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => {
                const revInfo = channelRevenueMap[ch.id || ""];
                const revenue = revInfo?.revenue || 0;
                const rpm = revInfo?.rpm || 0;

                return (
                  <tr key={ch.id} className="border-b border-border hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 shrink-0">
                          {(ch.snippet?.thumbnails?.default?.url || ch.snippet?.thumbnails?.medium?.url) && (
                            <img
                              src={ch.snippet?.thumbnails?.default?.url || ch.snippet?.thumbnails?.medium?.url || ""}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          )}
                        </div>
                        <span className="font-medium text-foreground">{ch.snippet?.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">{formatNumber(Number(ch.statistics?.subscriberCount || 0))}</td>
                    <td className="px-4 py-3 text-right text-foreground">{Number(ch.statistics?.videoCount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatNumber(Number(ch.statistics?.viewCount || 0))}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${revenue > 0 ? "text-green-600" : "text-muted"}`}>
                        {revenue > 0 ? formatCurrency(revenue) : "$0.00"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${revenue > 0 ? "text-amber-600" : "text-muted"}`}>
                        ₹{formatNumber(Math.round(revenue * INR_RATE))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`${rpm > 0 ? "text-foreground" : "text-muted"}`}>
                        ${rpm > 0 ? rpm.toFixed(2) : "0.00"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {channels.length > 1 && (
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-3 text-foreground">Total ({channels.length} channels)</td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {formatNumber(channels.reduce((s, ch) => s + Number(ch.statistics?.subscriberCount || 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {channels.reduce((s, ch) => s + Number(ch.statistics?.videoCount || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {formatNumber(totalViews)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">
                    {formatCurrency(totalRevenue)}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-600 font-bold">
                    ₹{formatNumber(Math.round(totalRevenue * INR_RATE))}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    ${totalViews > 0 ? ((totalRevenue / totalViews) * 1000).toFixed(2) : "0.00"}
                  </td>
                </tr>
              )}
              {channels.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    No channels found. Add channels first to see revenue data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
