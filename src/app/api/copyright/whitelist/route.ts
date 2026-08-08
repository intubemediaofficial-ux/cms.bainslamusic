import { google, youtube_v3 } from "googleapis";
import {
  WhitelistChannel,
  extractChannelHandle,
  extractChannelId,
  getMatches,
  getWhitelist,
  saveMatches,
  saveWhitelist,
} from "@/lib/copyright-catalog";
import { isCopyrightAdmin } from "@/lib/copyright-access";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ChannelInput {
  channelId?: string;
  channelTitle?: string;
  /** Any raw value: channel link, video link, @handle, or bare UC id. */
  url?: string;
  reason?: string;
}

function getApiKeyYouTube(): youtube_v3.Youtube | null {
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return google.youtube({ version: "v3", auth: apiKey });
}

function extractVideoId(raw: string): string {
  const value = (raw || "").trim();
  const watch = value.match(/[?&]v=([\w-]{11})/);
  if (watch) return watch[1];
  const short = value.match(/(?:youtu\.be\/|\/shorts\/|\/live\/)([\w-]{11})/);
  if (short) return short[1];
  return "";
}

/**
 * Turn a mixed bag of channel links / handles / ids into UC channel ids.
 * Handles and video links need one cheap API call each (1 unit).
 */
async function resolveChannelIds(
  inputs: ChannelInput[]
): Promise<{ resolved: ChannelInput[]; unresolved: string[] }> {
  const youtube = getApiKeyYouTube();
  const resolved: ChannelInput[] = [];
  const unresolved: string[] = [];

  for (const input of inputs) {
    const raw = `${input.channelId || ""} ${input.url || ""}`.trim();
    const direct = extractChannelId(input.channelId || "") || extractChannelId(input.url || "");
    if (direct) {
      resolved.push({ ...input, channelId: direct });
      continue;
    }

    if (!youtube) {
      unresolved.push(raw || input.channelTitle || "(empty)");
      continue;
    }

    try {
      const videoId = extractVideoId(input.url || "");
      if (videoId) {
        const response = await youtube.videos.list({ part: ["snippet"], id: [videoId] });
        const channelId = response.data.items?.[0]?.snippet?.channelId;
        if (channelId) {
          resolved.push({
            ...input,
            channelId,
            channelTitle: input.channelTitle || response.data.items?.[0]?.snippet?.channelTitle || "",
          });
          continue;
        }
      }

      const handle = extractChannelHandle(input.url || "") || extractChannelHandle(input.channelId || "");
      if (handle) {
        const response = handle.startsWith("@")
          ? await youtube.channels.list({ part: ["snippet"], forHandle: handle })
          : await youtube.channels.list({ part: ["snippet"], forUsername: handle });
        const item = response.data.items?.[0];
        if (item?.id) {
          resolved.push({
            ...input,
            channelId: item.id,
            channelTitle: input.channelTitle || item.snippet?.title || "",
          });
          continue;
        }
      }
    } catch (error) {
      console.warn("[whitelist] failed to resolve channel:", raw, error);
    }

    unresolved.push(raw || input.channelTitle || "(empty)");
  }

  return { resolved, unresolved };
}

/** Fill in missing channel titles in batches of 50 (1 unit per batch). */
async function fillChannelTitles(entries: ChannelInput[]): Promise<void> {
  const youtube = getApiKeyYouTube();
  if (!youtube) return;

  const missing = entries.filter((entry) => entry.channelId && !entry.channelTitle);
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    try {
      const response = await youtube.channels.list({
        part: ["snippet"],
        id: batch.map((entry) => entry.channelId as string),
      });
      const titles = new Map(
        (response.data.items || []).map((item) => [item.id || "", item.snippet?.title || ""])
      );
      for (const entry of batch) {
        entry.channelTitle = titles.get(entry.channelId as string) || "";
      }
    } catch (error) {
      console.warn("[whitelist] failed to fetch channel titles:", error);
    }
  }
}

export async function GET() {
  if (!(await isCopyrightAdmin())) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }
  return Response.json({ data: await getWhitelist() });
}

/**
 * Add channels to the whitelist. Accepts one entry as the body, or many as
 * `{ channels: [...] }` — this is how the "own channels" Excel sheet is
 * imported. Any match already recorded for a whitelisted channel is removed.
 */
export async function POST(request: Request) {
  if (!(await isCopyrightAdmin())) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const inputs: ChannelInput[] = Array.isArray(body?.channels) ? body.channels : [body];

    const { resolved, unresolved } = await resolveChannelIds(
      inputs.filter((input) => input.channelId || input.url || input.channelTitle)
    );
    await fillChannelTitles(resolved);

    const whitelist = await getWhitelist();
    const existing = new Set(whitelist.map((entry) => entry.channelId));
    const now = new Date().toISOString();
    let added = 0;

    for (const entry of resolved) {
      if (!entry.channelId || existing.has(entry.channelId)) continue;
      const record: WhitelistChannel = {
        channelId: entry.channelId,
        channelTitle: entry.channelTitle || "",
        reason: entry.reason || "Own channel",
        addedBy: "admin",
        addedAt: now,
      };
      whitelist.push(record);
      existing.add(entry.channelId);
      added += 1;
    }

    await saveWhitelist(whitelist);

    // Clean out anything already detected for these channels.
    const matches = await getMatches();
    const remaining = matches.filter((match) => !existing.has(match.channelId));
    if (remaining.length !== matches.length) await saveMatches(remaining);

    return Response.json({
      data: {
        added,
        skipped: resolved.length - added,
        unresolved,
        total: whitelist.length,
      },
    });
  } catch (error) {
    console.error("Failed to update whitelist:", error);
    return Response.json({ error: "Failed to update whitelist" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isCopyrightAdmin())) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const channelId = new URL(request.url).searchParams.get("channelId");
  if (!channelId) {
    return Response.json({ error: "channelId required" }, { status: 400 });
  }

  const whitelist = await getWhitelist();
  await saveWhitelist(whitelist.filter((entry) => entry.channelId !== channelId));
  return Response.json({ success: true });
}
