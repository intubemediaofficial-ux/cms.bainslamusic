import { kv } from "@/lib/redis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CLAIMS_KEY = "bainsla_video_claims";

export interface VideoClaim {
  videoId: string;
  channelId: string;
  claimType: "copyright" | "content_id" | "manual";
  claimant: string;
  status: "active" | "released" | "disputed";
  notes: string;
  createdBy: string;
  createdDate: string;
  updatedDate: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims: VideoClaim[] = (await kv.get<VideoClaim[]>(CLAIMS_KEY)) || [];
    return Response.json({ data: claims });
  } catch (error) {
    console.error("Failed to fetch claims:", error);
    return Response.json({ error: "Failed to fetch claims" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await request.json();
    const { videoId, channelId, claimType, claimant, notes } = body;

    if (!videoId || !channelId || !claimType) {
      return Response.json({ error: "videoId, channelId, and claimType required" }, { status: 400 });
    }

    const claims: VideoClaim[] = (await kv.get<VideoClaim[]>(CLAIMS_KEY)) || [];
    const now = new Date().toISOString();

    const newClaim: VideoClaim = {
      videoId,
      channelId,
      claimType: claimType as VideoClaim["claimType"],
      claimant: claimant || "Unknown",
      status: "active",
      notes: notes || "",
      createdBy: session.user.email || "admin",
      createdDate: now,
      updatedDate: now,
    };

    const existingIdx = claims.findIndex(
      (c) => c.videoId === videoId && c.claimant === (claimant || "Unknown")
    );
    if (existingIdx >= 0) {
      claims[existingIdx] = { ...claims[existingIdx], ...newClaim, createdDate: claims[existingIdx].createdDate };
    } else {
      claims.push(newClaim);
    }

    await kv.set(CLAIMS_KEY, claims);
    return Response.json({ data: newClaim });
  } catch (error) {
    console.error("Failed to create claim:", error);
    return Response.json({ error: "Failed to create claim" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await request.json();
    const { videoId, claimant, status, notes } = body;

    if (!videoId) {
      return Response.json({ error: "videoId required" }, { status: 400 });
    }

    const claims: VideoClaim[] = (await kv.get<VideoClaim[]>(CLAIMS_KEY)) || [];
    const idx = claims.findIndex(
      (c) => c.videoId === videoId && (!claimant || c.claimant === claimant)
    );

    if (idx === -1) {
      return Response.json({ error: "Claim not found" }, { status: 404 });
    }

    if (status) claims[idx].status = status;
    if (notes !== undefined) claims[idx].notes = notes;
    claims[idx].updatedDate = new Date().toISOString();

    await kv.set(CLAIMS_KEY, claims);
    return Response.json({ data: claims[idx] });
  } catch (error) {
    console.error("Failed to update claim:", error);
    return Response.json({ error: "Failed to update claim" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    const url = new URL(request.url);
    const videoId = url.searchParams.get("videoId");
    const claimant = url.searchParams.get("claimant");

    if (!videoId) {
      return Response.json({ error: "videoId required" }, { status: 400 });
    }

    const claims: VideoClaim[] = (await kv.get<VideoClaim[]>(CLAIMS_KEY)) || [];
    const filtered = claims.filter(
      (c) => !(c.videoId === videoId && (!claimant || c.claimant === claimant))
    );

    await kv.set(CLAIMS_KEY, filtered);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete claim:", error);
    return Response.json({ error: "Failed to delete claim" }, { status: 500 });
  }
}
