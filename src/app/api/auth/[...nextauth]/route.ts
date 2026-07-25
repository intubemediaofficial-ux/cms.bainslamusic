import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

function auth(
  req: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) {
    process.env.NEXTAUTH_URL = `${proto}://${host}`;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextAuth(authOptions)(req as any, context as any);
}

export { auth as GET, auth as POST };
