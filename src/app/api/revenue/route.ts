import { timingSafeEqual } from "crypto";
import { getMonthlyRevenueExport } from "@/lib/monthly-revenue-export";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function getRequestApiKey(request: Request): string {
  const directKey = request.headers.get("x-api-key")?.trim();
  if (directKey) return directKey;

  const authorization = request.headers.get("authorization")?.trim() || "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" ? token || "" : "";
}

function apiKeysMatch(requestKey: string, configuredKey: string): boolean {
  const requestBuffer = Buffer.from(requestKey);
  const configuredBuffer = Buffer.from(configuredKey);
  return requestBuffer.length === configuredBuffer.length &&
    timingSafeEqual(requestBuffer, configuredBuffer);
}

function isAvailableMonth(month: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  const reliableDate = new Date();
  reliableDate.setUTCDate(reliableDate.getUTCDate() - 2);
  const latestAvailableMonth = `${reliableDate.getUTCFullYear()}-${String(
    reliableDate.getUTCMonth() + 1
  ).padStart(2, "0")}`;
  return month <= latestAvailableMonth;
}

export async function GET(request: Request) {
  const configuredKey = process.env.REVENUE_EXPORT_API_KEY || "";
  if (!configuredKey) {
    return Response.json(
      { error: "Revenue export API is not configured" },
      { status: 503 }
    );
  }

  const requestKey = getRequestApiKey(request);
  if (!requestKey || !apiKeysMatch(requestKey, configuredKey)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = new URL(request.url).searchParams.get("month") || "";
  if (!isAvailableMonth(month)) {
    return Response.json(
      { error: "month must have available YouTube data in YYYY-MM format" },
      { status: 400 }
    );
  }

  try {
    const result = await getMonthlyRevenueExport(month);
    if (result.channels.length === 0 && result.missingChannels > 0) {
      return Response.json(
        { error: "Monthly revenue is temporarily unavailable" },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
            "X-Revenue-Missing-Channels": String(result.missingChannels),
          },
        }
      );
    }

    return Response.json(
      { month: result.month, channels: result.channels },
      {
        status: result.missingChannels > 0 ? 206 : 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Revenue-Cache": result.cacheStatus,
          "X-Revenue-Channel-Count": String(result.channels.length),
          "X-Revenue-Missing-Channels": String(result.missingChannels),
        },
      }
    );
  } catch (error) {
    console.error(
      "[RevenueExport] Failed to export monthly revenue:",
      error instanceof Error ? error.message : error
    );
    return Response.json(
      { error: "Failed to export monthly revenue" },
      { status: 500 }
    );
  }
}
