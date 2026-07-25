import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "";

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

/**
 * Proxy route to backend API (DigitalOcean).
 * Keeps backend URL server-side and adds auth context.
 *
 * Query params:
 *   path — the backend path, e.g. /api/revenue/channel/UC123?startDate=...
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (!path) {
    return Response.json({ error: "path parameter required" }, { status: 400 });
  }

  if (!BACKEND_URL) {
    return Response.json({ error: "Backend not configured" }, { status: 501 });
  }

  try {
    const backendRes = await fetch(`${BACKEND_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await backendRes.json();
    return Response.json(data, { status: backendRes.status });
  } catch (err) {
    console.error("[Backend Proxy GET]", err);
    return Response.json({ error: "Backend unavailable" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (!path) {
    return Response.json({ error: "path parameter required" }, { status: 400 });
  }

  // Admin-only paths
  const adminPaths = ["/api/admin/"];
  const isAdminPath = adminPaths.some((p) => path.startsWith(p));
  if (isAdminPath && !ADMIN_EMAILS.includes(session.user?.email || "")) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  if (!BACKEND_URL) {
    return Response.json({ error: "Backend not configured" }, { status: 501 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const backendRes = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await backendRes.json();
    return Response.json(data, { status: backendRes.status });
  } catch (err) {
    console.error("[Backend Proxy POST]", err);
    return Response.json({ error: "Backend unavailable" }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (!path) {
    return Response.json({ error: "path parameter required" }, { status: 400 });
  }

  // Only admins can delete
  if (!ADMIN_EMAILS.includes(session.user?.email || "")) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  if (!BACKEND_URL) {
    return Response.json({ error: "Backend not configured" }, { status: 501 });
  }

  try {
    const backendRes = await fetch(`${BACKEND_URL}${path}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    const data = await backendRes.json();
    return Response.json(data, { status: backendRes.status });
  } catch (err) {
    console.error("[Backend Proxy DELETE]", err);
    return Response.json({ error: "Backend unavailable" }, { status: 502 });
  }
}
