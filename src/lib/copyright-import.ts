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
const HANDLE = /^@[\w.\-]{3,}$/;
const CHANNEL_URL =
  /youtube\.com\/(channel\/UC[\w-]{20,}|@[\w.\-]{3,}|c\/[\w.\-]+|user\/[\w.\-]+)/i;

export interface ChannelSheetPreview {
  /** Deduplicated rows that carry a usable channel reference. */
  valid: ImportedChannelRow[];
  /** Rows repeating a reference already present in `valid`. */
  duplicates: ImportedChannelRow[];
  /** Rows that held no channel URL, @handle or UC id. */
  invalid: { row: number; sample: string }[];
}

async function readMatrix(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return XLSX.utils
    .sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], { header: 1, defval: "" })
    .map((row) => row.map((value) => String(value ?? "").trim()));
}

function channelReference(values: string[]): { channelId: string; url: string } {
  const channelId = values.map((value) => value.match(UC_ID)?.[1]).find(Boolean) || "";
  const url =
    values.find((value) => CHANNEL_URL.test(value)) ||
    values.find((value) => HANDLE.test(value)) ||
    "";
  return { channelId, url };
}

/**
 * Scan every cell of a channel sheet — header row included — and split the rows
 * into the whitelist candidates, the repeats, and the cells that hold no
 * channel reference at all. Nothing is saved until an admin confirms.
 */
export async function parseChannelSheetPreview(file: File): Promise<ChannelSheetPreview> {
  const matrix = await readMatrix(file);
  const valid: ImportedChannelRow[] = [];
  const duplicates: ImportedChannelRow[] = [];
  const invalid: { row: number; sample: string }[] = [];
  const seen = new Set<string>();

  matrix.forEach((values, index) => {
    if (values.every((value) => value === "")) return;

    const { channelId, url } = channelReference(values);
    if (!channelId && !url) {
      invalid.push({ row: index + 1, sample: values.filter(Boolean).join(" | ").slice(0, 120) });
      return;
    }

    const channelTitle =
      values.find(
        (value) =>
          value !== channelId &&
          value !== url &&
          !UC_ID.test(value) &&
          !/https?:\/\//i.test(value) &&
          !HANDLE.test(value) &&
          value.length > 1
      ) || "";
    const row: ImportedChannelRow = { channelId, channelTitle, url };
    const key = (channelId || url).toLowerCase();

    if (seen.has(key)) {
      duplicates.push(row);
      return;
    }
    seen.add(key);
    valid.push(row);
  });

  return { valid, duplicates, invalid };
}
