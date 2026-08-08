"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Gauge,
  Loader2,
  Music,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { downloadExcel } from "@/lib/excel-export";
import { parseChannelSheet, parseSongSheet } from "@/lib/copyright-import";

interface Song {
  id: string;
  title: string;
  artist: string;
  isrc: string;
  upc: string;
  aliases: string[];
  durationSec: number;
  originalVideoUrl: string;
  releaseDate: string;
  priority: "high" | "normal";
  active: boolean;
  lastScannedAt: string;
  lastMatchCount: number;
}

interface Match {
  id: string;
  songId: string;
  songTitle: string;
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  thumbnailUrl: string;
  publishedAt: string;
  views: number;
  durationSec: number;
  matchScore: number;
  matchedOn: string;
  status: string;
  note: string;
  detectedAt: string;
}

interface WhitelistEntry {
  channelId: string;
  channelTitle: string;
  reason: string;
  addedAt: string;
}

interface ScanStatus {
  config: {
    enabled: boolean;
    schedule: "daily" | "mon_wed_fri" | "weekly";
    variantsPerSong: number;
    dailyUnitBudget: number;
    minMatchScore: number;
    watchlistEnabled: boolean;
  };
  state: {
    running: boolean;
    lastRunAt: string;
    lastRunSongs: number;
    lastRunMatches: number;
    lastRunUnits: number;
    lastRunNote: string;
  };
  unitsUsedToday: number;
  isScanDayToday: boolean;
  songs: { total: number; active: number; highPriority: number; neverScanned: number };
  matches: { total: number; byStatus: Record<string, number> };
  plan: {
    runsPerCycle: number;
    songsPerRun: number;
    unitsPerRun: number;
    unitsPerCycle: number;
    budgetFits: boolean;
  };
}

type Tab = "songs" | "matches" | "cases" | "whitelist" | "settings";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Confirmed copy", color: "bg-red-100 text-red-700" },
  ignored: { label: "Ignored", color: "bg-slate-100 text-slate-600" },
  strike_submitted: { label: "Strike submitted", color: "bg-blue-100 text-blue-700" },
  removed: { label: "Removed", color: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", color: "bg-purple-100 text-purple-700" },
};

const SCHEDULE_LABELS: Record<string, string> = {
  daily: "Daily — whole catalog every day",
  mon_wed_fri: "Mon / Wed / Fri — catalog in 3 parts",
  weekly: "Weekly — 1/7th of the catalog each day",
};

const SONG_TEMPLATE_HEADERS = [
  "Title",
  "Artist",
  "ISRC",
  "UPC",
  "Duration",
  "Aliases",
  "Release Date",
  "Original Video Link",
  "Priority",
];

const CHANNEL_TEMPLATE_HEADERS = ["Channel Name", "Channel ID", "Channel Link"];

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function emptyDraft(): Partial<Song> & { aliasText: string; durationText: string } {
  return {
    title: "",
    artist: "",
    isrc: "",
    upc: "",
    originalVideoUrl: "",
    releaseDate: "",
    priority: "normal",
    active: true,
    aliasText: "",
    durationText: "",
  };
}

export default function AdminCopyrightPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("songs");
  const [songs, setSongs] = useState<Song[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [banner, setBanner] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [songSearch, setSongSearch] = useState("");
  const [matchSearch, setMatchSearch] = useState("");
  const [matchStatusFilter, setMatchStatusFilter] = useState("new");
  const [draft, setDraft] = useState<(Partial<Song> & { aliasText: string; durationText: string }) | null>(null);
  const [channelInput, setChannelInput] = useState("");

  const songFileRef = useRef<HTMLInputElement>(null);
  const channelFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authStatus === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [authStatus, session, router]);

  const loadAll = useCallback(async () => {
    try {
      const [songsRes, matchesRes, whitelistRes, statusRes] = await Promise.all([
        fetch("/api/copyright/songs", { cache: "no-store" }),
        fetch("/api/copyright/matches", { cache: "no-store" }),
        fetch("/api/copyright/whitelist", { cache: "no-store" }),
        fetch("/api/copyright/scan", { cache: "no-store" }),
      ]);
      if (songsRes.ok) setSongs((await songsRes.json()).data || []);
      if (matchesRes.ok) setMatches((await matchesRes.json()).data || []);
      if (whitelistRes.ok) setWhitelist((await whitelistRes.json()).data || []);
      if (statusRes.ok) setScanStatus((await statusRes.json()).data || null);
    } catch (error) {
      console.error("Failed to load copyright data:", error);
      setBanner({ kind: "error", text: "Could not load data. Please refresh." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated" && session?.user?.role === "admin") loadAll();
  }, [authStatus, session, loadAll]);

  const songById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);

  const filteredSongs = useMemo(() => {
    const query = songSearch.trim().toLowerCase();
    if (!query) return songs;
    return songs.filter((song) =>
      [song.title, song.artist, song.isrc, song.upc].some((field) =>
        (field || "").toLowerCase().includes(query)
      )
    );
  }, [songs, songSearch]);

  const visibleMatches = useMemo(() => {
    const query = matchSearch.trim().toLowerCase();
    return matches
      .filter((match) => {
        if (tab === "cases") return match.status !== "new" && match.status !== "ignored";
        if (matchStatusFilter && match.status !== matchStatusFilter) return false;
        return true;
      })
      .filter((match) => {
        if (!query) return true;
        return [match.videoTitle, match.channelTitle, match.songTitle].some((field) =>
          (field || "").toLowerCase().includes(query)
        );
      });
  }, [matches, matchSearch, matchStatusFilter, tab]);

  // ---------- Songs ----------

  const saveSong = async () => {
    if (!draft?.title?.trim()) {
      setBanner({ kind: "error", text: "Song title is required." });
      return;
    }
    setBusy("song");
    try {
      const payload = {
        id: draft.id,
        title: draft.title,
        artist: draft.artist || "",
        isrc: draft.isrc || "",
        upc: draft.upc || "",
        aliases: draft.aliasText
          ? draft.aliasText.split(/[|;,]/).map((alias) => alias.trim()).filter(Boolean)
          : [],
        duration: draft.durationText || "",
        originalVideoUrl: draft.originalVideoUrl || "",
        releaseDate: draft.releaseDate || "",
        priority: draft.priority || "normal",
        active: draft.active !== false,
      };
      const response = await fetch("/api/copyright/songs", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Failed");
      setDraft(null);
      setBanner({ kind: "ok", text: draft.id ? "Song updated." : "Song added." });
      await loadAll();
    } catch (error) {
      setBanner({ kind: "error", text: error instanceof Error ? error.message : "Failed to save song." });
    } finally {
      setBusy("");
    }
  };

  const deleteSong = async (song: Song) => {
    if (!window.confirm(`Delete "${song.title}" from the catalog?`)) return;
    setBusy("song");
    try {
      await fetch(`/api/copyright/songs?id=${encodeURIComponent(song.id)}`, { method: "DELETE" });
      await loadAll();
    } finally {
      setBusy("");
    }
  };

  const importSongs = async (file: File) => {
    setBusy("import-songs");
    setBanner(null);
    try {
      const rows = await parseSongSheet(file);
      if (rows.length === 0) {
        setBanner({ kind: "error", text: "No song rows found. Check that the sheet has a Title column." });
        return;
      }
      const response = await fetch("/api/copyright/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs: rows }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Import failed");
      setBanner({
        kind: "ok",
        text: `Imported: ${json.data.created} new, ${json.data.updated} updated, ${json.data.skipped} skipped. Catalog now has ${json.data.total} songs.`,
      });
      await loadAll();
    } catch (error) {
      setBanner({ kind: "error", text: error instanceof Error ? error.message : "Import failed." });
    } finally {
      setBusy("");
    }
  };

  const exportSongs = () => {
    downloadExcel(
      SONG_TEMPLATE_HEADERS,
      songs.map((song) => [
        song.title,
        song.artist,
        song.isrc,
        song.upc,
        formatDuration(song.durationSec),
        song.aliases.join(" | "),
        song.releaseDate,
        song.originalVideoUrl,
        song.priority,
      ]),
      "bainsla-song-catalog",
      "Catalog"
    );
  };

  // ---------- Matches ----------

  const updateMatch = async (match: Match, status: string) => {
    setBusy(match.id);
    try {
      const response = await fetch("/api/copyright/matches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: match.id, status }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Failed");
      await loadAll();
    } catch (error) {
      setBanner({ kind: "error", text: error instanceof Error ? error.message : "Update failed." });
    } finally {
      setBusy("");
    }
  };

  const buildEvidence = (match: Match): string => {
    const song = songById.get(match.songId);
    return [
      "Copyright complaint — Bainsla Music",
      `Infringing video: ${match.videoUrl}`,
      `Channel: ${match.channelTitle} (${match.channelUrl})`,
      `Uploaded: ${formatDate(match.publishedAt)} | Views: ${match.views.toLocaleString()}`,
      "",
      `Our song: ${match.songTitle}${song?.artist ? ` — ${song.artist}` : ""}`,
      song?.isrc ? `ISRC: ${song.isrc}` : "",
      song?.upc ? `UPC: ${song.upc}` : "",
      song?.durationSec ? `Original duration: ${formatDuration(song.durationSec)}` : "",
      song?.originalVideoUrl ? `Our original upload: ${song.originalVideoUrl}` : "",
      "",
      `Detected on: ${formatDate(match.detectedAt)} | Match score: ${match.matchScore}%`,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const startStrike = async (match: Match) => {
    const evidence = buildEvidence(match);
    try {
      await navigator.clipboard.writeText(evidence);
      setBanner({ kind: "ok", text: "Evidence copied. Paste it into the YouTube removal form." });
    } catch {
      setBanner({ kind: "error", text: "Could not copy automatically — copy the details manually." });
    }
    window.open("https://www.youtube.com/copyright_complaint_form", "_blank", "noopener");
    await updateMatch(match, "strike_submitted");
  };

  // ---------- Whitelist ----------

  const addChannels = async (channels: { channelId?: string; channelTitle?: string; url?: string }[]) => {
    setBusy("whitelist");
    setBanner(null);
    try {
      const response = await fetch("/api/copyright/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed");
      const unresolved: string[] = json.data.unresolved || [];
      setBanner({
        kind: unresolved.length ? "error" : "ok",
        text: `${json.data.added} channel(s) whitelisted, ${json.data.skipped} already there.${
          unresolved.length ? ` Could not read: ${unresolved.slice(0, 5).join(", ")}` : ""
        }`,
      });
      await loadAll();
    } catch (error) {
      setBanner({ kind: "error", text: error instanceof Error ? error.message : "Failed." });
    } finally {
      setBusy("");
    }
  };

  const importChannels = async (file: File) => {
    setBusy("import-channels");
    try {
      const rows = await parseChannelSheet(file);
      if (rows.length === 0) {
        setBanner({ kind: "error", text: "No channel IDs or links found in that sheet." });
        return;
      }
      await addChannels(rows);
    } catch (error) {
      setBanner({ kind: "error", text: error instanceof Error ? error.message : "Import failed." });
    } finally {
      setBusy("");
    }
  };

  const removeWhitelisted = async (entry: WhitelistEntry) => {
    setBusy(entry.channelId);
    try {
      await fetch(`/api/copyright/whitelist?channelId=${encodeURIComponent(entry.channelId)}`, {
        method: "DELETE",
      });
      await loadAll();
    } finally {
      setBusy("");
    }
  };

  // ---------- Scan settings ----------

  const saveConfig = async (patch: Partial<ScanStatus["config"]>) => {
    if (!scanStatus) return;
    setBusy("config");
    try {
      const response = await fetch("/api/copyright/scan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scanStatus.config, ...patch }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Failed");
      await loadAll();
      setBanner({ kind: "ok", text: "Scan settings saved." });
    } catch (error) {
      setBanner({ kind: "error", text: error instanceof Error ? error.message : "Failed." });
    } finally {
      setBusy("");
    }
  };

  const runScanNow = async () => {
    setBusy("scan");
    setBanner(null);
    try {
      const response = await fetch("/api/copyright/scan", { method: "POST" });
      const json = await response.json();
      const summary = json.data;
      if (!summary) throw new Error(json.error || "Scan failed");
      setBanner({
        kind: summary.status === "completed" ? "ok" : "error",
        text: `${summary.status}: ${summary.songsScanned} songs, ${summary.newMatches} new matches, ${summary.unitsUsed} units used. ${summary.note || ""}`,
      });
      await loadAll();
    } catch (error) {
      setBanner({ kind: "error", text: error instanceof Error ? error.message : "Scan failed." });
    } finally {
      setBusy("");
    }
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const newCount = matches.filter((match) => match.status === "new").length;
  const caseCount = matches.filter(
    (match) => match.status !== "new" && match.status !== "ignored"
  ).length;

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { key: "songs", label: "Songs", icon: Music, badge: songs.length },
    { key: "matches", label: "Matches", icon: AlertTriangle, badge: newCount },
    { key: "cases", label: "Cases", icon: ShieldCheck, badge: caseCount },
    { key: "whitelist", label: "Whitelist", icon: Shield, badge: whitelist.length },
    { key: "settings", label: "Scan & Quota", icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Copyright Monitoring</h1>
          <p className="text-sm text-slate-500">
            Song catalog, reused-upload detection, whitelist, and takedown tracking.
          </p>
        </div>
        <button
          onClick={() => {
            setBusy("refresh");
            loadAll().finally(() => setBusy(""));
          }}
          disabled={busy === "refresh"}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${busy === "refresh" ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {banner && (
        <div
          className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
            banner.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
          }`}
        >
          {banner.kind === "ok" ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{banner.text}</span>
          <button onClick={() => setBanner(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === item.key
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-xs text-slate-600">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "songs" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={songSearch}
                onChange={(event) => setSongSearch(event.target.value)}
                placeholder="Search title, artist, ISRC, UPC…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
              />
            </div>
            <button
              onClick={() => setDraft(emptyDraft())}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark"
            >
              <Plus className="w-4 h-4" /> Add song
            </button>
            <button
              onClick={() => songFileRef.current?.click()}
              disabled={busy === "import-songs"}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60"
            >
              {busy === "import-songs" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Import Excel / CSV
            </button>
            <button
              onClick={exportSongs}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              onClick={() => downloadExcel(SONG_TEMPLATE_HEADERS, [], "bainsla-catalog-template", "Catalog")}
              className="text-sm text-primary hover:underline"
            >
              Template
            </button>
            <input
              ref={songFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) importSongs(file);
              }}
            />
          </div>

          <p className="text-xs text-slate-500">
            Re-uploading a bigger sheet is safe: songs already in the catalog are updated (matched on
            ISRC, otherwise title + artist) and only the new ones are added.
          </p>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3">Artist</th>
                  <th className="text-left px-4 py-3">ISRC</th>
                  <th className="text-left px-4 py-3">UPC</th>
                  <th className="text-left px-4 py-3">Length</th>
                  <th className="text-left px-4 py-3">Priority</th>
                  <th className="text-left px-4 py-3">Last scan</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSongs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      No songs yet. Add one or import your catalog Excel.
                    </td>
                  </tr>
                )}
                {filteredSongs.map((song) => (
                  <tr key={song.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {song.title}
                      {!song.active && <span className="ml-2 text-xs text-slate-400">(paused)</span>}
                      {song.aliases.length > 0 && (
                        <div className="text-xs text-slate-400">alias: {song.aliases.join(", ")}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{song.artist || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{song.isrc || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{song.upc || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDuration(song.durationSec)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          song.priority === "high"
                            ? "bg-red-50 text-red-600"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {song.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(song.lastScannedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            setDraft({
                              ...song,
                              aliasText: song.aliases.join(", "),
                              durationText: song.durationSec ? formatDuration(song.durationSec) : "",
                            })
                          }
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteSong(song)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {(tab === "matches" || tab === "cases") && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={matchSearch}
                onChange={(event) => setMatchSearch(event.target.value)}
                placeholder="Search video, channel, or song…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
              />
            </div>
            {tab === "matches" && (
              <select
                value={matchStatusFilter}
                onChange={(event) => setMatchStatusFilter(event.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
              >
                <option value="new">New</option>
                <option value="confirmed">Confirmed</option>
                <option value="ignored">Ignored</option>
                <option value="">All</option>
              </select>
            )}
          </div>

          {visibleMatches.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-12 text-center text-slate-500">
              Nothing here yet. Matches appear after a scan runs.
            </div>
          )}

          <div className="space-y-3">
            {visibleMatches.map((match) => (
              <div
                key={match.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row gap-4"
              >
                <a href={match.videoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  {match.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={match.thumbnailUrl}
                      alt=""
                      className="w-40 h-24 object-cover rounded-lg bg-slate-100"
                    />
                  ) : (
                    <div className="w-40 h-24 rounded-lg bg-slate-100" />
                  )}
                </a>

                <div className="flex-1 min-w-0 space-y-1">
                  <a
                    href={match.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-slate-900 hover:text-primary flex items-start gap-1"
                  >
                    <span className="line-clamp-2">{match.videoTitle || match.videoId}</span>
                    <ExternalLink className="w-3.5 h-3.5 mt-1 shrink-0 text-slate-400" />
                  </a>
                  <div className="text-sm text-slate-600">
                    <a
                      href={match.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary hover:underline"
                    >
                      {match.channelTitle || match.channelId}
                    </a>
                    {" · "}
                    {match.views.toLocaleString()} views · uploaded {formatDate(match.publishedAt)} ·{" "}
                    {formatDuration(match.durationSec)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                      matched: {match.songTitle}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full ${
                        match.matchScore >= 85
                          ? "bg-red-50 text-red-700"
                          : match.matchScore >= 70
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      score {match.matchScore}%
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full ${
                        STATUS_LABELS[match.status]?.color || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {STATUS_LABELS[match.status]?.label || match.status}
                    </span>
                    <span className="text-slate-400">{match.matchedOn}</span>
                  </div>
                </div>

                <div className="flex md:flex-col flex-wrap gap-2 md:w-44 shrink-0">
                  {match.status === "new" && (
                    <button
                      onClick={() => updateMatch(match, "confirmed")}
                      disabled={busy === match.id}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      <BadgeCheck className="w-3.5 h-3.5" /> Confirm copy
                    </button>
                  )}
                  <button
                    onClick={() => startStrike(match)}
                    disabled={busy === match.id}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-60"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy + open form
                  </button>
                  <select
                    value={match.status}
                    onChange={(event) => updateMatch(match, event.target.value)}
                    disabled={busy === match.id}
                    className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="new">New</option>
                    <option value="confirmed">Confirmed copy</option>
                    <option value="strike_submitted">Strike submitted</option>
                    <option value="removed">Removed</option>
                    <option value="rejected">Rejected</option>
                    <option value="ignored">Ignored</option>
                  </select>
                  <button
                    onClick={() => updateMatch(match, "whitelisted")}
                    disabled={busy === match.id}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
                    title="This is our own / allowed channel"
                  >
                    <Ban className="w-3.5 h-3.5" /> Whitelist channel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "whitelist" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={channelInput}
              onChange={(event) => setChannelInput(event.target.value)}
              placeholder="Paste channel link, @handle, or UC id…"
              className="flex-1 min-w-[240px] px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
            />
            <button
              onClick={async () => {
                if (!channelInput.trim()) return;
                await addChannels([{ url: channelInput.trim() }]);
                setChannelInput("");
              }}
              disabled={busy === "whitelist"}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-60"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
            <button
              onClick={() => channelFileRef.current?.click()}
              disabled={busy === "import-channels"}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60"
            >
              {busy === "import-channels" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Import channel Excel
            </button>
            <button
              onClick={() =>
                downloadExcel(CHANNEL_TEMPLATE_HEADERS, [], "bainsla-whitelist-template", "Channels")
              }
              className="text-sm text-primary hover:underline"
            >
              Template
            </button>
            <input
              ref={channelFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) importChannels(file);
              }}
            />
          </div>

          <p className="text-xs text-slate-500">
            Whitelisted channels never show up as suspected copies. Channels authorised inside this
            CMS are skipped automatically — this list is for your other own/reuse channels.
          </p>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Channel</th>
                  <th className="text-left px-4 py-3">Channel ID</th>
                  <th className="text-left px-4 py-3">Reason</th>
                  <th className="text-left px-4 py-3">Added</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {whitelist.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No whitelisted channels yet.
                    </td>
                  </tr>
                )}
                {whitelist.map((entry) => (
                  <tr key={entry.channelId} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <a
                        href={`https://www.youtube.com/channel/${entry.channelId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary hover:underline"
                      >
                        {entry.channelTitle || entry.channelId}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{entry.channelId}</td>
                    <td className="px-4 py-3 text-slate-600">{entry.reason}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(entry.addedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => removeWhitelisted(entry)}
                        disabled={busy === entry.channelId}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-60"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "settings" && scanStatus && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs uppercase">
                <Gauge className="w-4 h-4" /> Quota used today
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {scanStatus.unitsUsedToday.toLocaleString()}
                <span className="text-sm font-normal text-slate-500">
                  {" "}
                  / {scanStatus.config.dailyUnitBudget.toLocaleString()} units
                </span>
              </p>
              <div className="h-2 rounded-full bg-slate-100 mt-3 overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${Math.min(
                      100,
                      (scanStatus.unitsUsedToday / Math.max(1, scanStatus.config.dailyUnitBudget)) * 100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Scanning stops on its own when the budget runs out, and resumes the next day.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-slate-500 text-xs uppercase">This schedule</div>
              <p className="text-sm text-slate-900 mt-2 font-medium">
                {SCHEDULE_LABELS[scanStatus.config.schedule]}
              </p>
              <ul className="text-xs text-slate-600 mt-2 space-y-1">
                <li>{scanStatus.songs.active} active songs</li>
                <li>
                  {scanStatus.plan.songsPerRun} songs per run ·{" "}
                  {scanStatus.plan.unitsPerRun.toLocaleString()} units
                </li>
                <li>Full cycle ≈ {scanStatus.plan.unitsPerCycle.toLocaleString()} units</li>
                <li className={scanStatus.plan.budgetFits ? "text-green-600" : "text-red-600"}>
                  {scanStatus.plan.budgetFits
                    ? "Fits inside the daily budget"
                    : "Over the daily budget — raise the budget or pick a longer schedule"}
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-slate-500 text-xs uppercase">Last run</div>
              <p className="text-sm text-slate-900 mt-2">{formatDate(scanStatus.state.lastRunAt)}</p>
              <ul className="text-xs text-slate-600 mt-2 space-y-1">
                <li>{scanStatus.state.lastRunSongs} songs scanned</li>
                <li>{scanStatus.state.lastRunMatches} new matches</li>
                <li>{scanStatus.state.lastRunUnits.toLocaleString()} units spent</li>
                {scanStatus.state.lastRunNote && (
                  <li className="text-slate-400">{scanStatus.state.lastRunNote}</li>
                )}
              </ul>
              <button
                onClick={runScanNow}
                disabled={busy === "scan"}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {busy === "scan" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Scan now
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <h2 className="font-semibold text-slate-900">Scan settings</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Schedule</span>
                <select
                  value={scanStatus.config.schedule}
                  onChange={(event) =>
                    saveConfig({ schedule: event.target.value as ScanStatus["config"]["schedule"] })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                >
                  <option value="daily">{SCHEDULE_LABELS.daily}</option>
                  <option value="mon_wed_fri">{SCHEDULE_LABELS.mon_wed_fri}</option>
                  <option value="weekly">{SCHEDULE_LABELS.weekly}</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="block text-slate-600 mb-1">
                  Search variants per song (each costs 100 units)
                </span>
                <select
                  value={scanStatus.config.variantsPerSong}
                  onChange={(event) => saveConfig({ variantsPerSong: Number(event.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                >
                  <option value={1}>1 — title only</option>
                  <option value={2}>2 — title + artist, title</option>
                  <option value={3}>3 — also the first alias</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Daily scan budget (units)</span>
                <input
                  type="number"
                  defaultValue={scanStatus.config.dailyUnitBudget}
                  min={1000}
                  step={1000}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (value && value !== scanStatus.config.dailyUnitBudget) {
                      saveConfig({ dailyUnitBudget: value });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
                <span className="text-xs text-slate-500">
                  Keep some of the 210,000 daily units free for the dashboard.
                </span>
              </label>

              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Minimum match score (%)</span>
                <input
                  type="number"
                  defaultValue={scanStatus.config.minMatchScore}
                  min={30}
                  max={100}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (value && value !== scanStatus.config.minMatchScore) {
                      saveConfig({ minMatchScore: value });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
                <span className="text-xs text-slate-500">
                  Lower finds more but adds noise; higher is stricter.
                </span>
              </label>
            </div>

            <div className="flex flex-wrap gap-6 pt-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={scanStatus.config.enabled}
                  onChange={(event) => saveConfig({ enabled: event.target.checked })}
                />
                Automatic scanning on
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={scanStatus.config.watchlistEnabled}
                  onChange={(event) => saveConfig({ watchlistEnabled: event.target.checked })}
                />
                Also re-check repeat offender channels (1 unit each)
              </label>
            </div>

            <p className="text-xs text-slate-500">
              Detection works from titles, aliases, artist names, and track length — not from audio
              fingerprints. Uploads renamed beyond recognition can still be missed; exact audio
              matching needs YouTube Content ID access.
            </p>
          </div>
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">{draft.id ? "Edit song" : "Add song"}</h2>
              <button onClick={() => setDraft(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm md:col-span-2">
                <span className="block text-slate-600 mb-1">Title *</span>
                <input
                  value={draft.title || ""}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Artist</span>
                <input
                  value={draft.artist || ""}
                  onChange={(event) => setDraft({ ...draft, artist: event.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Duration (mm:ss)</span>
                <input
                  value={draft.durationText}
                  onChange={(event) => setDraft({ ...draft, durationText: event.target.value })}
                  placeholder="3:45"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">ISRC</span>
                <input
                  value={draft.isrc || ""}
                  onChange={(event) => setDraft({ ...draft, isrc: event.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">UPC</span>
                <input
                  value={draft.upc || ""}
                  onChange={(event) => setDraft({ ...draft, upc: event.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="block text-slate-600 mb-1">
                  Aliases / alternate spellings (comma separated)
                </span>
                <input
                  value={draft.aliasText}
                  onChange={(event) => setDraft({ ...draft, aliasText: event.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="block text-slate-600 mb-1">Our original video link</span>
                <input
                  value={draft.originalVideoUrl || ""}
                  onChange={(event) => setDraft({ ...draft, originalVideoUrl: event.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Release date</span>
                <input
                  value={draft.releaseDate || ""}
                  onChange={(event) => setDraft({ ...draft, releaseDate: event.target.value })}
                  placeholder="2024-05-01"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600 mb-1">Scan priority</span>
                <select
                  value={draft.priority || "normal"}
                  onChange={(event) =>
                    setDraft({ ...draft, priority: event.target.value as Song["priority"] })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High — scan first</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.active !== false}
                  onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                />
                Include this song in scans
              </label>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button
                onClick={() => setDraft(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={saveSong}
                disabled={busy === "song"}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {busy === "song" && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
