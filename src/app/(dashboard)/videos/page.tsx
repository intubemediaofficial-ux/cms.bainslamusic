"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Play,
  ThumbsUp,
  MessageSquare,
  Download,
  Eye,
  Loader2,
  WifiOff,
  AlertCircle,
  Edit2,
  Trash2,
  Globe,
  Lock,
  EyeOff,
  X,
  MoreHorizontal,
  Image,
  DollarSign,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Filter,
  Copy,
  CheckSquare,
  Square,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { formatNumber } from "@/lib/utils";

interface VideoItem {
  id?: string | null;
  snippet?: {
    title?: string | null;
    description?: string | null;
    channelId?: string | null;
    channelTitle?: string | null;
    publishedAt?: string | null;
    tags?: string[] | null;
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
    license?: string | null;
    madeForKids?: boolean | null;
    rejectionReason?: string | null;
    uploadStatus?: string | null;
  } | null;
}

interface VideoClaim {
  videoId: string;
  channelId: string;
  claimType: "copyright" | "content_id" | "manual";
  claimant: string;
  status: "active" | "released" | "disputed";
  notes: string;
  createdDate: string;
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

function parseDurationSeconds(isoDuration: string | null | undefined): number {
  if (!isoDuration) return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || "0", 10) * 3600 + parseInt(match[2] || "0", 10) * 60 + parseInt(match[3] || "0", 10);
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

  // Check upload status for rejected videos
  if (video.status?.uploadStatus === "rejected") {
    return {
      isMonetized: false,
      hasActiveClaim: true,
      claimType: "copyright",
      claimant: "YouTube",
      label: "Rejected",
      color: "bg-red-100 text-red-700",
    };
  }

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

export default function VideosPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [claims, setClaims] = useState<VideoClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReal, setIsReal] = useState(false);

  const [cacheLastUpdated, setCacheLastUpdated] = useState<string | null>(null);

  const [editVideo, setEditVideo] = useState<VideoItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editPrivacy, setEditPrivacy] = useState("public");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [deleteVideo, setDeleteVideo] = useState<VideoItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Multi-select state
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // Duplicate detector
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedDupVideos, setSelectedDupVideos] = useState<Set<string>>(new Set());
  const [dupPrivacyFilter, setDupPrivacyFilter] = useState<string>("all");
  const [dupChannelFilter, setDupChannelFilter] = useState<string>("all");
  const [dupDeleting, setDupDeleting] = useState(false);

  const fetchClaims = useCallback(async () => {
    try {
      const res = await fetch("/api/video-claims");
      if (res.ok) {
        const json = await res.json();
        setClaims(json.data || []);
      }
    } catch {
      // silent
    }
  }, []);

  const [serverChannelIds, setServerChannelIds] = useState<string[]>([]);
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

  const fetchVideos = useCallback(async () => {
    if (!isAuthenticated || allChannelIds.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let latestCacheTime: string | null = null;
      let anyFromCache = false;
      const results = await Promise.allSettled(
        allChannelIds.map((channelId) =>
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
      if (allVideos.length > 0) {
        setVideos(allVideos);
        setIsReal(true);
        if (anyFromCache && latestCacheTime) {
          setCacheLastUpdated(latestCacheTime);
        } else {
          setCacheLastUpdated(null);
        }
      } else {
        setError("No videos found for added channels. Please check if channels have valid tokens.");
      }
    } catch {
      setError("Failed to load videos. Please try again.");
    }
    setLoading(false);
  }, [isAuthenticated, allChannelIds]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchVideos();
      if (isAuthenticated) fetchClaims();
    });
  }, [fetchVideos, fetchClaims, isAuthenticated]);

  const hasNoChannelsAdded = allChannelIds.length === 0;

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "public" | "private" | "unlisted">("all");
  const [monetizationFilter, setMonetizationFilter] = useState<MonetizationFilter>("all");
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

  const privacyCounts = useMemo(() => {
    const channelVids = (isReal ? videos : []).filter((v) =>
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
  }, [videos, isReal, channelFilter]);

  const filteredVideos = useMemo(() => {
    if (!isReal) return [];
    const result: VideoItem[] = [];
    for (const video of videos) {
      if (channelFilter !== "all" && video.snippet?.channelId !== channelFilter) continue;
      const title = video.snippet?.title || "";
      if (searchQuery && !title.toLowerCase().includes(searchQuery.toLowerCase())) continue;
      if (statusFilter !== "all") {
        const rawPrivacy = video.status?.privacyStatus;
        const videoPrivacy = rawPrivacy ? rawPrivacy.toLowerCase() : "public";
        if (videoPrivacy !== statusFilter) continue;
      }
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
  }, [videos, isReal, searchQuery, statusFilter, monetizationFilter, channelFilter, claims]);

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1));
  }, [searchQuery, statusFilter, monetizationFilter, channelFilter]);

  const totalPages = Math.ceil(filteredVideos.length / VIDEOS_PER_PAGE);
  const paginatedVideos = useMemo(() => {
    const start = (currentPage - 1) * VIDEOS_PER_PAGE;
    return filteredVideos.slice(start, start + VIDEOS_PER_PAGE);
  }, [filteredVideos, currentPage]);

  const claimStats = useMemo(() => {
    const total = filteredVideos.length;
    let copyrightClaims = 0;
    let contentIdClaims = 0;
    let monetized = 0;
    for (const v of filteredVideos) {
      const status = getMonetizationStatus(v, claims);
      if (status.claimType === "copyright") copyrightClaims++;
      else if (status.claimType === "content_id") contentIdClaims++;
      if (status.isMonetized && !status.hasActiveClaim) monetized++;
    }
    return { total, copyrightClaims, contentIdClaims, monetized, noClaim: total - copyrightClaims - contentIdClaims };
  }, [filteredVideos, claims]);

  // Duplicate video detection — channel-wise
  const channelDuplicateGroups = useMemo((): ChannelDuplicateGroup[] => {
    if (!isReal || videos.length === 0) return [];
    // Group videos by channel
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
      for (const [title, vids] of titleMap) {
        if (vids.length < 2) continue;
        const durationMap = new Map<number, VideoItem[]>();
        for (const v of vids) {
          const dur = parseDurationSeconds(v.contentDetails?.duration);
          let found = false;
          for (const [existDur, existVids] of durationMap) {
            if (Math.abs(dur - existDur) <= 2) {
              existVids.push(v);
              found = true;
              break;
            }
          }
          if (!found) durationMap.set(dur, [v]);
        }
        const sameDurCount = Array.from(durationMap.values()).filter((arr) => arr.length > 1).reduce((s, arr) => s + arr.length, 0);
        groups.push({
          title: vids[0].snippet?.title || title,
          count: vids.length,
          videos: vids,
          sameCount: sameDurCount,
        });
      }
      if (groups.length > 0) {
        result.push({
          channelId: cid,
          channelName: name,
          groups: groups.sort((a, b) => b.count - a.count),
          totalDuplicates: groups.reduce((s, g) => s + g.count, 0),
        });
      }
    }
    return result.sort((a, b) => b.totalDuplicates - a.totalDuplicates);
  }, [videos, isReal]);

  const duplicateGroups = useMemo((): DuplicateGroup[] => {
    return channelDuplicateGroups.flatMap((cg) => cg.groups);
  }, [channelDuplicateGroups]);

  const handleExportCSV = () => {
    const headers = ["Video URL", "Video Title", "Channel", "Privacy", "Claim Status", "Claim Type", "Claimant / CMS", "Views", "Likes", "Comments", "Duration", "Published Date"];
    const rows = filteredVideos.map((v) => {
      const mStatus = getMonetizationStatus(v, claims);
      const videoUrl = v.id ? `https://www.youtube.com/watch?v=${v.id}` : "";
      return [
        videoUrl,
        `"${(v.snippet?.title || "").replace(/"/g, '""')}"`,
        `"${(v.snippet?.channelTitle || v.snippet?.channelId || "").replace(/"/g, '""')}"`,
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
    const statusLabel = statusFilter !== "all" ? `_${statusFilter}` : "";
    const channelLabel = channelFilter !== "all" ? `_${channelOptions.find(([id]) => id === channelFilter)?.[1]?.replace(/[^a-zA-Z0-9]/g, "_") || channelFilter}` : "";
    a.download = `videos_report${channelLabel}${statusLabel}${filterLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = loading;

  const openEdit = (video: VideoItem) => {
    setEditVideo(video);
    setEditTitle(video.snippet?.title || "");
    setEditDesc(video.snippet?.description || "");
    setEditTags((video.snippet?.tags || []).join(", "));
    setEditPrivacy(video.status?.privacyStatus || "public");
    setEditError("");
    setOpenMenuId(null);
  };

  const handleEditSave = async () => {
    if (!editVideo?.id || !editVideo.snippet?.channelId) return;
    setEditSaving(true);
    setEditError("");
    try {
      const tagsArray = editTags.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await fetch("/api/youtube/video", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: editVideo.id,
          channelId: editVideo.snippet.channelId,
          title: editTitle,
          description: editDesc,
          tags: tagsArray,
          privacyStatus: editPrivacy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Failed to update video. Please ensure channel token is valid.");
        return;
      }
      setEditVideo(null);
      fetchVideos();
    } catch {
      setEditError("Network error — check your connection and try again");
    } finally {
      setEditSaving(false);
    }
  };

  const handlePrivacyChange = async (video: VideoItem, newPrivacy: string) => {
    if (!video.id || !video.snippet?.channelId) return;
    setOpenMenuId(null);
    try {
      const res = await fetch("/api/youtube/video", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: video.id,
          channelId: video.snippet.channelId,
          privacyStatus: newPrivacy,
        }),
      });
      if (res.ok) fetchVideos();
    } catch {
      // silent
    }
  };

  const handleDelete = async () => {
    if (!deleteVideo?.id || !deleteVideo.snippet?.channelId) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(
        `/api/youtube/video?videoId=${deleteVideo.id}&channelId=${deleteVideo.snippet.channelId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (res.ok) {
        setVideos(videos.filter((v) => v.id !== deleteVideo.id));
        setDeleteVideo(null);
      } else {
        setDeleteError(data.error || "Failed to delete video. Please ensure channel token is valid.");
      }
    } catch {
      setDeleteError("Network error — check your connection and try again");
    } finally {
      setDeleting(false);
    }
  };

  // Multi-select handlers
  const toggleSelect = (videoId: string) => {
    setSelectedVideos((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedVideos.size === paginatedVideos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(paginatedVideos.map((v) => v.id!).filter(Boolean)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedVideos.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedVideos.size} video(s)? This cannot be undone.`)) return;
    setBulkActionInProgress(true);
    setBulkResult(null);
    const videosToDelete = videos
      .filter((v) => v.id && selectedVideos.has(v.id))
      .map((v) => ({ videoId: v.id!, channelId: v.snippet?.channelId || "" }));
    try {
      const res = await fetch("/api/youtube/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulkDelete", videos: videosToDelete }),
      });
      const data = await res.json();
      if (res.ok) {
        const successIds = new Set(data.data.results.filter((r: { success: boolean }) => r.success).map((r: { videoId: string }) => r.videoId));
        setVideos(videos.filter((v) => !successIds.has(v.id!)));
        setBulkResult(`${data.data.successCount}/${data.data.totalCount} videos deleted successfully`);
        setSelectedVideos(new Set());
      } else {
        setBulkResult(data.error || "Bulk delete failed");
      }
    } catch {
      setBulkResult("Network error during bulk delete");
    } finally {
      setBulkActionInProgress(false);
    }
  };

  const handleBulkPrivacy = async (privacyStatus: string) => {
    if (selectedVideos.size === 0) return;
    setBulkActionInProgress(true);
    setBulkResult(null);
    const videosToUpdate = videos
      .filter((v) => v.id && selectedVideos.has(v.id))
      .map((v) => ({ videoId: v.id!, channelId: v.snippet?.channelId || "" }));
    try {
      const res = await fetch("/api/youtube/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulkPrivacy", videos: videosToUpdate, privacyStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setBulkResult(`${data.data.successCount}/${data.data.totalCount} videos updated to ${privacyStatus}`);
        setSelectedVideos(new Set());
        fetchVideos();
      } else {
        setBulkResult(data.error || "Bulk privacy change failed");
      }
    } catch {
      setBulkResult("Network error during bulk privacy change");
    } finally {
      setBulkActionInProgress(false);
    }
  };

  const handleDupBulkDelete = async () => {
    if (selectedDupVideos.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedDupVideos.size} duplicate video(s)? This cannot be undone.`)) return;
    setDupDeleting(true);
    setBulkResult(null);
    const videosToDelete = videos
      .filter((v) => v.id && selectedDupVideos.has(v.id))
      .map((v) => ({ videoId: v.id!, channelId: v.snippet?.channelId || "" }));
    if (videosToDelete.length === 0) {
      setBulkResult("No videos found to delete");
      setDupDeleting(false);
      return;
    }
    try {
      const res = await fetch("/api/youtube/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulkDelete", videos: videosToDelete }),
      });
      const data = await res.json();
      if (res.ok) {
        const results = data.data.results as { videoId: string; success: boolean; error?: string }[];
        const successIds = new Set(results.filter((r) => r.success).map((r) => r.videoId));
        const failedResults = results.filter((r) => !r.success);
        setVideos(videos.filter((v) => !successIds.has(v.id!)));
        if (failedResults.length > 0 && successIds.size === 0) {
          const firstError = failedResults[0]?.error || "Unknown error";
          if (firstError.includes("insufficient") || firstError.includes("forbidden") || firstError.includes("scope") || firstError.includes("permission") || firstError.includes("Permission")) {
            setBulkResult("Delete failed: YouTube denied permission. Please go to Channels → Re-validate token → Grant ALL permissions on Google consent screen.");
          } else if (firstError.includes("No valid token")) {
            setBulkResult("Delete failed: No valid token for this channel. Please validate the channel token first.");
          } else {
            setBulkResult(`Delete failed: ${firstError}`);
          }
        } else if (successIds.size > 0) {
          setBulkResult(`${data.data.successCount}/${data.data.totalCount} duplicate videos deleted`);
          setSelectedDupVideos(new Set());
        } else {
          setBulkResult("Delete failed — please re-validate channel token with full YouTube access");
        }
      } else {
        setBulkResult(data.error || "Bulk delete failed — please check channel token");
      }
    } catch {
      setBulkResult("Network error during bulk delete");
    } finally {
      setDupDeleting(false);
    }
  };

  const toggleDupSelect = (videoId: string) => {
    setSelectedDupVideos((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId); else next.add(videoId);
      return next;
    });
  };

  const getPrivacyIcon = (privacy: string) => {
    switch (privacy) {
      case "public": return <Globe className="w-3.5 h-3.5" />;
      case "private": return <Lock className="w-3.5 h-3.5" />;
      case "unlisted": return <EyeOff className="w-3.5 h-3.5" />;
      default: return <Globe className="w-3.5 h-3.5" />;
    }
  };

  const getPrivacyColor = (privacy: string) => {
    switch (privacy) {
      case "public": return "bg-green-100 text-green-700";
      case "private": return "bg-red-100 text-red-700";
      case "unlisted": return "bg-yellow-100 text-yellow-700";
      default: return "bg-green-100 text-green-700";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Videos</h1>
          <p className="text-sm text-muted mt-1">
            Manage your YouTube videos — edit, delete, change privacy, and view monetization status.
          </p>
        </div>
      </div>

      {cacheLastUpdated && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Showing cached data — Last updated: {new Date(cacheLastUpdated).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
      )}

      {bulkResult && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${bulkResult.toLowerCase().includes("failed") || bulkResult.toLowerCase().includes("error") || bulkResult.toLowerCase().includes("no valid") ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{bulkResult}</span>
          {bulkResult.toLowerCase().includes("re-validate") && (
            <a href="/channels" className="ml-2 px-2 py-0.5 bg-primary text-white rounded text-xs font-medium hover:opacity-90">Go to Channels</a>
          )}
          <button onClick={() => setBulkResult(null)} className="ml-auto p-1 hover:bg-opacity-50 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!isAuthenticated && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted">Loading videos...</p>
          </div>
        </div>
      )}

      {isAuthenticated && hasNoChannelsAdded && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No Channels Added</h3>
            <p className="text-sm text-muted mb-4">
              Add channels first to see their videos here.
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

      {isAuthenticated && !hasNoChannelsAdded && isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted">Loading videos from {allChannelIds.length} channel{allChannelIds.length !== 1 ? "s" : ""}...</p>
          </div>
        </div>
      )}

      {isAuthenticated && !hasNoChannelsAdded && !isLoading && !isReal && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <WifiOff className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Could Not Load Videos</h3>
            <p className="text-sm text-muted mb-4">{error || "Please try again."}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {isAuthenticated && !hasNoChannelsAdded && !isLoading && isReal && (
        <>
          {/* Monetization Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <Play className="w-4 h-4 text-blue-500" />
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
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <Copy className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-medium text-muted">Duplicates</span>
              </div>
              <p className="text-xl font-bold text-purple-600">{duplicateGroups.reduce((s, g) => s + g.count, 0)}</p>
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
                    <select
                      value={dupChannelFilter}
                      onChange={(e) => setDupChannelFilter(e.target.value)}
                      className="border border-border rounded-lg px-2 py-1 text-xs"
                    >
                      <option value="all">All Channels</option>
                      {channelDuplicateGroups.map((cg) => (
                        <option key={cg.channelId} value={cg.channelId}>{cg.channelName}</option>
                      ))}
                    </select>
                    <select
                      value={dupPrivacyFilter}
                      onChange={(e) => setDupPrivacyFilter(e.target.value)}
                      className="border border-border rounded-lg px-2 py-1 text-xs"
                    >
                      <option value="all">All Privacy</option>
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                      <option value="unlisted">Unlisted</option>
                    </select>
                    {selectedDupVideos.size > 0 && (
                      <button
                        onClick={handleDupBulkDelete}
                        disabled={dupDeleting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                      >
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
                            {filteredGroups.reduce((s, g) => s + g.videos.length, 0)} videos in {filteredGroups.length} group{filteredGroups.length !== 1 ? "s" : ""}
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
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                    {group.videos.length}x
                                  </span>
                                  {group.sameCount > 0 && (
                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                                      {group.sameCount} same duration
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                {group.videos.map((v) => (
                                  <div key={v.id} className="flex items-center gap-2 text-xs flex-wrap">
                                    <button
                                      onClick={() => v.id && toggleDupSelect(v.id)}
                                      className="p-0.5 hover:bg-slate-100 rounded shrink-0"
                                    >
                                      {v.id && selectedDupVideos.has(v.id) ? (
                                        <CheckSquare className="w-3.5 h-3.5 text-primary" />
                                      ) : (
                                        <Square className="w-3.5 h-3.5 text-muted" />
                                      )}
                                    </button>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getPrivacyColor(v.status?.privacyStatus || "public")}`}>
                                      {v.status?.privacyStatus || "public"}
                                    </span>
                                    <span className="text-muted">{parseDuration(v.contentDetails?.duration)}</span>
                                    <span className="text-muted">{formatNumber(Number(v.statistics?.viewCount || 0))} views</span>
                                    {v.snippet?.publishedAt && <span className="text-muted">{new Date(v.snippet.publishedAt).toLocaleDateString()}</span>}
                                    <a
                                      href={`https://www.youtube.com/watch?v=${v.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:underline shrink-0 text-[10px]"
                                      title={`https://www.youtube.com/watch?v=${v.id}`}
                                    >
                                      youtu.be/{v.id}
                                    </a>
                                    <a
                                      href={`https://studio.youtube.com/video/${v.id}/edit`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-primary bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded ml-auto shrink-0 cursor-pointer"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      Edit
                                    </a>
                                    <a
                                      href={`https://www.youtube.com/watch?v=${v.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded shrink-0 cursor-pointer"
                                    >
                                      <Play className="w-3 h-3" />
                                      Watch
                                    </a>
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

          {/* Bulk Actions Bar */}
          {selectedVideos.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm font-medium text-blue-700">{selectedVideos.size} selected</span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => handleBulkPrivacy("private")}
                  disabled={bulkActionInProgress}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border rounded-lg text-xs font-medium text-foreground hover:bg-slate-50 disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" /> Make Private
                </button>
                <button
                  onClick={() => handleBulkPrivacy("public")}
                  disabled={bulkActionInProgress}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border rounded-lg text-xs font-medium text-foreground hover:bg-slate-50 disabled:opacity-50"
                >
                  <Globe className="w-3.5 h-3.5" /> Make Public
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkActionInProgress}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {bulkActionInProgress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete Selected
                </button>
                <button
                  onClick={() => setSelectedVideos(new Set())}
                  className="px-3 py-1.5 text-xs text-muted hover:bg-slate-100 rounded-lg"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Filters and Table */}
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search videos..."
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-light"
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | "public" | "private" | "unlisted")
                  }
                  className="border border-border rounded-lg px-3 py-2 text-sm text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="all">All Privacy ({privacyCounts.all})</option>
                  <option value="public">Public ({privacyCounts.public})</option>
                  <option value="private">Private ({privacyCounts.private})</option>
                  <option value="unlisted">Unlisted ({privacyCounts.unlisted})</option>
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
                  className="flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm text-muted hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export Report
                </button>
              </div>
            </div>

            {(statusFilter !== "all" || channelFilter !== "all" || monetizationFilter !== "all" || searchQuery) && (
              <p className="text-xs text-muted mb-3">
                Showing {filteredVideos.length} of {videos.length} videos
              </p>
            )}

            {filteredVideos.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted">
                {videos.length === 0 ? "No videos found on your channel" : "No videos match your filters"}
              </div>
            ) : (
              <div className="overflow-x-auto" key={`vt-${statusFilter}-${channelFilter}-${monetizationFilter}`}>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 w-10">
                        <button onClick={toggleSelectAll} className="p-1 hover:bg-slate-100 rounded">
                          {selectedVideos.size === paginatedVideos.length && paginatedVideos.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                        Video
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                        Monetization
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                        Views
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                        Likes
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                        Actions
                      </th>
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
                      const isSelected = video.id ? selectedVideos.has(video.id) : false;

                      return (
                        <tr
                          key={video.id}
                          className={`border-b border-border/50 hover:bg-slate-50 transition-colors ${isSelected ? "bg-blue-50" : ""}`}
                        >
                          <td className="py-3 px-2">
                            <button
                              onClick={() => video.id && toggleSelect(video.id)}
                              className="p-1 hover:bg-slate-100 rounded"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <Square className="w-4 h-4 text-muted" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-20 h-12 bg-slate-200 rounded-lg overflow-hidden shrink-0">
                                {thumbnail && (
                                  <img
                                    src={thumbnail}
                                    alt={video.snippet?.title || ""}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate max-w-[250px]">
                                  {video.snippet?.title || "Untitled"}
                                </p>
                                <p className="text-xs text-muted mt-0.5">
                                  {publishedDate}
                                </p>
                              </div>
                            </div>
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
                                {mStatus.hasActiveClaim ? (
                                  <ShieldAlert className="w-3 h-3" />
                                ) : mStatus.isMonetized ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  <XCircle className="w-3 h-3" />
                                )}
                                {mStatus.label}
                              </span>
                              {mStatus.claimant && (
                                <p className="text-xs text-muted mt-0.5 truncate max-w-[150px]">
                                  by {mStatus.claimant}
                                </p>
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
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm text-muted">
                              {parseDuration(video.contentDetails?.duration)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="relative inline-block">
                              <button
                                onClick={() => setOpenMenuId(openMenuId === video.id ? null : (video.id || null))}
                                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                <MoreHorizontal className="w-4 h-4 text-muted" />
                              </button>
                              {openMenuId === video.id && (
                                <div className="absolute right-0 top-8 bg-white border border-border rounded-lg shadow-lg z-20 w-48 py-1">
                                  <a
                                    href={`https://studio.youtube.com/video/${video.id}/edit`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setOpenMenuId(null)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-slate-50"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" /> Edit in YouTube Studio
                                  </a>
                                  <div className="border-t border-border my-1" />
                                  <button
                                    onClick={() => handlePrivacyChange(video, "public")}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${privacy === "public" ? "text-green-600 font-medium" : "text-foreground"}`}
                                  >
                                    <Globe className="w-3.5 h-3.5" /> Public
                                  </button>
                                  <button
                                    onClick={() => handlePrivacyChange(video, "private")}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${privacy === "private" ? "text-red-600 font-medium" : "text-foreground"}`}
                                  >
                                    <Lock className="w-3.5 h-3.5" /> Private
                                  </button>
                                  <button
                                    onClick={() => handlePrivacyChange(video, "unlisted")}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${privacy === "unlisted" ? "text-yellow-600 font-medium" : "text-foreground"}`}
                                  >
                                    <EyeOff className="w-3.5 h-3.5" /> Unlisted
                                  </button>
                                  <div className="border-t border-border my-1" />
                                  <a
                                    href={`https://www.youtube.com/watch?v=${video.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setOpenMenuId(null)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-slate-50"
                                  >
                                    <Play className="w-3.5 h-3.5" /> Watch on YouTube
                                  </a>
                                  <button
                                    onClick={() => { setDeleteVideo(video); setOpenMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete Video
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
        </>
      )}

      {/* Edit Video Modal */}
      {editVideo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-foreground">Edit Video</h2>
              <button onClick={() => setEditVideo(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{editError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-xs text-muted mt-1">Separate tags with commas</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Privacy Status</label>
                <select
                  value={editPrivacy}
                  onChange={(e) => setEditPrivacy(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                </select>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                To change the thumbnail, click &quot;Change Thumbnail&quot; in the actions menu — it will open YouTube Studio where you can upload a new thumbnail.
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border sticky bottom-0 bg-white">
              <button
                onClick={() => setEditVideo(null)}
                className="px-4 py-2 text-sm text-muted hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
              >
                {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteVideo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-5">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Video?</h3>
            <p className="text-sm text-muted mb-1">
              Are you sure you want to permanently delete this video?
            </p>
            <p className="text-sm font-medium text-foreground mb-4 truncate">
              &quot;{deleteVideo.snippet?.title}&quot;
            </p>
            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{deleteError}</div>
            )}
            <p className="text-xs text-red-500 mb-4">
              This action cannot be undone. The video will be permanently removed from YouTube.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setDeleteVideo(null); setDeleteError(""); }}
                className="px-4 py-2 text-sm text-muted hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
