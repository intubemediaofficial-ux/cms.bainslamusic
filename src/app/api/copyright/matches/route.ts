import {
  CopyrightMatch,
  MatchStatus,
  getMatches,
  getWhitelist,
  saveMatches,
  saveWhitelist,
} from "@/lib/copyright-catalog";
import { isCopyrightAdmin } from "@/lib/copyright-access";

export const dynamic = "force-dynamic";

const VALID_STATUSES: MatchStatus[] = [
  "new",
  "confirmed",
  "ignored",
  "strike_submitted",
  "removed",
  "rejected",
];

export async function GET() {
  if (!(await isCopyrightAdmin())) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }
  const matches = await getMatches();
  return Response.json({ data: matches });
}

/**
 * Update a match. `status: "whitelisted"` is a shortcut that whitelists the
 * channel and drops every match belonging to it, which is how own/reuse
 * channels get removed from the list in one click.
 */
export async function PUT(request: Request) {
  if (!(await isCopyrightAdmin())) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, status, note } = body as {
      id?: string;
      status?: string;
      note?: string;
    };

    if (!id) {
      return Response.json({ error: "id required" }, { status: 400 });
    }

    const matches = await getMatches();
    const index = matches.findIndex((match) => match.id === id);
    if (index === -1) {
      return Response.json({ error: "Match not found" }, { status: 404 });
    }

    const match = matches[index];

    if (status === "whitelisted") {
      if (match.channelId) {
        const whitelist = await getWhitelist();
        if (!whitelist.some((entry) => entry.channelId === match.channelId)) {
          whitelist.push({
            channelId: match.channelId,
            channelTitle: match.channelTitle,
            reason: "Whitelisted from a match",
            addedBy: "admin",
            addedAt: new Date().toISOString(),
          });
          await saveWhitelist(whitelist);
        }
        await saveMatches(matches.filter((m) => m.channelId !== match.channelId));
      }
      return Response.json({ data: { whitelistedChannel: match.channelId } });
    }

    if (status && !VALID_STATUSES.includes(status as MatchStatus)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    const updated: CopyrightMatch = {
      ...match,
      status: (status as MatchStatus) || match.status,
      note: note !== undefined ? note : match.note,
      updatedAt: new Date().toISOString(),
    };
    matches[index] = updated;
    await saveMatches(matches);

    return Response.json({ data: updated });
  } catch (error) {
    console.error("Failed to update match:", error);
    return Response.json({ error: "Failed to update match" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isCopyrightAdmin())) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const clearStatus = url.searchParams.get("clearStatus");

  const matches = await getMatches();

  if (clearStatus) {
    await saveMatches(matches.filter((match) => match.status !== clearStatus));
    return Response.json({ success: true });
  }

  if (!id) {
    return Response.json({ error: "id or clearStatus required" }, { status: 400 });
  }

  await saveMatches(matches.filter((match) => match.id !== id));
  return Response.json({ success: true });
}
