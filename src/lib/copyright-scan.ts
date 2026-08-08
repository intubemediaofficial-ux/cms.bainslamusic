import { google, youtube_v3 } from "googleapis";
import { getAllCachedClientData } from "@/lib/client-data-cache";
import {
  CatalogSong,
  CopyrightMatch,
  ScanConfig,
  addUnitsUsed,
  getMatches,
  getScanConfig,
  getScanState,
  getSongs,
  getUnitsUsedToday,
  getWhitelist,
  normaliseText,
  saveMatches,
  saveScanState,
  saveSongs,
  titleTokens,
} from "@/lib/copyright-catalog";

/** YouTube Data API quota costs. A keyword search is 100x a plain list call. */
const UNITS_SEARCH = 100;
const UNITS_LIST = 1;

/** Recent uploads pulled per watchlist channel (1 unit per channel, any size). */
const WATCHLIST_UPLOADS_PER_CHANNEL = 15;
const WATCHLIST_MAX_CHANNELS_PER_RUN = 400;
const WATCHLIST_LOOKBACK_DAYS = 21;

/** A run is considered dead after this long so a crash can't block the cron. */
const STALE_LOCK_MS = 60 * 60 * 1000;

/**
 * Google meters `search.list` twice: against the project's unit budget and
 * against a separate "Search queries per day" limit that is usually much
 * smaller. Once that limit answers 429 every further search is wasted, so the
 * sweep stops and the songs it never reached keep their old `lastScannedAt`.
 */
function isSearchQuotaError(error: unknown): boolean {
  const status = (error as { code?: number; status?: number })?.code ?? (error as { status?: number })?.status;
  if (status === 429 || status === 403) {
    const message = error instanceof Error ? error.message : String(error);
    return /quota|rate limit|too many requests/i.test(message) || status === 429;
  }
  return false;
}

export type ScanTrigger = "cron" | "manual";

export interface ScanSummary {
  status:
    | "completed"
    | "skipped_disabled"
    | "skipped_schedule"
    | "skipped_quota"
    | "already_running"
    | "no_songs"
    | "no_api_key"
    | "failed";
  songsScanned: number;
  newMatches: number;
  unitsUsed: number;
  unitsUsedToday: number;
  watchlistChannelsChecked: number;
  note: string;
}

function getApiKeyYouTube(): youtube_v3.Youtube | null {
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return google.youtube({ version: "v3", auth: apiKey });
}

/** Runs per weekly cycle: the catalog is split evenly across them. */
function runsPerCycle(schedule: ScanConfig["schedule"]): number {
  if (schedule === "daily") return 1;
  if (schedule === "mon_wed_fri") return 3;
  return 7;
}

export function shouldRunToday(config: ScanConfig, now = new Date()): boolean {
  if (config.schedule !== "mon_wed_fri") return true;
  const day = now.getUTCDay(); // 0 = Sunday
  return day === 1 || day === 3 || day === 5;
}

function parseIsoDuration(value: string | null | undefined): number {
  if (!value) return 0;
  const match = value.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, d, h, m, s] = match;
  return Number(d || 0) * 86400 + Number(h || 0) * 3600 + Number(m || 0) * 60 + Number(s || 0);
}

/** Build the keyword queries used to hunt for copies of a song. */
export function buildQueries(song: CatalogSong, variants: number): string[] {
  const queries: string[] = [];
  const title = song.title.trim();
  if (!title) return queries;

  if (song.artist.trim()) queries.push(`"${title}" ${song.artist.trim()}`);
  queries.push(`"${title}"`);
  for (const alias of song.aliases) {
    if (alias.trim()) queries.push(`"${alias.trim()}"`);
  }

  const unique = [...new Set(queries)];
  return unique.slice(0, Math.max(1, Math.min(variants, unique.length)));
}

/**
 * 0-100 confidence that a video uses our song. Title token coverage carries
 * most of the weight; duration proximity and artist name refine it.
 */
export function scoreCandidate(
  song: CatalogSong,
  videoTitle: string,
  channelTitle: string,
  videoDurationSec: number
): number {
  const songTokens = titleTokens(song.title);
  if (songTokens.length === 0) return 0;

  const normalisedVideoTitle = normaliseText(videoTitle);
  const videoTokenSet = new Set(normalisedVideoTitle.split(" "));
  const matched = songTokens.filter((token) => videoTokenSet.has(token)).length;
  let score = (matched / songTokens.length) * 70;

  // Exact phrase in the title is a much stronger signal than scattered words.
  if (normalisedVideoTitle.includes(normaliseText(song.title))) score += 10;

  const artistTokens = titleTokens(song.artist);
  if (artistTokens.length) {
    const haystack = `${normalisedVideoTitle} ${normaliseText(channelTitle)}`;
    if (artistTokens.some((token) => haystack.includes(token))) score += 10;
  }

  if (song.durationSec > 0 && videoDurationSec > 0) {
    const diff = Math.abs(song.durationSec - videoDurationSec);
    if (diff <= 5) score += 20;
    else if (diff <= 15) score += 12;
    else if (diff <= 30) score += 5;
    else if (diff > 90) score -= 20;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

interface Candidate {
  videoId: string;
  songId: string;
  matchedOn: string;
}

interface VideoDetail {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  views: number;
  durationSec: number;
}

async function fetchVideoDetails(
  youtube: youtube_v3.Youtube,
  videoIds: string[]
): Promise<{ details: Map<string, VideoDetail>; units: number }> {
  const details = new Map<string, VideoDetail>();
  let units = 0;

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const response = await youtube.videos.list({
      part: ["snippet", "statistics", "contentDetails"],
      id: batch,
    });
    units += UNITS_LIST;
    for (const item of response.data.items || []) {
      if (!item.id) continue;
      details.set(item.id, {
        id: item.id,
        title: item.snippet?.title || "",
        channelId: item.snippet?.channelId || "",
        channelTitle: item.snippet?.channelTitle || "",
        publishedAt: item.snippet?.publishedAt || "",
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          "",
        views: Number(item.statistics?.viewCount || 0),
        durationSec: parseIsoDuration(item.contentDetails?.duration),
      });
    }
  }

  return { details, units };
}

function buildMatch(
  song: CatalogSong,
  detail: VideoDetail,
  score: number,
  matchedOn: string
): CopyrightMatch {
  const now = new Date().toISOString();
  return {
    id: `${song.id}:${detail.id}`,
    songId: song.id,
    songTitle: song.title,
    videoId: detail.id,
    videoTitle: detail.title,
    videoUrl: `https://www.youtube.com/watch?v=${detail.id}`,
    channelId: detail.channelId,
    channelTitle: detail.channelTitle,
    channelUrl: detail.channelId ? `https://www.youtube.com/channel/${detail.channelId}` : "",
    thumbnailUrl: detail.thumbnailUrl,
    publishedAt: detail.publishedAt,
    views: detail.views,
    durationSec: detail.durationSec,
    matchScore: score,
    matchedOn,
    status: "new",
    note: "",
    detectedAt: now,
    updatedAt: now,
  };
}

/** Channel ids we must never report: our own authorised channels + whitelist. */
async function getExcludedChannelIds(): Promise<Set<string>> {
  const excluded = new Set<string>();

  for (const entry of await getWhitelist()) {
    if (entry.channelId) excluded.add(entry.channelId);
  }

  try {
    for (const client of await getAllCachedClientData()) {
      for (const channel of client.channels || []) {
        if (channel.channelId) excluded.add(channel.channelId);
      }
    }
  } catch (error) {
    console.warn("[copyright-scan] could not load own channels:", error);
  }

  return excluded;
}

export async function runCopyrightScan(
  trigger: ScanTrigger = "cron"
): Promise<ScanSummary> {
  const config = await getScanConfig();
  const empty: ScanSummary = {
    status: "completed",
    songsScanned: 0,
    newMatches: 0,
    unitsUsed: 0,
    unitsUsedToday: await getUnitsUsedToday(),
    watchlistChannelsChecked: 0,
    note: "",
  };

  if (!config.enabled && trigger === "cron") {
    return { ...empty, status: "skipped_disabled", note: "Scanning is turned off" };
  }
  if (trigger === "cron" && !shouldRunToday(config)) {
    return { ...empty, status: "skipped_schedule", note: "Not a scan day for this schedule" };
  }

  const state = await getScanState();
  const startedMs = state.startedAt ? new Date(state.startedAt).getTime() : 0;
  if (state.running && Date.now() - startedMs < STALE_LOCK_MS) {
    return { ...empty, status: "already_running", note: "A scan is already running" };
  }

  const youtube = getApiKeyYouTube();
  if (!youtube) {
    return { ...empty, status: "no_api_key", note: "YOUTUBE_API_KEY / GOOGLE_API_KEY is not set" };
  }

  const songs = await getSongs();
  const activeSongs = songs.filter((song) => song.active && song.title.trim());
  if (activeSongs.length === 0) {
    return { ...empty, status: "no_songs", note: "No active songs in the catalog" };
  }

  const usedToday = await getUnitsUsedToday();
  let unitsRemaining = config.dailyUnitBudget - usedToday;
  if (unitsRemaining < UNITS_SEARCH) {
    return {
      ...empty,
      status: "skipped_quota",
      note: `Daily scan budget used (${usedToday}/${config.dailyUnitBudget} units)`,
    };
  }

  await saveScanState({ ...state, running: true, startedAt: new Date().toISOString() });

  let unitsUsed = 0;
  let songsScanned = 0;
  let watchlistChannelsChecked = 0;
  let searchQuotaHit = false;
  const newMatches: CopyrightMatch[] = [];

  try {
    const existingMatches = await getMatches();
    const knownMatchIds = new Set(existingMatches.map((match) => match.id));
    const excludedChannels = await getExcludedChannelIds();

    // ---- Phase 1: keyword sweep over this run's slice of the catalog ----
    const share = Math.ceil(activeSongs.length / runsPerCycle(config.schedule));
    const queue = [...activeSongs].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
      return (a.lastScannedAt || "").localeCompare(b.lastScannedAt || "");
    });

    const candidates: Candidate[] = [];
    const songById = new Map(activeSongs.map((song) => [song.id, song]));

    for (const song of queue) {
      if (searchQuotaHit) break;
      if (songsScanned >= share) break;
      const queries = buildQueries(song, config.variantsPerSong);
      if (queries.length === 0) continue;
      if (unitsRemaining < queries.length * UNITS_SEARCH) break;

      let searched = false;
      for (const query of queries) {
        try {
          const response = await youtube.search.list({
            part: ["snippet"],
            q: query,
            type: ["video"],
            maxResults: 50,
            // Incremental sweeps only care about uploads since the last scan.
            order: song.lastScannedAt ? "date" : "relevance",
            publishedAfter: song.lastScannedAt || undefined,
          });
          unitsUsed += UNITS_SEARCH;
          unitsRemaining -= UNITS_SEARCH;
          searched = true;

          for (const item of response.data.items || []) {
            const videoId = item.id?.videoId;
            const channelId = item.snippet?.channelId || "";
            if (!videoId) continue;
            if (channelId && excludedChannels.has(channelId)) continue;
            if (knownMatchIds.has(`${song.id}:${videoId}`)) continue;
            candidates.push({ videoId, songId: song.id, matchedOn: `search: ${query}` });
          }
        } catch (error) {
          if (isSearchQuotaError(error)) {
            searchQuotaHit = true;
            break;
          }
          console.warn(`[copyright-scan] search failed for "${query}":`, error);
        }
      }

      // Only a song we actually searched counts as scanned; otherwise the next
      // run would skip it and the catalogue would never be covered.
      if (!searched) continue;

      const index = songs.findIndex((s) => s.id === song.id);
      if (index >= 0) {
        songs[index] = { ...songs[index], lastScannedAt: new Date().toISOString() };
      }
      songsScanned += 1;
    }

    // ---- Phase 2: watchlist — repeat offenders, 1 unit per channel ----
    if (config.watchlistEnabled) {
      const offenderChannels = [
        ...new Set(
          existingMatches
            .filter((match) => match.status !== "ignored" && match.channelId)
            .map((match) => match.channelId)
        ),
      ]
        .filter((channelId) => !excludedChannels.has(channelId))
        .slice(0, WATCHLIST_MAX_CHANNELS_PER_RUN);

      const cutoff = Date.now() - WATCHLIST_LOOKBACK_DAYS * 86400 * 1000;

      for (const channelId of offenderChannels) {
        if (unitsRemaining < UNITS_LIST * 2) break;
        try {
          // A channel's uploads playlist id is its channel id with UC -> UU.
          const uploadsPlaylistId = `UU${channelId.slice(2)}`;
          const response = await youtube.playlistItems.list({
            part: ["contentDetails"],
            playlistId: uploadsPlaylistId,
            maxResults: WATCHLIST_UPLOADS_PER_CHANNEL,
          });
          unitsUsed += UNITS_LIST;
          unitsRemaining -= UNITS_LIST;
          watchlistChannelsChecked += 1;

          for (const item of response.data.items || []) {
            const videoId = item.contentDetails?.videoId;
            const publishedAt = item.contentDetails?.videoPublishedAt;
            if (!videoId) continue;
            if (publishedAt && new Date(publishedAt).getTime() < cutoff) continue;
            // Score against the whole catalogue locally — costs no quota.
            for (const song of activeSongs) {
              if (knownMatchIds.has(`${song.id}:${videoId}`)) continue;
              candidates.push({ videoId, songId: song.id, matchedOn: "watchlist channel upload" });
            }
          }
        } catch (error) {
          console.warn(`[copyright-scan] watchlist check failed for ${channelId}:`, error);
        }
      }
    }

    // ---- Resolve candidate details and score them ----
    const uniqueVideoIds = [...new Set(candidates.map((candidate) => candidate.videoId))];
    if (uniqueVideoIds.length > 0) {
      const { details, units } = await fetchVideoDetails(youtube, uniqueVideoIds);
      unitsUsed += units;
      unitsRemaining -= units;

      for (const candidate of candidates) {
        const detail = details.get(candidate.videoId);
        const song = songById.get(candidate.songId);
        if (!detail || !song) continue;
        if (detail.channelId && excludedChannels.has(detail.channelId)) continue;

        const matchId = `${song.id}:${detail.id}`;
        if (knownMatchIds.has(matchId)) continue;

        const score = scoreCandidate(song, detail.title, detail.channelTitle, detail.durationSec);
        if (score < config.minMatchScore) continue;

        knownMatchIds.add(matchId);
        newMatches.push(buildMatch(song, detail, score, candidate.matchedOn));
      }
    }

    if (newMatches.length > 0) {
      const perSong = new Map<string, number>();
      for (const match of newMatches) {
        perSong.set(match.songId, (perSong.get(match.songId) || 0) + 1);
      }
      for (const [songId, count] of perSong) {
        const index = songs.findIndex((song) => song.id === songId);
        if (index >= 0) {
          songs[index] = { ...songs[index], lastMatchCount: count };
        }
      }
      await saveMatches([...newMatches, ...existingMatches]);
    }

    await saveSongs(songs);
    const unitsUsedTodayTotal = await addUnitsUsed(unitsUsed);
    const note =
      `${songsScanned} songs scanned, ${watchlistChannelsChecked} watchlist channels checked` +
      (searchQuotaHit ? " — daily YouTube search-query limit reached, rest continues tomorrow" : "");

    await saveScanState({
      running: false,
      startedAt: "",
      lastRunAt: new Date().toISOString(),
      lastRunSongs: songsScanned,
      lastRunMatches: newMatches.length,
      lastRunUnits: unitsUsed,
      lastRunNote: note,
    });

    return {
      status: "completed",
      songsScanned,
      newMatches: newMatches.length,
      unitsUsed,
      unitsUsedToday: unitsUsedTodayTotal,
      watchlistChannelsChecked,
      note,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[copyright-scan] run failed:", message);
    const unitsUsedTodayTotal = await addUnitsUsed(unitsUsed);
    await saveScanState({
      running: false,
      startedAt: "",
      lastRunAt: new Date().toISOString(),
      lastRunSongs: songsScanned,
      lastRunMatches: newMatches.length,
      lastRunUnits: unitsUsed,
      lastRunNote: `Failed: ${message}`,
    });
    return {
      status: "failed",
      songsScanned,
      newMatches: newMatches.length,
      unitsUsed,
      unitsUsedToday: unitsUsedTodayTotal,
      watchlistChannelsChecked,
      note: message,
    };
  }
}
