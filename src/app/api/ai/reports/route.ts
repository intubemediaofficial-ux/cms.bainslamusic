import { kv } from "@/lib/redis";
import { buildAiDashboardContext } from "@/lib/ai/context";
import { createSystemNotification } from "@/lib/notifications";
import { isCopyrightAdmin, isCronRequest } from "@/lib/copyright-access";

export const dynamic = "force-dynamic";

const USERS_KEY = "bainsla_users";
const ADMIN_REPORT_EMAIL = "bainslamusicofficial@gmail.com";

interface ReportUser {
  id: string;
  name: string;
  email: string;
  role: "client" | "company";
  status: "active" | "inactive" | "pending";
}

function reportMessage(
  scopeLabel: string,
  channelCount: number,
  currentMonthRevenue: number,
  forecastRevenue: number,
  healthScore: number,
  alertCount: number,
  syncedThrough: string | null
): string {
  return `${scopeLabel}: ${channelCount} channels, $${currentMonthRevenue.toFixed(2)} current-month revenue, $${forecastRevenue.toFixed(2)} forecast, ${healthScore}/100 health, and ${alertCount} active alerts. Revenue synced through ${syncedThrough || "the latest available cache"}.`;
}

export async function GET(request: Request) {
  if (!isCronRequest(request) && !(await isCopyrightAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = ((await kv.get<ReportUser[]>(USERS_KEY)) || []).filter(
    (user) => user.status === "active"
  );
  const recipients: Array<{
    id: string;
    email: string;
    role: "admin" | "company" | "client";
  }> = [
    { id: "admin-personal", email: ADMIN_REPORT_EMAIL, role: "admin" },
    ...users.map((user) => ({ id: user.id, email: user.email, role: user.role })),
  ];
  const date = new Date().toISOString().slice(0, 10);
  let delivered = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    const deliveryKey = `ai_report_delivery:${date}:${recipient.id}`;
    if (!(await kv.setIfNotExists(deliveryKey, "pending", 3 * 24 * 60 * 60))) {
      skipped += 1;
      continue;
    }
    try {
      const context = await buildAiDashboardContext({
        email: recipient.email,
        role: recipient.role,
      });
      const insights = context.insights;
      const notificationCreated = await createSystemNotification(
        recipient.id,
        recipient.email,
        "revenue_alert",
        `Daily AI Report · ${insights.scopeLabel}`,
        reportMessage(
          insights.scopeLabel,
          insights.channelCount,
          insights.currentMonthRevenue,
          insights.forecastRevenue,
          insights.healthScore,
          insights.alerts.length,
          insights.currentMonthSyncedThrough
        )
      );
      if (!notificationCreated) throw new Error("Notification storage failed");
      await kv.setex(deliveryKey, 3 * 24 * 60 * 60, "delivered");
      delivered += 1;
    } catch (error) {
      await kv.del(deliveryKey);
      console.error(`[AI Reports] Failed for ${recipient.id}:`, error);
    }
  }

  return Response.json({
    data: {
      date,
      delivered,
      skipped,
      recipients: recipients.length,
    },
  });
}
