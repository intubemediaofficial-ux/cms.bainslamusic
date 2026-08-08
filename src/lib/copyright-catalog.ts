import { kv } from "@/lib/redis";

const SONGS_KEY = "cms_copyright_songs";
const MATCHES_KEY = "cms_copyright_matches";
const WHITELIST_KEY = "cms_copyright_whitelist";
const CONFIG_KEY = "cms_copyright_config";
const STATE_KEY = "cms_copyright_state";
const QUOTA_KEY_PREFIX = "cms_copyright_quota:";

/** Keep the match list bounded so the Redis value stays a reasonable size. */
const MAX_STORED_MATCHES = 5000;

export type SongPriority = "high" | "normal";

export interface CatalogSong {
  id: string;
  title: string;
  artist: string;
  isrc: string;
  upc: string;
  /** Alternate titles/spellings (Hindi, romanised, remix names). */
  aliases: string[];
  /** Track length in seconds; 0 when unknown. */
  durationSec: number;
  /** Our own upload of this song, used as evidence when filing a claim. */
  originalVideoUrl: string;
  releaseDate: string;
  priority: SongPriority;
  active: boolean;
  lastScannedAt: string;
  lastMatchCount: number;
  createdAt: string;
  updatedAt: string;
}

export type MatchStatus =
  | "new"
  | "confirmed"
  | "ignored"
  | "strike_submitted"
  | "removed"
  | "rejected";

export interface CopyrightMatch {
  /** `${songId}:${videoId}` — stable so re-scans never duplicate a row. */
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
  /** 0-100 confidence that this upload uses our song. */
  matchScore: number;
  /** Which query variant / source found it (e.g. `search: title + artist`). */
  matchedOn: string;
  status: MatchStatus;
  note: string;
  detectedAt: string;
  updatedAt: string;
}

export interface WhitelistChannel {
  channelId: string;
  channelTitle: string;
  reason: string;
  addedBy: string;
  addedAt: string;
}

export type ScanSchedule = "daily" | "mon_wed_fri" | "weekly";

export interface ScanConfig {
  enabled: boolean;
  /** How the catalog is spread out: 1 run/day, 3 runs/week, or 1/7th per day. */
  schedule: ScanSchedule;
  /** Search query variants per song (1-3). Each variant costs 100 units. */
  variantsPerSong: number;
  /** Units the scanner may spend per day; the rest is left for the dashboard. */
  dailyUnitBudget: number;
  /** Matches below this score are discarded. */
  minMatchScore: number;
  /** Also check known offender channels' newest uploads (1 unit per channel). */
  watchlistEnabled: boolean;
}

export interface ScanState {
  running: boolean;
  startedAt: string;
  lastRunAt: string;
  lastRunSongs: number;
  lastRunMatches: number;
  lastRunUnits: number;
  lastRunNote: string;
}

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  enabled: true,
  schedule: "weekly",
  variantsPerSong: 2,
  dailyUnitBudget: 150000,
  minMatchScore: 60,
  watchlistEnabled: true,
};

const DEFAULT_SCAN_STATE: ScanState = {
  running: false,
  startedAt: "",
  lastRunAt: "",
  lastRunSongs: 0,
  lastRunMatches: 0,
  lastRunUnits: 0,
  lastRunNote: "",
};

// ---------- Songs ----------

export async function getSongs(): Promise<CatalogSong[]> {
  return (await kv.get<CatalogSong[]>(SONGS_KEY)) || [];
}

export async function saveSongs(songs: CatalogSong[]): Promise<void> {
  await kv.set(SONGS_KEY, songs);
}

export function normaliseText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words that carry no signal when comparing a song title to a video title. */
const NOISE_WORDS = new Set([
  "official",
  "video",
  "song",
  "audio",
  "full",
  "hd",
  "4k",
  "new",
  "latest",
  "lyrical",
  "lyrics",
  "status",
  "shorts",
  "short",
  "reels",
  "reel",
  "dj",
  "remix",
  "cover",
  "live",
  "music",
  "mp3",
  "the",
  "a",
  "an",
  "and",
  "ka",
  "ki",
  "ke",
  "me",
  "mein",
  "se",
  "hai",
  "ho",
]);

export function titleTokens(value: string): string[] {
  return normaliseText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !NOISE_WORDS.has(token));
}

export function makeSongId(): string {
  return `song_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptySong(): CatalogSong {
  const now = new Date().toISOString();
  return {
    id: makeSongId(),
    title: "",
    artist: "",
    isrc: "",
    upc: "",
    aliases: [],
    durationSec: 0,
    originalVideoUrl: "",
    releaseDate: "",
    priority: "normal",
    active: true,
    lastScannedAt: "",
    lastMatchCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Merge an incoming (imported or manually entered) song into the catalog.
 * Existing rows are matched on ISRC first, then on normalised title + artist,
 * so re-uploading a bigger sheet updates old songs and appends only new ones.
 */
export function mergeSong(
  songs: CatalogSong[],
  incoming: Partial<CatalogSong> & { title: string }
): { songs: CatalogSong[]; created: boolean } {
  const isrc = (incoming.isrc || "").trim().toUpperCase();
  const titleKey = normaliseText(incoming.title);
  const artistKey = normaliseText(incoming.artist || "");

  const index = songs.findIndex((song) => {
    if (isrc && song.isrc.trim().toUpperCase() === isrc) return true;
    if (!titleKey) return false;
    if (normaliseText(song.title) !== titleKey) return false;
    // Only require the artist to line up when both sides declare one.
    if (!artistKey || !song.artist) return true;
    return normaliseText(song.artist) === artistKey;
  });

  const now = new Date().toISOString();

  if (index >= 0) {
    const existing = songs[index];
    songs[index] = {
      ...existing,
      title: incoming.title || existing.title,
      artist: incoming.artist ?? existing.artist,
      isrc: incoming.isrc ?? existing.isrc,
      upc: incoming.upc ?? existing.upc,
      aliases: incoming.aliases?.length ? incoming.aliases : existing.aliases,
      durationSec: incoming.durationSec ?? existing.durationSec,
      originalVideoUrl: incoming.originalVideoUrl ?? existing.originalVideoUrl,
      releaseDate: incoming.releaseDate ?? existing.releaseDate,
      priority: incoming.priority ?? existing.priority,
      active: incoming.active ?? existing.active,
      updatedAt: now,
    };
    return { songs, created: false };
  }

  songs.push({ ...emptySong(), ...incoming, createdAt: now, updatedAt: now });
  return { songs, created: true };
}

// ---------- Matches ----------

export async function getMatches(): Promise<CopyrightMatch[]> {
  return (await kv.get<CopyrightMatch[]>(MATCHES_KEY)) || [];
}

export async function saveMatches(matches: CopyrightMatch[]): Promise<void> {
  // Newest first, then trim — confirmed/strike rows are always kept.
  const sorted = [...matches].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  if (sorted.length <= MAX_STORED_MATCHES) {
    await kv.set(MATCHES_KEY, sorted);
    return;
  }
  const important = sorted.filter((m) => m.status !== "new" && m.status !== "ignored");
  const rest = sorted.filter((m) => m.status === "new" || m.status === "ignored");
  await kv.set(MATCHES_KEY, [...important, ...rest].slice(0, MAX_STORED_MATCHES));
}

// ---------- Whitelist ----------

export async function getWhitelist(): Promise<WhitelistChannel[]> {
  return (await kv.get<WhitelistChannel[]>(WHITELIST_KEY)) || [];
}

export async function saveWhitelist(entries: WhitelistChannel[]): Promise<void> {
  await kv.set(WHITELIST_KEY, entries);
}

/** Pull a UCxxxx channel id out of a raw link, handle, or bare id. */
export function extractChannelId(raw: string): string {
  const value = (raw || "").trim();
  if (!value) return "";
  const direct = value.match(/(UC[\w-]{20,})/);
  if (direct) return direct[1];
  return "";
}

/** A channel handle (@name) or /c/name slug, used when no UC id is available. */
export function extractChannelHandle(raw: string): string {
  const value = (raw || "").trim();
  if (!value) return "";
  const at = value.match(/@([\w.\-]+)/);
  if (at) return `@${at[1]}`;
  const slug = value.match(/youtube\.com\/(?:c|user)\/([\w.\-]+)/i);
  if (slug) return slug[1];
  return "";
}

// ---------- Config / state ----------

export async function getScanConfig(): Promise<ScanConfig> {
  const stored = await kv.get<Partial<ScanConfig>>(CONFIG_KEY);
  return { ...DEFAULT_SCAN_CONFIG, ...(stored || {}) };
}

export async function saveScanConfig(config: ScanConfig): Promise<void> {
  await kv.set(CONFIG_KEY, config);
}

export async function getScanState(): Promise<ScanState> {
  const stored = await kv.get<Partial<ScanState>>(STATE_KEY);
  return { ...DEFAULT_SCAN_STATE, ...(stored || {}) };
}

export async function saveScanState(state: ScanState): Promise<void> {
  await kv.set(STATE_KEY, state);
}

// ---------- Quota accounting ----------

function quotaKey(date = new Date()): string {
  return `${QUOTA_KEY_PREFIX}${date.toISOString().slice(0, 10)}`;
}

export async function getUnitsUsedToday(): Promise<number> {
  return (await kv.get<number>(quotaKey())) || 0;
}

export async function addUnitsUsed(units: number): Promise<number> {
  const key = quotaKey();
  const total = ((await kv.get<number>(key)) || 0) + units;
  // Keep two days of history so a run spanning midnight still reads correctly.
  await kv.set(key, total, { ex: 60 * 60 * 48 });
  return total;
}
