"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ExternalLink,
  Search,
  Wifi,
  WifiOff,
  Loader2,
  RotateCcw,
  Unlink,
  ChevronLeft,
  ChevronRight,
  RotateCw,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { formatNumber } from "@/lib/utils";
import { readStoredChannels, writeStoredChannels } from "@/lib/channel-storage";

interface StoredChannel {
  id: string;
  category: string;
  channelType?: string;
  tokenStatus?: string;
  cms?: string;
  addedDate: string;
  delinkedDate?: string;
  status: "active" | "delinked" | "transferred" | "pending_approval";
}

interface YouTubeChannel {
  id?: string | null;
  snippet?: {
    title?: string | null;
    customUrl?: string | null;
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

const PER_PAGE_OPTIONS = [10, 25, 50, 100];
const CATEGORIES = ["Music", "Entertainment"];


type ChannelRow = {
  id: string;
  name: string;
  thumbnail: string;
  subscribers: number;
  videos: number;
  views: number;
  category: string;
  addedDate: string;
  delinkedDate: string;
};

export default function DelinkedChannelsPage() {
  const { data: session, status } = useSession();
  const storageIdentity = session?.user?.email;
  const isAuthenticated = status === "authenticated";

  const [storedChannels, setStoredChannels] = useState<StoredChannel[]>([]);
  const [channelDataMap, setChannelDataMap] = useState<Record<string, YouTubeChannel>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!storageIdentity) return;
    queueMicrotask(() => {
      setStoredChannels(readStoredChannels<StoredChannel>(storageIdentity));
      setChannelDataMap({});
    });
  }, [storageIdentity]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const delinked = storedChannels.filter((c) => c.status === "delinked");
    const idsToFetch = delinked.map((c) => c.id).filter((id) => !channelDataMap[id]);
    if (idsToFetch.length === 0) return;

    const fetchChannels = async () => {
      setLoadingData(true);
      for (const id of idsToFetch) {
        try {
          const res = await fetch(`/api/youtube?action=lookupChannel&query=${encodeURIComponent(id)}`);
          const json = await res.json();
          if (res.ok && json.data?.length) {
            setChannelDataMap((prev) => ({ ...prev, [id]: json.data[0] }));
          }
        } catch {
          // skip
        }
      }
      setLoadingData(false);
    };
    fetchChannels();
  }, [isAuthenticated, storedChannels, channelDataMap]);

  const handleRelink = async (channelId: string) => {
    const updated = storedChannels.map((channel) =>
      channel.id === channelId
        ? { ...channel, status: "pending_approval" as const, delinkedDate: undefined }
        : channel
    );
    writeStoredChannels(storageIdentity, updated);
    setStoredChannels(updated);

    const response = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channels: updated.filter((channel) => channel.status === "active").map((channel) => channel.id),
        pendingChannels: updated.filter((channel) => channel.status === "pending_approval").map((channel) => channel.id),
      }),
    });
    const json = await response.json();
    if (!response.ok || json.data?.rejectedChannels?.includes(channelId)) {
      const reverted = updated.filter((channel) => channel.id !== channelId);
      writeStoredChannels(storageIdentity, reverted);
      setStoredChannels(reverted);
      window.alert(json.error || "This channel cannot be relinked to this account.");
    }
  };

  const handleRemove = (channelId: string) => {
    const updated = storedChannels.filter((c) => c.id !== channelId);
    writeStoredChannels(storageIdentity, updated);
    setStoredChannels(updated);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("");
    setCurrentPage(1);
  };

  const delinkedRows: ChannelRow[] = useMemo(() => {
    const delinked = storedChannels.filter((c) => c.status === "delinked");
    return delinked.map((sc) => {
      const data = channelDataMap[sc.id];
      return {
        id: sc.id,
        name: data?.snippet?.title || sc.id,
        thumbnail: data?.snippet?.thumbnails?.medium?.url || data?.snippet?.thumbnails?.default?.url || "",
        subscribers: Number(data?.statistics?.subscriberCount || 0),
        videos: Number(data?.statistics?.videoCount || 0),
        views: Number(data?.statistics?.viewCount || 0),
        category: sc.category,
        addedDate: sc.addedDate,
        delinkedDate: sc.delinkedDate || "-",
      };
    });
  }, [storedChannels, channelDataMap]);

  const filteredChannels = useMemo(() => {
    let result = delinkedRows;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
      );
    }

    if (categoryFilter) {
      result = result.filter((c) => c.category === categoryFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "subscribers": cmp = a.subscribers - b.subscribers; break;
        case "videos": cmp = a.videos - b.videos; break;
        case "views": cmp = a.views - b.views; break;
        case "category": cmp = a.category.localeCompare(b.category); break;
        default: cmp = a.name.localeCompare(b.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [delinkedRows, searchQuery, categoryFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredChannels.length / perPage);
  const pageChannels = filteredChannels.slice((currentPage - 1) * perPage, currentPage * perPage);

  const renderSortIcon = (field: string) => (
    <svg
      className={`w-3 h-3 ml-1 inline cursor-pointer ${sortField === field ? "text-primary" : "text-gray-400"}`}
      onClick={() => handleSort(field)}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    >
      <path d={sortDir === "desc" && sortField === field ? "M7 14l5 5 5-5" : "M7 10l5-5 5 5"} />
    </svg>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <span>Channels</span>
        <span>›</span>
        <span className="text-foreground font-medium">Delinked Channels</span>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
            <Unlink className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-red-600 font-medium">Delinked Channels</p>
            <p className="text-2xl font-bold text-red-900">{delinkedRows.length}</p>
            <p className="text-xs text-red-500">Channels removed from active list</p>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-3">
        {isAuthenticated && (
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
              placeholder="Search channels by name..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors px-3 py-2 border border-border rounded-lg"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-sm text-muted">
            Total Delinked: <span className="font-semibold text-red-600">{filteredChannels.length}</span>
          </p>
        </div>
      </div>

      {/* Loading */}
      {loadingData && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted">Loading channels...</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">
                  Channel {renderSortIcon("name")}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">
                  Subscribers {renderSortIcon("subscribers")}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">
                  Videos {renderSortIcon("videos")}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">
                  Views {renderSortIcon("views")}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">
                  Category {renderSortIcon("category")}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                  Linked Date
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                  Delinked Date
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                  Report Period
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {pageChannels.map((channel) => (
                <tr key={channel.id} className="border-b border-border hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 shrink-0">
                        {channel.thumbnail ? (
                          <img
                            src={channel.thumbnail}
                            alt={channel.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-red-100 flex items-center justify-center text-red-500 font-bold text-sm">
                            {channel.name[0]}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">{channel.name}</span>
                          <a
                            href={`https://www.youtube.com/channel/${channel.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View on YouTube"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-red-500 hover:text-red-600" />
                          </a>
                        </div>
                        <p className="text-xs text-muted">{channel.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{formatNumber(channel.subscribers)}</td>
                  <td className="px-4 py-3 text-foreground">{channel.videos.toLocaleString()}</td>
                  <td className="px-4 py-3 text-foreground">{formatNumber(channel.views)}</td>
                  <td className="px-4 py-3 text-foreground">{channel.category}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{channel.addedDate}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{channel.delinkedDate}</td>
                  <td className="px-4 py-3">
                    {channel.delinkedDate !== "-" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 whitespace-nowrap">
                        {(() => {
                          const parts = channel.delinkedDate.split("/");
                          if (parts.length === 3) {
                            const delinked = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                            const threeMonthsBefore = new Date(delinked);
                            threeMonthsBefore.setMonth(threeMonthsBefore.getMonth() - 3);
                            return `${threeMonthsBefore.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — ${delinked.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
                          }
                          return "N/A";
                        })()}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      Delinked
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRelink(channel.id)}
                        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium px-2 py-1 rounded hover:bg-green-50 transition-colors"
                        title="Re-link channel"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        Relink
                      </button>
                      <button
                        onClick={() => handleRemove(channel.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pageChannels.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted">
                    {loadingData ? "Loading..." : "No delinked channels"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50">
            <p className="text-sm text-muted">
              Showing {(currentPage - 1) * perPage + 1} to {Math.min(currentPage * perPage, filteredChannels.length)} of {filteredChannels.length} results
            </p>
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border disabled:opacity-50 hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? "bg-primary text-white"
                        : "hover:bg-white border border-border"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-border disabled:opacity-50 hover:bg-white transition-colors"
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
