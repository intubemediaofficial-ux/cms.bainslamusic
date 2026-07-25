import { kv } from "@/lib/redis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const NOTIFICATIONS_KEY = "bainsla_notifications";

export interface Notification {
  id: string;
  userId: string;
  userEmail: string;
  type: "payment_paid" | "payment_created" | "withdraw_approved" | "withdraw_rejected" | "channel_transfer" | "channel_approved" | "info" | "user_created" | "channel_added" | "revenue_alert" | "welcome";
  title: string;
  message: string;
  read: boolean;
  createdDate: string;
}

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

async function getNotifications(): Promise<Notification[]> {
  try {
    return (await kv.get<Notification[]>(NOTIFICATIONS_KEY)) || [];
  } catch { return []; }
}

async function saveNotifications(items: Notification[]): Promise<boolean> {
  try { await kv.set(NOTIFICATIONS_KEY, items); return true; }
  catch { return false; }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = await getNotifications();
  const admin = ADMIN_EMAILS.includes(session.user.email.toLowerCase());

  if (admin) {
    return Response.json({ data: all });
  }

  return Response.json({
    data: all.filter((n) => n.userEmail.toLowerCase() === session.user!.email!.toLowerCase()),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = ADMIN_EMAILS.includes(session.user.email.toLowerCase());
  const isCompany = session.user.role === "company";
  if (!admin && !isCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId, userEmail, type, title, message } = body;

    const notification: Notification = {
      id: crypto.randomUUID(),
      userId: userId || "",
      userEmail: userEmail || "",
      type: type || "info",
      title: title || "",
      message: message || "",
      read: false,
      createdDate: new Date().toISOString(),
    };

    const all = await getNotifications();
    all.unshift(notification);
    // Keep last 500 notifications
    const trimmed = all.slice(0, 500);
    await saveNotifications(trimmed);
    return Response.json({ data: notification }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create notification" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, read, markAllRead } = body;

    const all = await getNotifications();

    if (markAllRead) {
      const email = session.user.email.toLowerCase();
      for (const n of all) {
        if (n.userEmail.toLowerCase() === email) n.read = true;
      }
    } else if (id) {
      const idx = all.findIndex((n) => n.id === id);
      if (idx >= 0 && read !== undefined) all[idx].read = read;
    }

    await saveNotifications(all);
    return Response.json({ data: { success: true } });
  } catch {
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}
