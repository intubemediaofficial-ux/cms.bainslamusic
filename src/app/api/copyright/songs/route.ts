import {
  CatalogSong,
  getMatches,
  getSongs,
  mergeSong,
  saveMatches,
  saveSongs,
} from "@/lib/copyright-catalog";
import { isCopyrightAdmin } from "@/lib/copyright-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface SongInput {
  id?: string;
  title?: string;
  artist?: string;
  isrc?: string;
  upc?: string;
  aliases?: string[] | string;
  durationSec?: number | string;
  duration?: string;
  originalVideoUrl?: string;
  releaseDate?: string;
  priority?: string;
  active?: boolean;
}

/** Accepts 3:45, 03:45, 225, or "3 min 45 sec" style values. */
function parseDuration(value: number | string | undefined): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Math.max(0, Math.round(value));
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text);
  const parts = text.split(":").map((part) => Number(part.replace(/\D/g, "") || 0));
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  const minutes = text.match(/(\d+)\s*m/i);
  const seconds = text.match(/(\d+)\s*s/i);
  if (minutes || seconds) return Number(minutes?.[1] || 0) * 60 + Number(seconds?.[1] || 0);
  return 0;
}

function normaliseInput(input: SongInput): Partial<CatalogSong> & { title: string } {
  const aliases = Array.isArray(input.aliases)
    ? input.aliases
    : String(input.aliases || "")
        .split(/[|;,]/)
        .map((alias) => alias.trim())
        .filter(Boolean);

  return {
    title: String(input.title || "").trim(),
    artist: String(input.artist || "").trim(),
    isrc: String(input.isrc || "").trim().toUpperCase(),
    upc: String(input.upc || "").trim(),
    aliases,
    durationSec: parseDuration(input.durationSec ?? input.duration),
    originalVideoUrl: String(input.originalVideoUrl || "").trim(),
    releaseDate: String(input.releaseDate || "").trim(),
    priority: input.priority === "high" ? "high" : "normal",
    active: input.active !== false,
  };
}

export async function GET() {
  if (!(await isCopyrightAdmin())) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }
  const songs = await getSongs();
  return Response.json({ data: songs });
}

/**
 * Add or import songs. A single song may be posted as the body itself, or many
 * at once as `{ songs: [...] }` — re-importing a bigger sheet updates the rows
 * that already exist (matched on ISRC, else title + artist) and appends the new
 * ones, so the catalog can simply be re-uploaded whenever it grows.
 */
export async function POST(request: Request) {
  if (!(await isCopyrightAdmin())) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const incoming: SongInput[] = Array.isArray(body?.songs) ? body.songs : [body];

    let songs = await getSongs();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const raw of incoming) {
      const normalised = normaliseInput(raw);
      if (!normalised.title) {
        skipped += 1;
        continue;
      }
      const result = mergeSong(songs, normalised);
      songs = result.songs;
      if (result.created) created += 1;
      else updated += 1;
    }

    await saveSongs(songs);
    return Response.json({ data: { created, updated, skipped, total: songs.length } });
  } catch (error) {
    console.error("Failed to save songs:", error);
    return Response.json({ error: "Failed to save songs" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await isCopyrightAdmin())) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const body: SongInput = await request.json();
    if (!body.id) {
      return Response.json({ error: "id required" }, { status: 400 });
    }

    const songs = await getSongs();
    const index = songs.findIndex((song) => song.id === body.id);
    if (index === -1) {
      return Response.json({ error: "Song not found" }, { status: 404 });
    }

    const normalised = normaliseInput(body);
    if (!normalised.title) {
      return Response.json({ error: "title required" }, { status: 400 });
    }

    songs[index] = {
      ...songs[index],
      ...normalised,
      updatedAt: new Date().toISOString(),
    };
    await saveSongs(songs);
    return Response.json({ data: songs[index] });
  } catch (error) {
    console.error("Failed to update song:", error);
    return Response.json({ error: "Failed to update song" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isCopyrightAdmin())) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  const songs = await getSongs();
  await saveSongs(songs.filter((song) => song.id !== id));

  // Drop the song's detections too so the Matches tab stays consistent.
  const matches = await getMatches();
  const remaining = matches.filter((match) => match.songId !== id);
  if (remaining.length !== matches.length) await saveMatches(remaining);

  return Response.json({ success: true });
}
