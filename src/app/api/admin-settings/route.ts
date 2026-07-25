import { kv } from "@/lib/redis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

function maskApiKey(apiKey: string): string {
  if (!apiKey) return "";
  if (apiKey.length <= 12) return "•".repeat(apiKey.length);
  return `${apiKey.slice(0, 9)}${"•".repeat(24)}${apiKey.slice(-4)}`;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const setting = url.searchParams.get("setting");

  if (setting === "realtime") {
    const realtimeSettings = await kv.get<Record<string, boolean>>("realtime_settings") || {};
    return Response.json({ data: realtimeSettings });
  }

  if (setting === "revenue-api") {
    const apiKey = process.env.REVENUE_EXPORT_API_KEY || "";
    const reveal = url.searchParams.get("reveal") === "true";
    return Response.json(
      {
        data: {
          baseUrl: `${url.origin}/api/revenue`,
          configured: Boolean(apiKey),
          maskedApiKey: maskApiKey(apiKey),
          apiKey: reveal ? apiKey : undefined,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return Response.json({ error: "Invalid setting" }, { status: 400 });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { setting, email, enabled } = body as { setting: string; email: string; enabled: boolean };

    if (setting === "realtime") {
      if (!email) {
        return Response.json({ error: "email required" }, { status: 400 });
      }
      const realtimeSettings = await kv.get<Record<string, boolean>>("realtime_settings") || {};
      realtimeSettings[email.toLowerCase()] = enabled;
      await kv.set("realtime_settings", realtimeSettings);
      return Response.json({ data: realtimeSettings });
    }

    return Response.json({ error: "Invalid setting" }, { status: 400 });
  } catch {
    return Response.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
