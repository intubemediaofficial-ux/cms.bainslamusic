import * as XLSX from "xlsx";

export interface ImportedSongRow {
  title: string;
  artist: string;
  isrc: string;
  upc: string;
  aliases: string[];
  duration: string;
  releaseDate: string;
  originalVideoUrl: string;
  priority: string;
}

export interface ImportedChannelRow {
  channelId: string;
  channelTitle: string;
  url: string;
}

type SheetRow = Record<string, unknown>;

async function readRows(file: File): Promise<SheetRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[firstSheet], { defval: "" });
}

function cell(row: SheetRow, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    for (const key of Object.keys(row)) {
      if (pattern.test(key.trim())) {
        const value = row[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          return String(value).trim();
        }
      }
    }
  }
  return "";
}

/**
 * Parse a catalog sheet. Column names are matched loosely so the customer's
 * own export works without reformatting (Title/Song Name/Track, Artist/Singer,
 * ISRC, UPC/EAN, Duration/Length, Alias, Release Date, Original link).
 */
export async function parseSongSheet(file: File): Promise<ImportedSongRow[]> {
  const rows = await readRows(file);
  const songs: ImportedSongRow[] = [];

  for (const row of rows) {
    const title = cell(row, [/^song\s*title$/i, /^title$/i, /song|track/i, /^name$/i]);
    if (!title) continue;

    const aliases = cell(row, [/alias|alternate|other\s*title|variant|spelling/i]);

    songs.push({
      title,
      artist: cell(row, [/artist|singer|vocal|composer|primary/i]),
      isrc: cell(row, [/isrc/i]),
      upc: cell(row, [/upc|ean|barcode/i]),
      aliases: aliases
        ? aliases
            .split(/[|;,]/)
            .map((alias) => alias.trim())
            .filter(Boolean)
        : [],
      duration: cell(row, [/duration|length|runtime|time/i]),
      releaseDate: cell(row, [/release/i, /date/i]),
      originalVideoUrl: cell(row, [/original|our\s*link|youtube|video\s*link|url|link/i]),
      priority: cell(row, [/priority|tier/i]).toLowerCase() === "high" ? "high" : "normal",
    });
  }

  return songs;
}

const UC_ID = /(UC[\w-]{20,})/;

/**
 * Parse a channel sheet for the whitelist. Any column layout works: a UC id or
 * a YouTube link/handle is picked out of whichever cell holds it.
 */
export async function parseChannelSheet(file: File): Promise<ImportedChannelRow[]> {
  const rows = await readRows(file);
  const channels: ImportedChannelRow[] = [];

  for (const row of rows) {
    const values = Object.values(row).map((value) => String(value ?? "").trim());
    const idCell = values.find((value) => UC_ID.test(value)) || "";
    const channelId = idCell.match(UC_ID)?.[1] || "";
    const url =
      values.find((value) => /youtube\.com|youtu\.be/i.test(value)) ||
      values.find((value) => /^@[\w.\-]+$/.test(value)) ||
      "";
    const channelTitle = cell(row, [/channel\s*name|channel\s*title|^name$|^channel$|title/i]);

    if (!channelId && !url) continue;
    channels.push({ channelId, channelTitle, url });
  }

  return channels;
}
