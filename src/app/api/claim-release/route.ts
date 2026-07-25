import { kv } from "@/lib/redis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const CLAIMS_KEY = "bainsla_claim_releases";

export interface ClaimRelease {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  distributionId: string;
  songTitle: string;
  videoLink: string;
  originalUPC: string;
  claimType: string;
  description: string;
  status: "pending" | "processing" | "released" | "rejected";
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

async function getClaims(): Promise<ClaimRelease[]> {
  try {
    const data = await kv.get<ClaimRelease[]>(CLAIMS_KEY);
    return data || [];
  } catch (error) {
    console.error("[ClaimRelease] Failed to read from KV:", error);
    return [];
  }
}

async function saveClaims(data: ClaimRelease[]): Promise<boolean> {
  try {
    await kv.set(CLAIMS_KEY, data);
    return true;
  } catch (error) {
    console.error("[ClaimRelease] Failed to save to KV:", error);
    return false;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const claims = await getClaims();
  const isAdmin = isAdminEmail(session.user.email);

  if (isAdmin) {
    return Response.json({ data: claims });
  }

  const userClaims = claims.filter(
    (c) => c.userEmail.toLowerCase() === session.user.email!.toLowerCase()
  );
  return Response.json({ data: userClaims });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      distributionId,
      songTitle,
      videoLink,
      originalUPC,
      claimType,
      description,
    } = body;

    if (!videoLink || !songTitle) {
      return Response.json(
        { error: "Video link and song title are required" },
        { status: 400 }
      );
    }

    const claims = await getClaims();
    const now = new Date().toISOString();

    const newClaim: ClaimRelease = {
      id: crypto.randomUUID(),
      userId: session.user.email,
      userEmail: session.user.email,
      userName: session.user.name || "",
      distributionId: distributionId || "",
      songTitle: songTitle.trim(),
      videoLink: videoLink.trim(),
      originalUPC: originalUPC?.trim() || "",
      claimType: claimType?.trim() || "Content ID",
      description: description?.trim() || "",
      status: "pending",
      adminNote: "",
      createdAt: now,
      updatedAt: now,
    };

    claims.push(newClaim);
    const saved = await saveClaims(claims);
    if (!saved) {
      return Response.json(
        { error: "Failed to save claim release" },
        { status: 500 }
      );
    }

    return Response.json({ data: newClaim }, { status: 201 });
  } catch (error) {
    console.error("[ClaimRelease] Error creating:", error);
    return Response.json(
      { error: "Failed to create claim release" },
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
      return Response.json({ error: "Claim ID is required" }, { status: 400 });
    }

    const claims = await getClaims();
    const idx = claims.findIndex((c) => c.id === id);
    if (idx === -1) {
      return Response.json({ error: "Claim not found" }, { status: 404 });
    }

    const isAdmin = isAdminEmail(session.user.email);
    const isOwner =
      claims[idx].userEmail.toLowerCase() === session.user.email.toLowerCase();

    if (!isAdmin && !isOwner) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (isAdmin) {
      if (status) claims[idx].status = status;
      if (adminNote !== undefined) claims[idx].adminNote = adminNote;
    }

    if (isOwner && claims[idx].status === "pending") {
      const item = claims[idx];
      if (updateFields.songTitle !== undefined) item.songTitle = updateFields.songTitle;
      if (updateFields.videoLink !== undefined) item.videoLink = updateFields.videoLink;
      if (updateFields.originalUPC !== undefined) item.originalUPC = updateFields.originalUPC;
      if (updateFields.claimType !== undefined) item.claimType = updateFields.claimType;
      if (updateFields.description !== undefined) item.description = updateFields.description;
    }

    claims[idx].updatedAt = new Date().toISOString();

    const saved = await saveClaims(claims);
    if (!saved) {
      return Response.json(
        { error: "Failed to update claim" },
        { status: 500 }
      );
    }

    return Response.json({ data: claims[idx] });
  } catch (error) {
    console.error("[ClaimRelease] Error updating:", error);
    return Response.json(
      { error: "Failed to update claim" },
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
      return Response.json({ error: "Claim ID is required" }, { status: 400 });
    }

    const claims = await getClaims();
    const claim = claims.find((c) => c.id === id);

    if (!claim) {
      return Response.json({ error: "Claim not found" }, { status: 404 });
    }

    const isAdmin = isAdminEmail(session.user.email);
    const isOwner =
      claim.userEmail.toLowerCase() === session.user.email.toLowerCase();

    if (!isAdmin && !isOwner) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!isAdmin && claim.status !== "pending") {
      return Response.json(
        { error: "Can only delete pending claims" },
        { status: 400 }
      );
    }

    const filtered = claims.filter((c) => c.id !== id);
    const saved = await saveClaims(filtered);
    if (!saved) {
      return Response.json(
        { error: "Failed to delete claim" },
        { status: 500 }
      );
    }

    return Response.json({ data: { success: true } });
  } catch (error) {
    console.error("[ClaimRelease] Error deleting:", error);
    return Response.json(
      { error: "Failed to delete claim" },
      { status: 500 }
    );
  }
}
