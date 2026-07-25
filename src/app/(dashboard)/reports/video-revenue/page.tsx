"use client";

import { useState, useMemo } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { formatNumber } from "@/lib/utils";
import { useYouTubeData } from "@/lib/hooks/useYouTubeData";
import RevenueShareExport from "@/components/features/RevenueShareExport";

interface VideoItem {
  id?: string | null;
  snippet?: {
    title?: string | null;
    thumbnails?: {
      default?: { url?: string | null } | null;
    } | null;
    publishedAt?: string | null;
  } | null;
  statistics?: {
    viewCount?: string | null;
    likeCount?: string | null;
  } | null;
}

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

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

export default function VideoRevenuePage() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && !!session?.user?.email;

  const { data: videos, isReal, loading } = useYouTubeData<VideoItem[]>("videos", {}, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState("28d");

  const filteredVideos = useMemo(() => {
    if (!searchQuery) return videos;
    const q = searchQuery.toLowerCase();
    return videos.filter((v) =>
      (v.snippet?.title || "").toLowerCase().includes(q)
    );
  }, [videos, searchQuery]);

  const totalPages = Math.ceil(filteredVideos.length / perPage);
  const pageVideos = filteredVideos.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span>Reports</span>
        <span>›</span>
        <span className="text-foreground font-medium">Video Revenue</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Video Revenue</h1>
          <p className="text-sm text-muted mt-1">Revenue breakdown by individual videos.</p>
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
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search videos..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="border border-border rounded-lg px-3 py-2 text-sm"
          >
            {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
          {filteredVideos.length > 0 && (() => {
            const monthLabel = getMonthOptions().find((m) => m.value === dateRange)?.label;
            const monthName = monthLabel || dateRange;
            const exportHeaders = ["Month", "Title", "Views", "Likes", "Published"];
            const exportRows = filteredVideos.map((v) => [
              monthName,
              v.snippet?.title || "",
              Number(v.statistics?.viewCount || 0),
              Number(v.statistics?.likeCount || 0),
              v.snippet?.publishedAt ? new Date(v.snippet.publishedAt).toLocaleDateString() : "-",
            ] as (string | number)[]);
            const exportFilename = monthLabel ? `${monthLabel.replace(" ", "-")}-Video-Revenue-Report` : "video-revenue-report";
            return (
              <RevenueShareExport
                baseHeaders={exportHeaders}
                baseRows={exportRows}
                filename={exportFilename}
                csvTitle={`Video Revenue Report - ${monthName}`}
                sheetName="Video Revenue"
                totalRevenue={0}
                exchangeRate={1}
              />
            );
          })()}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted">Loading videos...</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">Video</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Views</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Likes</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Published</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Est. Revenue</th>
              </tr>
            </thead>
            <tbody>
              {pageVideos.map((video) => (
                <tr key={video.id} className="border-b border-border hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-9 rounded overflow-hidden bg-slate-200 shrink-0">
                        {video.snippet?.thumbnails?.default?.url && (
                          <img
                            src={video.snippet.thumbnails.default.url}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                      <span className="font-medium text-foreground line-clamp-2">{video.snippet?.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {formatNumber(Number(video.statistics?.viewCount || 0))}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {formatNumber(Number(video.statistics?.likeCount || 0))}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {video.snippet?.publishedAt
                      ? new Date(video.snippet.publishedAt).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">--</td>
                </tr>
              ))}
              {pageVideos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">
                    {loading ? "Loading..." : "No videos found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50">
            <p className="text-sm text-muted">
              Showing {(currentPage - 1) * perPage + 1} to{" "}
              {Math.min(currentPage * perPage, filteredVideos.length)} of {filteredVideos.length}
            </p>
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-border disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
