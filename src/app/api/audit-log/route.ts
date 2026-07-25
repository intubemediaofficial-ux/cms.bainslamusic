import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuditLogs } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = ADMIN_EMAILS.includes(session.user.email.toLowerCase());
  if (!isAdmin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit")) || 200;
  const logs = await getAuditLogs(limit);
  return Response.json({ data: logs });
}
