"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Play,
  ThumbsUp,
  Download,
  Eye,
  Loader2,
  AlertCircle,
  Globe,
  Lock,
  EyeOff,
  X,
  DollarSign,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  RefreshCw,
  Users,
  Video,
  Copy,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/utils";

interface ClientUser {
  id: string;
  name: string;
  email: string;
  channels: string[];
  status: "active" | "inactive";
}

interface VideoItem {
  id?: string | null;
  snippet?: {
    title?: string | null;
    description?: string | null;
    channelId?: string | null;
    channelTitle?: string | null;
    publishedAt?: string | null;
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
  contentDetails?: {
    duration?: string | null;
    licensedContent?: boolean | null;
  } | null;
  status?: {
    privacyStatus?: string | null;
    uploadStatus?: string | null;
    license?: string | null;
    rejectionReason?: string | null;
  } | null;
}

interface VideoClaim {
  videoId: string;
  channelId: string;
  claimType: "copyright" | "content_id" | "manual";
  claimant: string;
  status: "active" | "released" | "disputed";
  notes: string;
  createdBy: string;
  createdDate: string;
  updatedDate: string;
}

function parseDuration(isoDuration: string | null | undefined): string {
  if (!isoDuration) return "-";
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "-";
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type MonetizationFilter = "all" | "monetized" | "not_monetized" | "copyright_claim" | "content_id_claim" | "no_claim";

function getMonetizationStatus(video: VideoItem, claims: VideoClaim[]): {
  isMonetized: boolean;
  hasActiveClaim: boolean;
  claimType: string | null;
  claimant: string | null;
  label: string;
  color: string;
} {
  const activeClaims = claims.filter(
    (c) => c.videoId === video.id && c.status === "active"
  );
  const hasManualClaim = activeClaims.length > 0;

  // Manual claims from admin take priority
  if (hasManualClaim) {
    const claim = activeClaims[0];
    const typeLabel = claim.claimType === "copyright" ? "Copyright Claim" :
                      claim.claimType === "content_id" ? "Content ID Claim" : "Manual Claim";
    return {
      isMonetized: false,
      hasActiveClaim: true,
      claimType: claim.claimType,
      claimant: claim.claimant,
      label: typeLabel,
      color: "bg-red-100 text-red-700",
    };
  }

  // Auto-detect copyright rejection from YouTube API
  const rejectionReason = video.status?.rejectionReason;
  if (rejectionReason === "copyright" || rejectionReason === "duplicate") {
    return {
      isMonetized: false,
      hasActiveClaim: true,
      claimType: "copyright",
      claimant: "YouTube Auto-Detected",
      label: "Copyright Claim",
      color: "bg-red-100 text-red-700",
    };
  }

  // licensedContent = true means video contains licensed content (e.g. licensed music)
  // This does NOT mean there is an active claim — just that content is licensed
  const isLicensed = video.contentDetails?.licensedContent === true;
  if (isLicensed) {
    return {
      isMonetized: true,
      hasActiveClaim: false,
      claimType: null,
      claimant: null,
      label: "Licensed Content",
      color: "bg-blue-100 text-blue-700",
    };
  }

  return {
    isMonetized: true,
    hasActiveClaim: false,
    claimType: null,
    claimant: null,
    label: "No Claim",
    color: "bg-green-100 text-green-700",
  };
}

interface DuplicateGroup {
  title: string;
  count: number;
  videos: VideoItem[];
  sameCount: number;
}

interface ChannelDuplicateGroup {
  channelId: string;
  channelName: string;
  groups: DuplicateGroup[];
  totalDuplicates: number;
}

function parseDurationSeconds(isoDuration: string | null | undefined): number {
  if (!isoDuration) return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || "0") * 3600 + parseInt(match[2] || "0") * 60 + parseInt(match[3] || "0");
}

export default function AdminVideosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [claims, setClaims] = useState<VideoClaim[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [monetizationFilter, setMonetizationFilter] = useState<MonetizationFilter>("all");
  const [privacyFilter, setPrivacyFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const VIDEOS_PER_PAGE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  const channelOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of videos) {
      const cid = v.snippet?.channelId;
      const cname = v.snippet?.channelTitle;
      if (cid && !map.has(cid)) map.set(cid, cname || cid);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [videos]);

  // Duplicate detector
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedDupVideos, setSelectedDupVideos] = useState<Set<string>>(new Set());
  const [dupPrivacyFilter, setDupPrivacyFilter] = useState<string>("all");
  const [dupChannelFilter, setDupChannelFilter] = useState<string>("all");
  const [dupDeleting, setDupDeleting] = useState(false);

  // Add claim modal
  const [showAddClaim, setShowAddClaim] = useState(false);
  const [claimVideoId, setClaimVideoId] = useState("");
  const [claimChannelId, setClaimChannelId] = useState("");
  const [claimType, setClaimType] = useState<"copyright" | "content_id" | "manual">("copyright");
  const [claimant, setClaimant] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [savingClaim, setSavingClaim] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const json = await res.json();
        setClients(json.data || []);
      }
    } catch { /* silent */ }
    finally { setLoadingClients(false); }
  }, []);

  const fetchClaims = useCallback(async () => {
    try {
      const res = await fetch("/api/video-claims");
      if (res.ok) {
        const json = await res.json();
        setClaims(json.data || []);
      }
    } catch { /* silent */ }
  }, []);

  const [videoCacheTime, setVideoCacheTime] = useState<string | null>(null);

  const fetchVideosForChannels = useCallback(async (channelIds: string[]) => {
    if (channelIds.length === 0) {
      setVideos([]);
      return;
    }
    setLoadingVideos(true);
    setVideoCacheTime(null);
    try {
      let latestCacheTime: string | null = null;
      let anyFromCache = false;
      const results = await Promise.allSettled(
        channelIds.map((channelId) =>
          Promise.race([
            fetch(`/api/youtube?action=videos&channelId=${encodeURIComponent(channelId)}`)
              .then((r) => r.json())
              .then((j) => {
                if (j._cached && j._lastUpdated) {
                  anyFromCache = true;
                  if (!latestCacheTime || j._lastUpdated > latestCacheTime) latestCacheTime = j._lastUpdated;
                }
                return (j.data || []) as VideoItem[];
              }),
            new Promise<VideoItem[]>((_, reject) => setTimeout(() => reject(new Error("timeout")), 30000))
          ])
        )
      );
      const allVideos: VideoItem[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") allVideos.push(...r.value);
      }
      setVideos(allVideos);
      if (anyFromCache && latestCacheTime) setVideoCacheTime(latestCacheTime);
    } catch { /* silent */ }
    setLoadingVideos(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "admin") {
      fetchClients();
      fetchClaims();
    }
  }, [status, session, fetchClients, fetchClaims]);

  // Also fetch real channel IDs from cached data (in case KV has test IDs)
  const [cachedChannelIds, setCachedChannelIds] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/client-data?action=getAllCachedData")
      .then((r) => r.json())
      .then((j) => {
        const ids: string[] = [];
        for (const cd of (j.data || [])) {
          for (const ch of (cd.channels || [])) {
            if (ch.channelId && !ch.channelId.startsWith("UCtest")) {
              ids.push(ch.channelId);
            }
          }
        }
        setCachedChannelIds(ids);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedClient === "all") {
      const kvChannels = clients.reduce<string[]>((acc, c) => [...acc, ...c.channels], []);
      // Merge KV channels + cached channels (dedup), skip test IDs
      const allSet = new Set([...kvChannels, ...cachedChannelIds].filter((id) => !id.startsWith("UCtest") && id !== "test"));
      fetchVideosForChannels(Array.from(allSet));
    } else {
      const client = clients.find((c) => c.id === selectedClient);
      fetchVideosForChannels(client?.channels || []);
    }
  }, [selectedClient, clients, cachedChannelIds, fetchVideosForChannels]);

  // Pre-compute privacy counts (based on channel filter only) for dropdown labels
  const privacyCounts = useMemo(() => {
    const channelVids = videos.filter((v) =>
      channelFilter === "all" || v.snippet?.channelId === channelFilter
    );
    let pub = 0, priv = 0, unlist = 0;
    for (const v of channelVids) {
      const p = (v.status?.privacyStatus || "public").toLowerCase();
      if (p === "private") priv++;
      else if (p === "unlisted") unlist++;
      else pub++;
    }
    return { all: channelVids.length, public: pub, private: priv, unlisted: unlist };
  }, [videos, channelFilter]);

  const filteredVideos = useMemo(() => {
    const result: VideoItem[] = [];
    for (const video of videos) {
      // Channel filter
      if (channelFilter !== "all" && video.snippet?.channelId !== channelFilter) continue;

      // Search filter
      const title = video.snippet?.title || "";
      if (searchQuery && !title.toLowerCase().includes(searchQuery.toLowerCase())) continue;

      // Privacy filter - strict comparison
      if (privacyFilter !== "all") {
        const rawPrivacy = video.status?.privacyStatus;
        const videoPrivacy = rawPrivacy ? rawPrivacy.toLowerCase() : "public";
        if (videoPrivacy !== privacyFilter) continue;
      }

      // Monetization filter
      if (monetizationFilter !== "all") {
        const mStatus = getMonetizationStatus(video, claims);
        if (monetizationFilter === "monetized" && !(mStatus.isMonetized && !mStatus.hasActiveClaim)) continue;
        if (monetizationFilter === "not_monetized" && mStatus.isMonetized) continue;
        if (monetizationFilter === "copyright_claim" && !mStatus.hasActiveClaim) continue;
        if (monetizationFilter === "content_id_claim" && !(mStatus.hasActiveClaim && mStatus.claimType === "content_id")) continue;
        if (monetizationFilter === "no_claim" && mStatus.hasActiveClaim) continue;
      }

      result.push(video);
    }
    return result;
  }, [videos, searchQuery, monetizationFilter, privacyFilter, channelFilter, claims]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, privacyFilter, monetizationFilter, channelFilter, selectedClient]);

  const totalPages = Math.ceil(filteredVideos.length / VIDEOS_PER_PAGE);
  const paginatedVideos = useMemo(() => {
    const start = (currentPage - 1) * VIDEOS_PER_PAGE;
    return filteredVideos.slice(start, start + VIDEOS_PER_PAGE);
  }, [filteredVideos, currentPage]);

  const claimStats = useMemo(() => {
    let copyrightClaims = 0;
    let contentIdClaims = 0;
    let monetized = 0;
    let publicCount = 0;
    let privateCount = 0;
    let unlistedCount = 0;
    let draftCount = 0;
    for (const v of filteredVideos) {
      const s = getMonetizationStatus(v, claims);
      if (s.claimType === "copyright") copyrightClaims++;
      else if (s.claimType === "content_id") contentIdClaims++;
      if (s.isMonetized && !s.hasActiveClaim) monetized++;
      const privacy = v.status?.privacyStatus?.toLowerCase() || "public";
      if (privacy === "public") publicCount++;
      else if (privacy === "private") privateCount++;
      else if (privacy === "unlisted") unlistedCount++;
      else draftCount++;
    }
    return { total: filteredVideos.length, copyrightClaims, contentIdClaims, monetized, publicCount, privateCount, unlistedCount, draftCount };
  }, [filteredVideos, claims]);

  // Duplicate video detection — channel-wise
  const channelDuplicateGroups = useMemo((): ChannelDuplicateGroup[] => {
    if (videos.length === 0) return [];
    const channelMap = new Map<string, { name: string; videos: VideoItem[] }>();
    for (const v of videos) {
      const cid = v.snippet?.channelId || "unknown";
      const cname = v.snippet?.channelTitle || cid;
      if (!channelMap.has(cid)) channelMap.set(cid, { name: cname, videos: [] });
      channelMap.get(cid)!.videos.push(v);
    }
    const result: ChannelDuplicateGroup[] = [];
    for (const [cid, { name, videos: chVids }] of channelMap) {
      const titleMap = new Map<string, VideoItem[]>();
      for (const v of chVids) {
        const title = (v.snippet?.title || "").trim().toLowerCase();
        if (!title) continue;
        if (!titleMap.has(title)) titleMap.set(title, []);
        titleMap.get(title)!.push(v);
      }
      const groups: DuplicateGroup[] = [];
      for (const [, vids] of titleMap) {
        if (vids.length < 2) continue;
        const durationMap = new Map<number, VideoItem[]>();
        for (const v of vids) {
          const dur = parseDurationSeconds(v.contentDetails?.duration);
          let found = false;
          for (const [existDur, existVids] of durationMap) {
            if (Math.abs(dur - existDur) <= 2) { existVids.push(v); found = true; break; }
          }
          if (!found) durationMap.set(dur, [v]);
        }
        const sameDurCount = Array.from(durationMap.values()).filter((arr) => arr.length > 1).reduce((s, arr) => s + arr.length, 0);
        groups.push({ title: vids[0].snippet?.title || "", count: vids.length, videos: vids, sameCount: sameDurCount });
      }
      if (groups.length > 0) {
        result.push({ channelId: cid, channelName: name, groups: groups.sort((a, b) => b.count - a.count), totalDuplicates: groups.reduce((s, g) => s + g.count, 0) });
      }
    }
    return result.sort((a, b) => b.totalDuplicates - a.totalDuplicates);
  }, [videos]);

  const duplicateGroups = useMemo((): DuplicateGroup[] => channelDuplicateGroups.flatMap((cg) => cg.groups), [channelDuplicateGroups]);

  const handleDupBulkDelete = async () => {
    if (selectedDupVideos.size === 0) return;
    if (!confirm(`Delete ${selectedDupVideos.size} duplicate video(s)? This cannot be undone.`)) return;
    setDupDeleting(true);
    const videosToDelete = videos.filter((v) => v.id && selectedDupVideos.has(v.id)).map((v) => ({ videoId: v.id!, channelId: v.snippet?.channelId || "" }));
    try {
      const res = await fetch("/api/youtube/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bulkDelete", videos: videosToDelete }) });
      const data = await res.json();
      if (res.ok) {
        const successIds = new Set(data.data.results.filter((r: { success: boolean }) => r.success).map((r: { videoId: string }) => r.videoId));
        setVideos(videos.filter((v) => !successIds.has(v.id!)));
        setSelectedDupVideos(new Set());
      }
    } catch { /* silent */ }
    finally { setDupDeleting(false); }
  };

  const toggleDupSelect = (videoId: string) => {
    setSelectedDupVideos((prev) => { const next = new Set(prev); if (next.has(videoId)) next.delete(videoId); else next.add(videoId); return next; });
  };

  const handleAddClaim = async () => {
    if (!claimVideoId || !claimChannelId) return;
    setSavingClaim(true);
    try {
      const res = await fetch("/api/video-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: claimVideoId,
          channelId: claimChannelId,
          claimType,
          claimant,
          notes: claimNotes,
        }),
      });
      if (res.ok) {
        await fetchClaims();
        setShowAddClaim(false);
        setClaimVideoId("");
        setClaimChannelId("");
        setClaimant("");
        setClaimNotes("");
      }
    } catch { /* silent */ }
    finally { setSavingClaim(false); }
  };

  const handleAddClaimForVideo = (video: VideoItem) => {
    setClaimVideoId(video.id || "");
    setClaimChannelId(video.snippet?.channelId || "");
    setShowAddClaim(true);
  };

  const handleReleaseClaim = async (videoId: string, claimantName: string) => {
    try {
      await fetch("/api/video-claims", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, claimant: claimantName, status: "released" }),
      });
      await fetchClaims();
    } catch { /* silent */ }
  };

  const handleDeleteClaim = async (videoId: string, claimantName: string) => {
    try {
      await fetch(`/api/video-claims?videoId=${videoId}&claimant=${encodeURIComponent(claimantName)}`, {
        method: "DELETE",
      });
      await fetchClaims();
    } catch { /* silent */ }
  };

  const handleExportCSV = () => {
    const headers = ["Video URL", "Video Title", "Channel", "Privacy", "Claim Status", "Claim Type", "Claimant / CMS", "Views", "Likes", "Comments", "Duration", "Published Date"];
    const rows = filteredVideos.map((v) => {
      const mStatus = getMonetizationStatus(v, claims);
      const videoUrl = v.id ? `https://www.youtube.com/watch?v=${v.id}` : "";
      return [
        videoUrl,
        `"${(v.snippet?.title || "").replace(/"/g, '""')}"`,
        `"${(v.snippet?.channelTitle || "").replace(/"/g, '""')}"`,
        v.status?.privacyStatus || "public",
        mStatus.label,
        mStatus.claimType || "-",
        `"${(mStatus.claimant || "-").replace(/"/g, '""')}"`,
        v.statistics?.viewCount || "0",
        v.statistics?.likeCount || "0",
        v.statistics?.commentCount || "0",
        parseDuration(v.contentDetails?.duration),
        v.snippet?.publishedAt ? new Date(v.snippet.publishedAt).toLocaleDateString() : "-",
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filterLabel = monetizationFilter !== "all" ? `_${monetizationFilter}` : "";
    const clientLabel = selectedClient !== "all" ? `_${clients.find((c) => c.id === selectedClient)?.name || "client"}` : "_all_clients";
    const channelLabel = channelFilter !== "all" ? `_${channelOptions.find(([id]) => id === channelFilter)?.[1]?.replace(/[^a-zA-Z0-9]/g, "_") || channelFilter}` : "";
    a.download = `admin_videos_report${clientLabel}${channelLabel}${filterLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPrivacyColor = (privacy: string) => {
    switch (privacy) {
      case "public": return "bg-green-100 text-green-700";
      case "private": return "bg-red-100 text-red-700";
      case "unlisted": return "bg-yellow-100 text-yellow-700";
      default: return "bg-green-100 text-green-700";
    }
  };

  const getPrivacyIcon = (privacy: string) => {
    switch (privacy) {
      case "public": return <Globe className="w-3.5 h-3.5" />;
      case "private": return <Lock className="w-3.5 h-3.5" />;
      case "unlisted": return <EyeOff className="w-3.5 h-3.5" />;
      default: return <Globe className="w-3.5 h-3.5" />;
    }
  };

  if (loadingClients) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Videos & Claims Management</h1>
          <p className="text-sm text-muted mt-1">
            View all client videos, manage monetization claims, and export reports.
          </p>
        </div>
        <button
          onClick={() => setShowAddClaim(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Claim
        </button>
      </div>

      {videoCacheTime && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Showing cached data — Last updated: {new Date(videoCacheTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Video className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-muted">Total Videos</span>
          </div>
          <p className="text-xl font-bold text-foreground">{claimStats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium text-muted">Monetized</span>
          </div>
          <p className="text-xl font-bold text-green-600">{claimStats.monetized}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-muted">Copyright Claims</span>
          </div>
          <p className="text-xl font-bold text-red-600">{claimStats.copyrightClaims}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-muted">Content ID Claims</span>
          </div>
          <p className="text-xl font-bold text-orange-600">{claimStats.contentIdClaims}</p>
        </div>
      </div>

      {/* Duplicate Detector — Channel-wise */}
      {channelDuplicateGroups.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowDuplicates(!showDuplicates)}
              className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
            >
              <Copy className="w-4 h-4 text-purple-500" />
              Duplicate Videos ({channelDuplicateGroups.length} channel{channelDuplicateGroups.length !== 1 ? "s" : ""}, {duplicateGroups.reduce((s, g) => s + g.count, 0)} videos)
              <span className="text-xs text-muted font-normal ml-2">{showDuplicates ? "Hide" : "Show"}</span>
            </button>
            {showDuplicates && (
              <div className="flex items-center gap-2">
                <select value={dupChannelFilter} onChange={(e) => setDupChannelFilter(e.target.value)} className="border border-border rounded-lg px-2 py-1 text-xs">
                  <option value="all">All Channels</option>
                  {channelDuplicateGroups.map((cg) => (
                    <option key={cg.channelId} value={cg.channelId}>{cg.channelName}</option>
                  ))}
                </select>
                <select value={dupPrivacyFilter} onChange={(e) => setDupPrivacyFilter(e.target.value)} className="border border-border rounded-lg px-2 py-1 text-xs">
                  <option value="all">All Privacy</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                </select>
                {selectedDupVideos.size > 0 && (
                  <button onClick={handleDupBulkDelete} disabled={dupDeleting} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                    {dupDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete {selectedDupVideos.size} Selected
                  </button>
                )}
              </div>
            )}
          </div>
          {showDuplicates && (
            <div className="mt-4 space-y-5 max-h-[600px] overflow-y-auto">
              {channelDuplicateGroups.filter((cg) => dupChannelFilter === "all" || cg.channelId === dupChannelFilter).map((chGroup) => {
                const filteredGroups = chGroup.groups.map((g) => ({
                  ...g,
                  videos: dupPrivacyFilter === "all" ? g.videos : g.videos.filter((v) => (v.status?.privacyStatus || "public") === dupPrivacyFilter),
                })).filter((g) => g.videos.length > 0);
                if (filteredGroups.length === 0) return null;
                return (
                  <div key={chGroup.channelId}>
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
                      <span className="text-sm font-bold text-foreground">{chGroup.channelName}</span>
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                        {filteredGroups.reduce((s, g) => s + g.videos.length, 0)} videos
                      </span>
                      <button
                        onClick={() => {
                          const allRows: string[][] = [];
                          for (const g of filteredGroups) {
                            for (const v of g.videos) {
                              allRows.push([
                                `"${(v.snippet?.title || g.title).replace(/"/g, '""')}"`,
                                `https://www.youtube.com/watch?v=${v.id}`,
                                `https://studio.youtube.com/video/${v.id}/edit`,
                                v.status?.privacyStatus || "public",
                                parseDuration(v.contentDetails?.duration),
                                v.statistics?.viewCount || "0",
                                g.videos.length.toString(),
                              ]);
                            }
                          }
                          const csv = ["Title,YouTube Link,Studio Link,Privacy,Duration,Views,Copies", ...allRows.map((r) => r.join(","))].join("\n");
                          const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
                          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                          a.download = `all_duplicates_${chGroup.channelName.slice(0, 20).replace(/[^a-zA-Z0-9]/g, "_")}.csv`; a.click();
                        }}
                        className="text-xs text-primary hover:underline flex items-center gap-1 ml-auto"
                      >
                        <Download className="w-3.5 h-3.5" /> Download All
                      </button>
                    </div>
                    <div className="space-y-2 ml-2">
                      {filteredGroups.map((group, idx) => (
                        <div key={idx} className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-foreground truncate max-w-[50%]">&quot;{group.title}&quot;</p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const rows = group.videos.map((v) => [
                                    `"${(v.snippet?.title || group.title).replace(/"/g, '""')}"`,
                                    `https://www.youtube.com/watch?v=${v.id}`,
                                    `https://studio.youtube.com/video/${v.id}/edit`,
                                    v.status?.privacyStatus || "public",
                                    parseDuration(v.contentDetails?.duration),
                                    v.statistics?.viewCount || "0",
                                  ]);
                                  const csv = ["Title,YouTube Link,Studio Link,Privacy,Duration,Views", ...rows.map((r) => r.join(","))].join("\n");
                                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
                                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                                  a.download = `duplicates_${group.title.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}.csv`; a.click();
                                }}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" /> Links
                              </button>
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{group.videos.length}x</span>
                              {group.sameCount > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{group.sameCount} same duration</span>}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {group.videos.map((v) => (
                              <div key={v.id} className="flex items-center gap-2 text-xs flex-wrap">
                                <button onClick={() => v.id && toggleDupSelect(v.id)} className="p-0.5 hover:bg-slate-100 rounded shrink-0">
                                  {v.id && selectedDupVideos.has(v.id) ? <CheckCircle className="w-3.5 h-3.5 text-primary" /> : <XCircle className="w-3.5 h-3.5 text-muted" />}
                                </button>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${v.status?.privacyStatus === "private" ? "bg-red-100 text-red-700" : v.status?.privacyStatus === "unlisted" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                                  {v.status?.privacyStatus || "public"}
                                </span>
                                <span className="text-muted">{parseDuration(v.contentDetails?.duration)}</span>
                                <span className="text-muted">{formatNumber(Number(v.statistics?.viewCount || 0))} views</span>
                                {v.snippet?.publishedAt && <span className="text-muted">{new Date(v.snippet.publishedAt).toLocaleDateString()}</span>}
                                <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline shrink-0 text-[10px]" title={`https://www.youtube.com/watch?v=${v.id}`}>youtu.be/{v.id}</a>
                                <a href={`https://studio.youtube.com/video/${v.id}/edit`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-auto shrink-0">Edit</a>
                                <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline shrink-0">Watch</a>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search videos..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={monetizationFilter}
              onChange={(e) => setMonetizationFilter(e.target.value as MonetizationFilter)}
              className="border border-border rounded-lg px-3 py-2 text-sm text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Monetization</option>
              <option value="monetized">Monetized</option>
              <option value="not_monetized">Not Monetized</option>
              <option value="copyright_claim">Copyright Claim</option>
              <option value="content_id_claim">Content ID Claim</option>
              <option value="no_claim">No Claim</option>
            </select>
            <select
              value={privacyFilter}
              onChange={(e) => setPrivacyFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Privacy ({privacyCounts.all})</option>
              <option value="public">Public ({privacyCounts.public})</option>
              <option value="private">Private ({privacyCounts.private})</option>
              <option value="unlisted">Unlisted ({privacyCounts.unlisted})</option>
            </select>
            {channelOptions.length > 1 && (
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 max-w-[200px]"
              >
                <option value="all">All Channels</option>
                {channelOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            )}
            <button
              onClick={handleExportCSV}
              disabled={filteredVideos.length === 0}
              className="flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm text-muted hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {loadingVideos ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted">Loading videos...</span>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-10">
            <AlertCircle className="w-8 h-8 text-muted mx-auto mb-2" />
            <p className="text-sm text-muted">
              {videos.length === 0
                ? "No videos found. Select a client with channels to view videos."
                : "No videos match your filters."}
            </p>
          </div>
        ) : (
          <>
          {(privacyFilter !== "all" || channelFilter !== "all" || monetizationFilter !== "all" || searchQuery) && (
            <p className="text-xs text-muted mb-3">
              Showing {filteredVideos.length} of {videos.length} videos
            </p>
          )}
          <div className="overflow-x-auto" key={`avt-${privacyFilter}-${channelFilter}-${monetizationFilter}`}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">Video</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">Channel</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">Monetization</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">Views</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">Likes</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVideos.map((video) => {
                  const thumbnail = video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || "";
                  const privacy = video.status?.privacyStatus || "public";
                  const publishedDate = video.snippet?.publishedAt
                    ? new Date(video.snippet.publishedAt).toLocaleDateString()
                    : "-";
                  const mStatus = getMonetizationStatus(video, claims);
                  const videoClaims = claims.filter((c) => c.videoId === video.id && c.status === "active");

                  return (
                    <tr key={video.id} className="border-b border-border/50 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-12 bg-slate-200 rounded-lg overflow-hidden shrink-0">
                            {thumbnail && (
                              <img src={thumbnail} alt={video.snippet?.title || ""} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                              {video.snippet?.title || "Untitled"}
                            </p>
                            <p className="text-xs text-muted mt-0.5">{publishedDate}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-foreground truncate max-w-[120px]">
                          {video.snippet?.channelTitle || video.snippet?.channelId || "-"}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getPrivacyColor(privacy)}`}>
                          {getPrivacyIcon(privacy)}
                          {privacy}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${mStatus.color}`}>
                            {mStatus.hasActiveClaim ? <ShieldAlert className="w-3 h-3" /> : mStatus.isMonetized ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {mStatus.label}
                          </span>
                          {mStatus.claimant && (
                            <p className="text-xs text-muted mt-0.5 truncate max-w-[150px]">by {mStatus.claimant}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm text-foreground flex items-center justify-end gap-1">
                          <Eye className="w-3.5 h-3.5 text-muted" />
                          {formatNumber(Number(video.statistics?.viewCount || 0))}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm text-foreground flex items-center justify-end gap-1">
                          <ThumbsUp className="w-3.5 h-3.5 text-muted" />
                          {formatNumber(Number(video.statistics?.likeCount || 0))}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {videoClaims.length > 0 ? (
                            <>
                              <button
                                onClick={() => handleReleaseClaim(video.id || "", videoClaims[0].claimant)}
                                className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                                title="Release Claim"
                              >
                                Release
                              </button>
                              <button
                                onClick={() => handleDeleteClaim(video.id || "", videoClaims[0].claimant)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Delete Claim"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleAddClaimForVideo(video)}
                              className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                              title="Add Claim"
                            >
                              + Claim
                            </button>
                          )}
                          <a
                            href={`https://www.youtube.com/watch?v=${video.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                            title="Watch on YouTube"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted">
            Showing {(currentPage - 1) * VIDEOS_PER_PAGE + 1}–{Math.min(currentPage * VIDEOS_PER_PAGE, filteredVideos.length)} of {filteredVideos.length} videos
            {filteredVideos.length !== videos.length && ` (${videos.length} total)`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-slate-50">Prev</button>
              <span className="text-xs text-muted">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
            </div>
          )}
        </div>
      </div>

      {/* Active Claims Section */}
      {claims.filter((c) => c.status === "active").length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            Active Claims ({claims.filter((c) => c.status === "active").length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted uppercase">Video ID</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted uppercase">Channel ID</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted uppercase">Type</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted uppercase">Claimant</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted uppercase">Notes</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted uppercase">Date</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-muted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.filter((c) => c.status === "active").map((claim, idx) => (
                  <tr key={`${claim.videoId}-${idx}`} className="border-b border-border/50">
                    <td className="py-2 px-3 text-sm text-foreground font-mono text-xs">{claim.videoId}</td>
                    <td className="py-2 px-3 text-sm text-muted font-mono text-xs">{claim.channelId}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        claim.claimType === "copyright" ? "bg-red-100 text-red-700" :
                        claim.claimType === "content_id" ? "bg-orange-100 text-orange-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {claim.claimType === "copyright" ? "Copyright" : claim.claimType === "content_id" ? "Content ID" : "Manual"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm text-foreground">{claim.claimant}</td>
                    <td className="py-2 px-3 text-sm text-muted truncate max-w-[150px]">{claim.notes || "-"}</td>
                    <td className="py-2 px-3 text-xs text-muted">{new Date(claim.createdDate).toLocaleDateString()}</td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleReleaseClaim(claim.videoId, claim.claimant)}
                          className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100"
                        >
                          Release
                        </button>
                        <button
                          onClick={() => handleDeleteClaim(claim.videoId, claim.claimant)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Claim Modal */}
      {showAddClaim && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Add Copyright Claim</h2>
              <button onClick={() => setShowAddClaim(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Video ID</label>
                <input
                  type="text"
                  value={claimVideoId}
                  onChange={(e) => setClaimVideoId(e.target.value)}
                  placeholder="e.g. dQw4w9WgXcQ"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Channel ID</label>
                <input
                  type="text"
                  value={claimChannelId}
                  onChange={(e) => setClaimChannelId(e.target.value)}
                  placeholder="e.g. UCxxxxx"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Claim Type</label>
                <select
                  value={claimType}
                  onChange={(e) => setClaimType(e.target.value as "copyright" | "content_id" | "manual")}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="copyright">Copyright Claim</option>
                  <option value="content_id">Content ID Claim</option>
                  <option value="manual">Manual Claim</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Claimant</label>
                <input
                  type="text"
                  value={claimant}
                  onChange={(e) => setClaimant(e.target.value)}
                  placeholder="Who made the claim?"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes (optional)</label>
                <textarea
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional details about the claim..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button
                onClick={() => setShowAddClaim(false)}
                className="px-4 py-2 text-sm text-muted hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddClaim}
                disabled={savingClaim || !claimVideoId || !claimChannelId}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {savingClaim && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
