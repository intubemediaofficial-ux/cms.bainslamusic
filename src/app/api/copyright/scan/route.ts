import {
  DEFAULT_SCAN_CONFIG,
  ScanConfig,
  ScanSchedule,
  getMatches,
  getScanConfig,
  getScanState,
  getSongs,
  getUnitsUsedToday,
  saveScanConfig,
} from "@/lib/copyright-catalog";
import { runCopyrightScan, shouldRunToday } from "@/lib/copyright-scan";
import { isCopyrightAdmin, isCronRequest } from "@/lib/copyright-access";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UNITS_PER_SEARCH = 100;

function runsPerCycle(schedule: ScanSchedule): number {
  if (schedule === "daily") return 1;
  if (schedule === "mon_wed_fri") return 3;
  return 7;
}

/** Status + quota plan for the dashboard meter. */
export async function GET(request: Request) {
  if (!isCronRequest(request) && !(await isCopyrightAdmin())) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const [config, state, songs, matches, unitsUsedToday] = await Promise.all([
    getScanConfig(),
    getScanState(),
    getSongs(),
    getMatches(),
    getUnitsUsedToday(),
  ]);

  const activeSongs = songs.filter((song) => song.active && song.title.trim());
  const runs = runsPerCycle(config.schedule);
  const songsPerRun = Math.ceil(activeSongs.length / runs);
  const unitsPerRun = songsPerRun * config.variantsPerSong * UNITS_PER_SEARCH;

  const statusCounts: Record<string, number> = {};
  for (const match of matches) {
    statusCounts[match.status] = (statusCounts[match.status] || 0) + 1;
  }

  return Response.json({
    data: {
      config,
      state,
      unitsUsedToday,
      isScanDayToday: shouldRunToday(config),
      songs: {
        total: songs.length,
        active: activeSongs.length,
        highPriority: activeSongs.filter((song) => song.priority === "high").length,
        neverScanned: activeSongs.filter((song) => !song.lastScannedAt).length,
      },
      matches: { total: matches.length, byStatus: statusCounts },
      plan: {
        runsPerCycle: runs,
        songsPerRun,
        unitsPerRun,
        unitsPerCycle: unitsPerRun * runs,
        budgetFits: unitsPerRun <= config.dailyUnitBudget,
      },
    },
  });
}

/** Run a scan now (cron or admin "Scan now" button). */
export async function POST(request: Request) {
  const cron = isCronRequest(request);
  if (!cron && !(await isCopyrightAdmin())) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const summary = await runCopyrightScan(cron ? "cron" : "manual");
  const httpStatus =
    summary.status === "failed" ? 500 : summary.status === "already_running" ? 409 : 200;
  return Response.json({ data: summary }, { status: httpStatus });
}

/** Update the schedule / budget settings. */
export async function PUT(request: Request) {
  if (!(await isCopyrightAdmin())) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const current = await getScanConfig();
    const schedule: ScanSchedule[] = ["daily", "mon_wed_fri", "weekly"];

    const next: ScanConfig = {
      enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled,
      schedule: schedule.includes(body.schedule) ? body.schedule : current.schedule,
      variantsPerSong: Math.min(
        3,
        Math.max(1, Number(body.variantsPerSong) || current.variantsPerSong)
      ),
      dailyUnitBudget: Math.min(
        1000000,
        Math.max(1000, Number(body.dailyUnitBudget) || current.dailyUnitBudget)
      ),
      minMatchScore: Math.min(100, Math.max(30, Number(body.minMatchScore) || current.minMatchScore)),
      watchlistEnabled:
        typeof body.watchlistEnabled === "boolean"
          ? body.watchlistEnabled
          : current.watchlistEnabled,
    };

    await saveScanConfig(next);
    return Response.json({ data: next, defaults: DEFAULT_SCAN_CONFIG });
  } catch (error) {
    console.error("Failed to save scan config:", error);
    return Response.json({ error: "Failed to save scan config" }, { status: 500 });
  }
}
