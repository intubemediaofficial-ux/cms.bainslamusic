import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  ClientDataSyncMode,
  getClientDataSyncStatus,
  syncClientData,
} from "@/lib/client-data-sync";
import { syncAllConfiguredVendorGoogleSheets } from "@/lib/vendor-google-sheets";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

function getMode(request: Request): ClientDataSyncMode | null {
  const mode = new URL(request.url).searchParams.get("mode") || "stats";
  return mode === "stats" || mode === "revenue" ? mode : null;
}

function isCronRequest(request: Request): boolean {
  const cronSecret = request.headers.get("x-cron-secret");
  return Boolean(
    cronSecret &&
    process.env.CRON_SECRET &&
    cronSecret === process.env.CRON_SECRET
  );
}

async function isAdminRequest(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return ADMIN_EMAILS.includes(session?.user?.email?.toLowerCase() || "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const authorized = isCronRequest(request) || (await isAdminRequest());

  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (action === "status") {
    return Response.json({ data: await getClientDataSyncStatus() });
  }
  if (action === "vendor-sheet") {
    return Response.json({ data: await syncAllConfiguredVendorGoogleSheets() });
  }

  const mode = getMode(request);
  if (!mode) {
    return Response.json({ error: "mode must be stats or revenue" }, { status: 400 });
  }

  const summary = await syncClientData(mode);
  const status = summary.status === "already_running" ? 409 : summary.status === "failed" ? 500 : 200;
  return Response.json({ data: summary }, { status });
}
