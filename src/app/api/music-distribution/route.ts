import { kv } from "@/lib/redis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const DISTRIBUTIONS_KEY = "bainsla_distributions";

export interface Distribution {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  songTitle: string;
  songFileLink: string;
  posterLink: string;
  singerName: string;
  artistName: string;
  writerName: string;
  composerName: string;
  lyricistName: string;
  genre: string;
  language: string;
  releaseDate: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "distributed";
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

async function getDistributions(): Promise<Distribution[]> {
  try {
    const data = await kv.get<Distribution[]>(DISTRIBUTIONS_KEY);
    return data || [];
  } catch (error) {
    console.error("[Distribution] Failed to read from KV:", error);
    return [];
  }
}

async function saveDistributions(data: Distribution[]): Promise<boolean> {
  try {
    await kv.set(DISTRIBUTIONS_KEY, data);
    return true;
  } catch (error) {
    console.error("[Distribution] Failed to save to KV:", error);
    return false;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const distributions = await getDistributions();
  const isAdmin = isAdminEmail(session.user.email);

  if (isAdmin) {
    return Response.json({ data: distributions });
  }

  const userDistributions = distributions.filter(
    (d) => d.userEmail.toLowerCase() === session.user.email!.toLowerCase()
  );
  return Response.json({ data: userDistributions });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      songTitle,
      songFileLink,
      posterLink,
      singerName,
      artistName,
      writerName,
      composerName,
      lyricistName,
      genre,
      language,
      releaseDate,
      description,
    } = body;

    if (!songTitle || !songFileLink || !singerName) {
      return Response.json(
        { error: "Song title, song file link, and singer name are required" },
        { status: 400 }
      );
    }

    const distributions = await getDistributions();
    const now = new Date().toISOString();

    const newDistribution: Distribution = {
      id: crypto.randomUUID(),
      userId: session.user.email,
      userEmail: session.user.email,
      userName: session.user.name || "",
      songTitle: songTitle.trim(),
      songFileLink: songFileLink.trim(),
      posterLink: posterLink?.trim() || "",
      singerName: singerName.trim(),
      artistName: artistName?.trim() || "",
      writerName: writerName?.trim() || "",
      composerName: composerName?.trim() || "",
      lyricistName: lyricistName?.trim() || "",
      genre: genre?.trim() || "",
      language: language?.trim() || "",
      releaseDate: releaseDate || "",
      description: description?.trim() || "",
      status: "pending",
      adminNote: "",
      createdAt: now,
      updatedAt: now,
    };

    distributions.push(newDistribution);
    const saved = await saveDistributions(distributions);
    if (!saved) {
      return Response.json(
        { error: "Failed to save distribution" },
        { status: 500 }
      );
    }

    return Response.json({ data: newDistribution }, { status: 201 });
  } catch (error) {
    console.error("[Distribution] Error creating:", error);
    return Response.json(
      { error: "Failed to create distribution" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status, adminNote, ...updateFields } = body;

    if (!id) {
      return Response.json({ error: "Distribution ID is required" }, { status: 400 });
    }

    const distributions = await getDistributions();
    const idx = distributions.findIndex((d) => d.id === id);
    if (idx === -1) {
      return Response.json({ error: "Distribution not found" }, { status: 404 });
    }

    const isAdmin = isAdminEmail(session.user.email);
    const isOwner =
      distributions[idx].userEmail.toLowerCase() === session.user.email.toLowerCase();

    if (!isAdmin && !isOwner) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (isAdmin) {
      if (status) distributions[idx].status = status;
      if (adminNote !== undefined) distributions[idx].adminNote = adminNote;
    }

    if (isOwner && distributions[idx].status === "pending") {
      const item = distributions[idx];
      if (updateFields.songTitle !== undefined) item.songTitle = updateFields.songTitle;
      if (updateFields.songFileLink !== undefined) item.songFileLink = updateFields.songFileLink;
      if (updateFields.posterLink !== undefined) item.posterLink = updateFields.posterLink;
      if (updateFields.singerName !== undefined) item.singerName = updateFields.singerName;
      if (updateFields.artistName !== undefined) item.artistName = updateFields.artistName;
      if (updateFields.writerName !== undefined) item.writerName = updateFields.writerName;
      if (updateFields.composerName !== undefined) item.composerName = updateFields.composerName;
      if (updateFields.lyricistName !== undefined) item.lyricistName = updateFields.lyricistName;
      if (updateFields.genre !== undefined) item.genre = updateFields.genre;
      if (updateFields.language !== undefined) item.language = updateFields.language;
      if (updateFields.releaseDate !== undefined) item.releaseDate = updateFields.releaseDate;
      if (updateFields.description !== undefined) item.description = updateFields.description;
    }

    distributions[idx].updatedAt = new Date().toISOString();

    const saved = await saveDistributions(distributions);
    if (!saved) {
      return Response.json(
        { error: "Failed to update distribution" },
        { status: 500 }
      );
    }

    return Response.json({ data: distributions[idx] });
  } catch (error) {
    console.error("[Distribution] Error updating:", error);
    return Response.json(
      { error: "Failed to update distribution" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Distribution ID is required" }, { status: 400 });
    }

    const distributions = await getDistributions();
    const distribution = distributions.find((d) => d.id === id);

    if (!distribution) {
      return Response.json({ error: "Distribution not found" }, { status: 404 });
    }

    const isAdmin = isAdminEmail(session.user.email);
    const isOwner =
      distribution.userEmail.toLowerCase() === session.user.email.toLowerCase();

    if (!isAdmin && !isOwner) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!isAdmin && distribution.status !== "pending") {
      return Response.json(
        { error: "Can only delete pending distributions" },
        { status: 400 }
      );
    }

    const filtered = distributions.filter((d) => d.id !== id);
    const saved = await saveDistributions(filtered);
    if (!saved) {
      return Response.json(
        { error: "Failed to delete distribution" },
        { status: 500 }
      );
    }

    return Response.json({ data: { success: true } });
  } catch (error) {
    console.error("[Distribution] Error deleting:", error);
    return Response.json(
      { error: "Failed to delete distribution" },
      { status: 500 }
    );
  }
}
