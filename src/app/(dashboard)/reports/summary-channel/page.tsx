"use client";

import { Loader2, Wifi, WifiOff } from "lucide-react";
import { useSession } from "next-auth/react";
import { formatNumber } from "@/lib/utils";
import { useYouTubeData } from "@/lib/hooks/useYouTubeData";
import RevenueShareExport from "@/components/features/RevenueShareExport";

interface YouTubeChannel {
  id?: string | null;
  snippet?: {
    title?: string | null;
    thumbnails?: {
      default?: { url?: string | null } | null;
    } | null;
  } | null;
  statistics?: {
    subscriberCount?: string | null;
    videoCount?: string | null;
    viewCount?: string | null;
  } | null;
}

export default function SummaryChannelPage() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && !!session?.user?.email;
  const { data: channels, isReal, loading } = useYouTubeData<YouTubeChannel[]>("channels", {}, []);

  const totalSubs = channels.reduce((s, c) => s + Number(c.statistics?.subscriberCount || 0), 0);
  const totalViews = channels.reduce((s, c) => s + Number(c.statistics?.viewCount || 0), 0);
  const totalVideos = channels.reduce((s, c) => s + Number(c.statistics?.videoCount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span>Reports</span>
        <span>›</span>
        <span className="text-foreground font-medium">Summary Channel</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Summary Channel Report</h1>
          <p className="text-sm text-muted mt-1">Overview of all channels performance.</p>
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
          {channels.length > 0 && (() => {
            const now = new Date();
            const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });
            const exportHeaders = ["Month", "Channel", "Subscribers", "Videos", "Views"];
            const exportRows = channels.map((ch) => [
              monthName,
              ch.snippet?.title || "",
              Number(ch.statistics?.subscriberCount || 0),
              Number(ch.statistics?.videoCount || 0),
              Number(ch.statistics?.viewCount || 0),
            ] as (string | number)[]);
            const exportFilename = `${monthName.replace(" ", "-")}-Summary-Channel-Report`;
            return (
              <RevenueShareExport
                baseHeaders={exportHeaders}
                baseRows={exportRows}
                filename={exportFilename}
                csvTitle={`Summary Channel Report - ${monthName}`}
                sheetName="Summary"
                totalRevenue={0}
                exchangeRate={1}
              />
            );
          })()}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-border p-5 text-center">
          <p className="text-sm text-muted">Total Channels</p>
          <p className="text-3xl font-bold text-foreground mt-1">{channels.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-5 text-center">
          <p className="text-sm text-muted">Total Subscribers</p>
          <p className="text-3xl font-bold text-foreground mt-1">{formatNumber(totalSubs)}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-5 text-center">
          <p className="text-sm text-muted">Total Views</p>
          <p className="text-3xl font-bold text-foreground mt-1">{formatNumber(totalViews)}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-5 text-center">
          <p className="text-sm text-muted">Total Videos</p>
          <p className="text-3xl font-bold text-foreground mt-1">{formatNumber(totalVideos)}</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">#</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Channel</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Subscribers</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Videos</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Views</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch, i) => (
                <tr key={ch.id} className="border-b border-border hover:bg-slate-50">
                  <td className="px-4 py-3 text-muted">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 shrink-0">
                        {ch.snippet?.thumbnails?.default?.url && (
                          <img src={ch.snippet.thumbnails.default.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        )}
                      </div>
                      <span className="font-medium text-foreground">{ch.snippet?.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{formatNumber(Number(ch.statistics?.subscriberCount || 0))}</td>
                  <td className="px-4 py-3 text-foreground">{Number(ch.statistics?.videoCount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-foreground">{formatNumber(Number(ch.statistics?.viewCount || 0))}</td>
                </tr>
              ))}
              {channels.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">No channels found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
