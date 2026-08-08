import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

/** Copyright catalog and matches are admin-only. */
export async function isCopyrightAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return false;
  if (session.user.role === "admin") return true;
  return ADMIN_EMAILS.includes(session.user.email?.toLowerCase() || "");
}

export function isCronRequest(request: Request): boolean {
  const secret = request.headers.get("x-cron-secret");
  return Boolean(secret && process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}
