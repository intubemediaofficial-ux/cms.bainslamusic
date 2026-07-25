import { kv } from "@/lib/redis";
import crypto from "crypto";

const NOTIFICATIONS_KEY = "bainsla_notifications";

interface Notification {
  id: string;
  userId: string;
  userEmail: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdDate: string;
}

export async function createSystemNotification(
  userId: string,
  userEmail: string,
  type: string,
  title: string,
  message: string
): Promise<void> {
  try {
    const all: Notification[] = (await kv.get<Notification[]>(NOTIFICATIONS_KEY)) || [];
    all.unshift({
      id: crypto.randomUUID(),
      userId,
      userEmail,
      type,
      title,
      message,
      read: false,
      createdDate: new Date().toISOString(),
    });
    await kv.set(NOTIFICATIONS_KEY, all.slice(0, 500));
  } catch {
    console.error("[Notifications] Failed to create notification");
  }
}
