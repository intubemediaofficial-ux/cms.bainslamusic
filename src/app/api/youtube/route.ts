import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { kv } from "@/lib/redis";
import {
  getChannelStats,
  getChannelStatsById,
  getChannelStatsByIdPublic,
  getChannelVideos,
  getChannelVideosPublic,
  getAnalyticsData,
  getCountryData,
  getDemographics,
  getRevenueData,
  lookupChannel,
} from "@/lib/youtube";
import { getValidAccessToken, getTokenStatus, getAnyValidAccessToken } from "@/lib/channel-tokens";
import { getAllCachedClientData } from "@/lib/client-data-cache";
import { getMonthlyChannelAnalytics, isValidMonth } from "@/lib/monthly-channel-analytics";
import {
  cacheChannelVideos,
  getCachedChannelVideos,
  cacheDashboardData,
  cacheDashboardRangeData,
  getCachedDashboardRangeData,
  cacheChannelStats,
  getCachedChannelStats,
} from "@/lib/youtube-cache";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

interface ChannelScopeUser {
  id: string;
  email: string;
  role: "client" | "company";
  parentId?: string;
  channels?: string[];
  pendingChannels?: string[];
  status?: "active" | "inactive" | "pending";
}

async function getChannelScope(email: string): Promise<{ approved: Set<string>; manageable: Set<string> }> {
  const users = (await kv.get<ChannelScopeUser[]>("bainsla_users")) || [];
  const normalizedEmail = email.toLowerCase();
  const scopedUsers = ADMIN_EMAILS.includes(normalizedEmail)
    ? users
    : (() => {
        const currentUser = users.find((user) => user.email.toLowerCase() === normalizedEmail);
        if (!currentUser || currentUser.status === "inactive") return [];
        if (currentUser.role === "company") {
          return [currentUser, ...users.filter((user) => user.parentId === currentUser.id && user.status !== "inactive")];
        }
        return [currentUser];
      })();

  const approved = new Set(scopedUsers.flatMap((user) => user.channels || []));
  const manageable = new Set(
    scopedUsers.flatMap((user) => [...(user.channels || []), ...(user.pendingChannels || [])])
  );
  return { approved, manageable };
}

function hasChannelAccess(channelIds: string[], allowedChannelIds: Set<string>): boolean {
  return channelIds.every((channelId) => allowedChannelIds.has(channelId));
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return Response.json(
      { error: "No session found. Please log in again." },
      { status: 401 }
    );
  }
  if (session.user?.userStatus === "inactive") {
    return Response.json({ error: "Account is inactive" }, { status: 403 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const startDate = url.searchParams.get("startDate") || getDefaultStartDate();
  const endDate = url.searchParams.get("endDate") || getDefaultEndDate();

  // All users can access YouTube data via per-channel tokens

  try {
    const sessionEmail = session.user?.email;
    if (!sessionEmail) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const channelScope = await getChannelScope(sessionEmail);

    // All YouTube API actions now use per-channel tokens (login tokens lack YouTube scopes)
    if (!["dashboardFull", "lookupChannel", "bulkCachedChannels", "dashboard", "videos", "demographics", "realtime48"].includes(action || "")) {
      return Response.json(
        { error: "This action requires per-channel token validation. Please validate channel tokens first." },
        { status: 401 }
      );
    }

    switch (action) {
      case "bulkCachedChannels": {
        // Return cached channel stats for all requested channel IDs — instant, no YouTube API calls
        const ids = url.searchParams.get("channelIds")?.split(",").filter(Boolean) || [];
        if (ids.length === 0) return Response.json({ data: {} });
        if (!hasChannelAccess(ids, channelScope.manageable)) {
          return Response.json({ error: "You can only access channels assigned to your account" }, { status: 403 });
        }
        const results: Record<string, unknown> = {};
        await Promise.all(ids.map(async (id) => {
          const cached = await getCachedChannelStats(id);
          if (cached?.stats) {
            results[id] = cached.stats;
          }
        }));
        // Also check client data cache for any missing channels
        if (Object.keys(results).length < ids.length) {
          try {
            const allCached = await getAllCachedClientData();
            for (const cd of allCached) {
              for (const ch of (cd.channels || [])) {
                if (ids.includes(ch.channelId) && !results[ch.channelId]) {
                  results[ch.channelId] = {
                    id: ch.channelId,
                    snippet: { title: ch.channelTitle || ch.channelId, thumbnails: { default: { url: ch.thumbnail || "" }, medium: { url: ch.thumbnail || "" } } },
                    statistics: { subscriberCount: String(ch.subscribers || 0), videoCount: String(ch.videoCount || 0), viewCount: String(ch.views || 0) },
                  };
                }
              }
            }
          } catch { /* ignore */ }
        }
        return Response.json({ data: results, _cached: true });
      }
      case "videos": {
        const channelId = url.searchParams.get("channelId");
        if (!channelId)
          return Response.json({ error: "channelId required" }, { status: 400 });
        if (!channelScope.approved.has(channelId)) {
          return Response.json({ error: "You can only access channels assigned to your account" }, { status: 403 });
        }
        // 0 = fetch ALL videos (no limit)
        const maxResultsParam = url.searchParams.get("maxResults");
        const maxResults = maxResultsParam ? Number(maxResultsParam) : 0;
        // Use per-channel token for video data
        let videoToken: string | undefined = undefined;
        const channelSpecificToken = await getValidAccessToken(channelId);
        if (channelSpecificToken) videoToken = channelSpecificToken;
        if (videoToken) {
          try {
            const videos = await getChannelVideos(videoToken, channelId, maxResults);
            // Cache on success
            cacheChannelVideos(channelId, videos).catch(() => {});
            return Response.json({ data: videos });
          } catch (vidErr) {
            console.warn("[videos] Token-based fetch failed (quota?):", vidErr instanceof Error ? vidErr.message : vidErr);
            // Fall through to public API
          }
        }
        // Fallback: use API key for public video data
        try {
          const publicVideos = await getChannelVideosPublic(channelId, maxResults);
          if (publicVideos.length > 0) {
            // Cache on success
            cacheChannelVideos(channelId, publicVideos).catch(() => {});
            return Response.json({ data: publicVideos });
          }
        } catch (pubErr) {
          console.warn("[videos] Public API fetch failed (quota?):", pubErr instanceof Error ? pubErr.message : pubErr);
        }
        // Final fallback: KV cache
        const cachedVids = await getCachedChannelVideos(channelId);
        if (cachedVids?.videos?.length) {
          console.log(`[videos] Serving ${cachedVids.videos.length} cached videos for ${channelId} (last updated: ${cachedVids.lastUpdated})`);
          return Response.json({ data: cachedVids.videos, _cached: true, _lastUpdated: cachedVids.lastUpdated });
        }
        return Response.json({ error: "No token available for this channel. Please validate the channel token first." }, { status: 401 });
      }
      case "demographics": {
        const channelId = url.searchParams.get("channelId");
        if (!channelId) {
          return Response.json({ error: "channelId required" }, { status: 400 });
        }
        if (!channelScope.approved.has(channelId)) {
          return Response.json(
            { error: "You can only access channels assigned to your account" },
            { status: 403 }
          );
        }
        const accessToken = await getValidAccessToken(channelId);
        if (!accessToken) {
          return Response.json(
            { error: "No valid token available for this channel. Please validate it first." },
            { status: 401 }
          );
        }
        const data = url.searchParams.get("dimension") === "country"
          ? await getCountryData(accessToken, startDate, endDate, channelId)
          : await getDemographics(accessToken, startDate, endDate, channelId);
        return Response.json({ data });
      }
      case "lookupChannel": {
        const query = url.searchParams.get("query");
        if (!query)
          return Response.json({ error: "query required" }, { status: 400 });
        // Use per-channel tokens for channel lookup
        let lookupToken: string | undefined = undefined;
        const t = await getValidAccessToken(query);
        if (t) lookupToken = t;
        if (!lookupToken) {
          // Try per-channel tokens from explicit list or all known channels
          const storedIds = url.searchParams.get("storedChannelIds")?.split(",").filter(Boolean) || [];
          const allKnownIds = url.searchParams.get("allChannelIds")?.split(",").filter(Boolean) || [];
          const idsToTry = [...storedIds, ...allKnownIds];
          if (idsToTry.length > 0) {
            lookupToken = await getAnyValidAccessToken(idsToTry) || undefined;
          }
        }
        if (!lookupToken) {
          // Fallback: use YouTube Data API key for public channel lookup
          const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
          if (apiKey) {
            try {
              const { google } = await import("googleapis");
              const youtube = google.youtube({ version: "v3", auth: apiKey });
              if (query.startsWith("UC") && query.length >= 20) {
                const response = await youtube.channels.list({
                  part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
                  id: [query],
                });
                if (response.data.items?.length) {
                  return Response.json({ data: response.data.items });
                }
              }
              // Try search as fallback
              const searchResponse = await youtube.search.list({
                part: ["snippet"],
                q: query,
                type: ["channel"],
                maxResults: 5,
              });
              if (searchResponse.data.items?.length) {
                const channelIds = searchResponse.data.items.map((item) => item.snippet?.channelId).filter(Boolean) as string[];
                const channelResponse = await youtube.channels.list({
                  part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
                  id: channelIds,
                });
                return Response.json({ data: channelResponse.data.items || [] });
              }
              return Response.json({ data: [] });
            } catch (apiKeyError) {
              console.error("[YouTube] API key lookup failed:", apiKeyError);
            }
          }
          // Last resort: try cached data even without token
          try {
            const allCached = await getAllCachedClientData();
            for (const cd of allCached) {
              for (const ch of (cd.channels || [])) {
                if (ch.channelId === query) {
                  return Response.json({ data: [{
                    id: ch.channelId,
                    snippet: { title: ch.channelTitle || ch.channelId, thumbnails: { default: { url: ch.thumbnail || "" }, medium: { url: ch.thumbnail || "" } } },
                    statistics: { subscriberCount: String(ch.subscribers || 0), videoCount: String(ch.videoCount || 0), viewCount: String(ch.views || 0) },
                  }], _cached: true });
                }
              }
            }
          } catch { /* ignore */ }
          return Response.json({ error: "No token available for channel lookup. Please validate at least one channel token first." }, { status: 401 });
        }
        try {
          const results = await lookupChannel(lookupToken, query);
          // Cache channel stats on success
          if (results?.[0]) cacheChannelStats(query, results[0]).catch(() => {});
          return Response.json({ data: results });
        } catch (lookupErr) {
          console.warn("[lookupChannel] Failed (quota?):", lookupErr instanceof Error ? lookupErr.message : lookupErr);
          // Fall back to per-channel stats cache
          const cachedStats = await getCachedChannelStats(query);
          if (cachedStats?.stats) {
            return Response.json({ data: [cachedStats.stats], _cached: true, _lastUpdated: cachedStats.lastUpdated });
          }
          // Fall back to client data cache
          try {
            const allCached = await getAllCachedClientData();
            for (const cd of allCached) {
              for (const ch of (cd.channels || [])) {
                if (ch.channelId === query) {
                  return Response.json({ data: [{
                    id: ch.channelId,
                    snippet: { title: ch.channelTitle || ch.channelId, thumbnails: { default: { url: ch.thumbnail || "" }, medium: { url: ch.thumbnail || "" } } },
                    statistics: { subscriberCount: String(ch.subscribers || 0), videoCount: String(ch.videoCount || 0), viewCount: String(ch.views || 0) },
                  }], _cached: true });
                }
              }
            }
          } catch { /* ignore cache errors */ }
          return Response.json({ data: [], warning: "YouTube API quota exceeded — channel data temporarily unavailable" });
        }
      }
      case "dashboard": {
        // Legacy action — redirect to dashboardFull which uses per-channel tokens
        return Response.json({ error: "Use dashboardFull action instead — login tokens no longer have YouTube scopes." }, { status: 400 });
      }
      case "dashboardFull": {
        const prevStartDate = url.searchParams.get("prevStartDate") || startDate;
        const prevEndDate = url.searchParams.get("prevEndDate") || endDate;
        const channelIdsParam = url.searchParams.get("channelIds") || "";
        const channelIds = channelIdsParam
          ? channelIdsParam.split(",").filter(Boolean)
          : [];
        if (!hasChannelAccess(channelIds, channelScope.approved)) {
          return Response.json({ error: "You can only access channels assigned to your account" }, { status: 403 });
        }

        const monthlyParam = url.searchParams.get("monthly");
        if (monthlyParam && !isValidMonth(monthlyParam)) {
          return Response.json({ error: "month must be YYYY-MM and not in the future" }, { status: 400 });
        }
        if (monthlyParam) {
          const analytics = await getMonthlyChannelAnalytics(monthlyParam);
          const authorized = new Set(channelIds);
          const monthMap = new Map(
            analytics.channels
              .filter((c) => authorized.has(c.channel_id))
              .map((c) => [c.channel_id, c])
          );

          const allCached = await getAllCachedClientData();
          const cachedChannelMap = new Map<
            string,
            (typeof allCached)[number]["channels"][number]
          >();
          for (const client of allCached) {
            for (const channel of client.channels || []) {
              if (!authorized.has(channel.channelId)) continue;
              const existing = cachedChannelMap.get(channel.channelId);
              if (!existing || channel.lastUpdated >= existing.lastUpdated) {
                cachedChannelMap.set(channel.channelId, channel);
              }
            }
          }

          const channels = channelIds.map((id) => {
            const c = cachedChannelMap.get(id);
            const m = monthMap.get(id);
            return {
              id,
              snippet: {
                title: c?.channelTitle || m?.channel_name || id,
                thumbnails: {
                  default: { url: c?.thumbnail || "" },
                  medium: { url: c?.thumbnail || "" },
                },
              },
              statistics: {
                subscriberCount: String(c?.subscribers || 0),
                videoCount: String(c?.videoCount || 0),
                viewCount: String(m?.views || 0),
              },
            };
          });

          const channelRevenueMap: Record<string, { revenue: number; views: number; rpm: number }> = {};
          let totalRevenue = 0;
          let totalMonthViews = 0;
          for (const id of channelIds) {
            const m = monthMap.get(id);
            const revenue = m?.revenue_usd || 0;
            const views = m?.views || 0;
            channelRevenueMap[id] = {
              revenue,
              views,
              rpm: views > 0 ? (revenue / views) * 1000 : 0,
            };
            totalRevenue += revenue;
            totalMonthViews += views;
          }

          return Response.json({
            data: {
              channels,
              currentPerformance: {
                columnHeaders: [{ name: "views", columnType: "METRIC", dataType: "INTEGER" }],
                rows: [[totalMonthViews]],
              },
              prevPerformance: null,
              currentRevenue: {
                columnHeaders: [{ name: "estimatedRevenue", columnType: "METRIC", dataType: "CURRENCY" }],
                rows: [[totalRevenue]],
              },
              prevRevenue: null,
              dailyRevenue: null,
              topVideos: { analytics: null, videos: [] },
              hasOwnChannel: channels.length > 0,
              channelRevenueMap,
              lastDayRevenue: 0,
              lastDayDate: "",
              perChannelAnalytics: {},
              tokenizedChannels: [],
            },
            _cached: true,
            _monthly: monthlyParam,
            _cacheStatus: channelIds.every((id) => monthMap.has(id)) ? analytics.cacheStatus : "partial",
            _missingChannels: channelIds.filter((id) => !monthMap.has(id)).length,
          });
        }

        const rangeCacheRequested = url.searchParams.get("rangeCache") === "true";
        const dashboardRange = { startDate, endDate, prevStartDate, prevEndDate };
        if (rangeCacheRequested) {
          const cachedRange = await getCachedDashboardRangeData(channelIds, dashboardRange);
          if (cachedRange) {
            return Response.json({
              data: cachedRange.data,
              _cached: true,
              _lastUpdated: cachedRange.lastUpdated,
              _range: { startDate, endDate },
            });
          }
        }

        if (url.searchParams.get("cacheOnly") === "true") {
          const requestedChannels = new Set(channelIds);
          const allCached = await getAllCachedClientData();
          const cachedChannelMap = new Map<
            string,
            (typeof allCached)[number]["channels"][number]
          >();
          for (const client of allCached) {
            for (const channel of client.channels || []) {
              if (!requestedChannels.has(channel.channelId)) continue;
              const existing = cachedChannelMap.get(channel.channelId);
              if (!existing || channel.lastUpdated >= existing.lastUpdated) {
                cachedChannelMap.set(channel.channelId, channel);
              }
            }
          }
          const cachedChannels = Array.from(cachedChannelMap.values());
          const channels = cachedChannels.map((channel) => ({
            id: channel.channelId,
            snippet: {
              title: channel.channelTitle || channel.channelId,
              thumbnails: {
                default: { url: channel.thumbnail || "" },
                medium: { url: channel.thumbnail || "" },
              },
            },
            statistics: {
              subscriberCount: String(channel.subscribers || 0),
              videoCount: String(channel.videoCount || 0),
              viewCount: String(channel.views || 0),
            },
          }));
          const channelRevenueMap = Object.fromEntries(
            cachedChannels.map((channel) => [
              channel.channelId,
              {
                revenue: channel.estimatedRevenue || 0,
                views: channel.views || 0,
                rpm: channel.rpm || 0,
              },
            ])
          );
          const totalRevenue = cachedChannels.reduce(
            (total, channel) => total + (channel.estimatedRevenue || 0),
            0
          );
          const currentRevenue = {
            columnHeaders: [
              {
                name: "estimatedRevenue",
                columnType: "METRIC",
                dataType: "CURRENCY",
              },
            ],
            rows: [[totalRevenue]],
          };
          const lastUpdated = allCached.reduce<string | null>((latest, client) => {
            if (!latest || client.lastUpdated > latest) return client.lastUpdated;
            return latest;
          }, null);

          return Response.json({
            data: {
              channels,
              currentPerformance: null,
              prevPerformance: null,
              currentRevenue,
              prevRevenue: null,
              dailyRevenue: null,
              topVideos: { analytics: null, videos: [] },
              hasOwnChannel: channels.length > 0,
              channelRevenueMap,
              lastDayRevenue: 0,
              lastDayDate: "",
              perChannelAnalytics: {},
              tokenizedChannels: [],
            },
            _cached: true,
            _lastUpdated: lastUpdated,
          });
        }

        const performanceMetrics = "views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes";

        // Login tokens lack YouTube scopes — always use per-channel tokens
        const hasAdminToken = false;

        // Use per-channel tokens for channel data lookup
        let channelLookupToken: string | undefined = undefined;
        for (const cid of channelIds) {
          const t = await getValidAccessToken(cid);
          if (t) { channelLookupToken = t; break; }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let channelsPromise: Promise<any[]>;
        if (channelIds.length > 0 && channelLookupToken) {
          channelsPromise = getChannelStatsById(channelLookupToken, channelIds);
        } else if (channelLookupToken) {
          channelsPromise = getChannelStats(channelLookupToken);
        } else if (channelIds.length > 0) {
          // Fallback: use API key for public channel data
          channelsPromise = getChannelStatsByIdPublic(channelIds);
        } else {
          channelsPromise = Promise.resolve([]);
        }

        // No admin token — all data comes from per-channel tokens
        const hasOwnChannel = false;

        // Get yesterday's date for last day revenue
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 2); // YouTube data is ~2 days delayed
        const lastDayDate = yesterday.toISOString().split("T")[0];

        // Collect per-channel tokens for channels that have valid OAuth tokens
        const channelTokenMap: Record<string, string> = {};
        const channelTokenErrors: Record<string, string> = {};
        for (const cid of channelIds) {
          const tokenStatus = await getTokenStatus(cid);
          if (tokenStatus === "valid" || tokenStatus === "expired") {
            const token = await getValidAccessToken(cid);
            if (token) {
              channelTokenMap[cid] = token;
            } else {
              channelTokenErrors[cid] = `Token status=${tokenStatus} but getValidAccessToken returned null`;
            }
          } else {
            channelTokenErrors[cid] = `Token status=${tokenStatus}`;
          }
        }
        console.log(`[dashboardFull] channelIds=${channelIds.length}, tokenized=${Object.keys(channelTokenMap).length}, errors=${JSON.stringify(channelTokenErrors)}`);
        const tokenizedChannelIds = Object.keys(channelTokenMap);
        const hasAnyToken = hasOwnChannel || tokenizedChannelIds.length > 0;

        // All YouTube data comes from per-channel tokens (no admin token for YouTube API)
        // Wrap in try-catch so quota errors don't crash the entire endpoint
        let channels: unknown[] = [];
        try {
          channels = await channelsPromise;
        } catch (chErr) {
          console.warn("[dashboardFull] Channel stats lookup failed (quota?):", chErr instanceof Error ? chErr.message : chErr);
        }

        // If YouTube API returned no channel data, fall back to KV cache
        if (channels.length === 0 && channelIds.length > 0) {
          try {
            const allCached = await getAllCachedClientData();
            const cachedChannelMap = new Map<string, { id: string; snippet: { title: string; thumbnails: { default: { url: string } } }; statistics: { subscriberCount: string; videoCount: string; viewCount: string } }>();
            for (const cd of allCached) {
              for (const ch of (cd.channels || [])) {
                if (channelIds.includes(ch.channelId)) {
                  cachedChannelMap.set(ch.channelId, {
                    id: ch.channelId,
                    snippet: { title: ch.channelTitle || ch.channelId, thumbnails: { default: { url: ch.thumbnail || "" } } },
                    statistics: { subscriberCount: String(ch.subscribers || 0), videoCount: String(ch.videoCount || 0), viewCount: String(ch.views || 0) },
                  });
                }
              }
            }
            if (cachedChannelMap.size > 0) {
              channels = Array.from(cachedChannelMap.values());
              console.log(`[dashboardFull] Using cached data for ${cachedChannelMap.size} channels`);
            }
          } catch (cacheErr) {
            console.warn("[dashboardFull] Cache fallback failed:", cacheErr instanceof Error ? cacheErr.message : cacheErr);
          }
        }
        const currentPerformance = null;
        const prevPerformance = null;
        const currentRevenue = null;
        const prevRevenue = null;
        const dailyRevenue = null;
        // Fetch analytics for each tokenized channel using their own OAuth tokens
        const perChannelAnalytics: Record<string, {
          performance: Record<string, unknown> | null;
          prevPerformance: Record<string, unknown> | null;
          revenue: Record<string, unknown> | null;
          prevRevenue: Record<string, unknown> | null;
          dailyRevenue: Record<string, unknown> | null;
          revenueViews: Record<string, unknown> | null;
        }> = {};

        // Collect top video analytics across all channels
        const allVideoAnalyticsRows: unknown[][] = [];
        const allVideoAnalyticsHeaders: Array<{ name?: string | null }> = [];
        const allVideoIds: string[] = [];

        const perChannelErrors: Record<string, string> = {};
        for (const [cid, token] of Object.entries(channelTokenMap)) {
          // Process all tokenized channels
          try {
            const [perf, prevPerf, rev, prevRev, daily, revViews, videoAnalytics] = await Promise.all([
              getAnalyticsData(token, startDate, endDate, performanceMetrics, "", cid).catch((e) => { console.error(`[dashboardFull] ${cid} perf error:`, e?.message || e); return null; }),
              getAnalyticsData(token, prevStartDate, prevEndDate, performanceMetrics, "", cid).catch(() => null),
              getRevenueData(token, startDate, endDate, cid).catch((e) => { console.error(`[dashboardFull] ${cid} rev error:`, e?.message || e); return null; }),
              getRevenueData(token, prevStartDate, prevEndDate, cid).catch(() => null),
              getAnalyticsData(token, (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`; })(), endDate, "estimatedRevenue", "day", cid).catch(() => null),
              getAnalyticsData(token, startDate, endDate, "estimatedRevenue,views", "", cid).catch(() => null),
              getAnalyticsData(token, startDate, endDate, "views,likes,subscribersGained,estimatedRevenue", "video", cid).catch(() => null),
            ]);
            perChannelAnalytics[cid] = {
              performance: perf as Record<string, unknown> | null,
              prevPerformance: prevPerf as Record<string, unknown> | null,
              revenue: rev as Record<string, unknown> | null,
              prevRevenue: prevRev as Record<string, unknown> | null,
              dailyRevenue: daily as Record<string, unknown> | null,
              revenueViews: revViews as Record<string, unknown> | null,
            };
            // Collect video analytics rows
            const va = videoAnalytics as { rows?: unknown[][]; columnHeaders?: Array<{ name?: string | null }> } | null;
            if (va?.rows?.length && va.columnHeaders) {
              if (allVideoAnalyticsHeaders.length === 0) {
                allVideoAnalyticsHeaders.push(...va.columnHeaders);
              }
              allVideoAnalyticsRows.push(...va.rows);
              const vidIdx = va.columnHeaders.findIndex((h) => h.name === "video");
              if (vidIdx !== -1) {
                for (const row of va.rows) {
                  allVideoIds.push(String(row[vidIdx]));
                }
              }
            }
            console.log(`[dashboardFull] ${cid}: perf=${!!perf}, rev=${!!rev}, revViews=${!!revViews}, videos=${va?.rows?.length || 0}`);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[dashboardFull] ${cid} analytics failed:`, errMsg);
            perChannelErrors[cid] = errMsg;
          }
        }

        // Fetch video details for top videos (up to 50)
        let topVideoItems: unknown[] = [];
        if (allVideoIds.length > 0) {
          try {
            const anyToken = Object.values(channelTokenMap)[0];
            if (anyToken) {
              const { google: g } = await import("googleapis");
              const auth = new g.auth.OAuth2();
              auth.setCredentials({ access_token: anyToken });
              const yt = g.youtube({ version: "v3", auth });
              const top50Ids = allVideoIds.slice(0, 50);
              const vRes = await yt.videos.list({ part: ["snippet", "statistics", "contentDetails"], id: top50Ids });
              topVideoItems = vRes.data.items || [];
            }
          } catch (vErr) {
            console.warn("[dashboardFull] top video details fetch failed:", vErr instanceof Error ? vErr.message : vErr);
          }
        }
        const topVideosByViews = {
          analytics: allVideoAnalyticsRows.length > 0 ? { rows: allVideoAnalyticsRows, columnHeaders: allVideoAnalyticsHeaders } : null,
          videos: topVideoItems,
        };

        // Build per-channel revenue map — use flat totals (no dimensions) for accuracy
        const channelRevenueMap: Record<string, { revenue: number; views: number; rpm: number }> = {};

        for (const [cid, data] of Object.entries(perChannelAnalytics)) {
          let rev = 0;
          let views = 0;

          // Primary: use revenueViews (flat total, no dimensions — most accurate for any date range)
          const rvData = data.revenueViews as { rows?: unknown[][]; columnHeaders?: Array<{ name?: string | null }> } | null;
          if (rvData?.rows?.length && rvData.columnHeaders) {
            const headers = rvData.columnHeaders.map((h) => h.name || "");
            const revIdx = headers.indexOf("estimatedRevenue");
            const viewsIdx = headers.indexOf("views");
            if (revIdx !== -1) {
              rev = rvData.rows.reduce((sum, row) => sum + (Number(row[revIdx]) || 0), 0);
            }
            if (viewsIdx !== -1) {
              views = rvData.rows.reduce((sum, row) => sum + (Number(row[viewsIdx]) || 0), 0);
            }
          }

          // Fallback: use getRevenueData result if revenueViews unavailable
          if (rev === 0) {
            const revData = data.revenue as { rows?: unknown[][]; columnHeaders?: Array<{ name?: string | null }> } | null;
            if (revData?.rows?.length && revData.columnHeaders) {
              const headers = revData.columnHeaders.map((h) => h.name || "");
              const revIdx = headers.indexOf("estimatedRevenue");
              if (revIdx !== -1) {
                rev = revData.rows.reduce((sum, row) => sum + (Number(row[revIdx]) || 0), 0);
              }
            }
          }

          // Fallback: views from performance data
          if (views === 0) {
            const perfData = data.performance as { rows?: unknown[][]; columnHeaders?: Array<{ name?: string | null }> } | null;
            if (perfData?.rows?.length && perfData.columnHeaders) {
              const viewsIdx = perfData.columnHeaders.map((h) => h.name || "").indexOf("views");
              if (viewsIdx !== -1) {
                views = perfData.rows.reduce((sum, row) => sum + (Number(row[viewsIdx]) || 0), 0);
              }
            }
          }

          channelRevenueMap[cid] = {
            revenue: rev,
            views,
            rpm: views > 0 ? (rev / views) * 1000 : 0,
          };
          console.log(`[dashboardFull] ${cid} revenueMap: rev=${rev.toFixed(2)}, views=${views}, range=${startDate}~${endDate}`);
        }

        // Last day revenue — computed from per-channel data
        let lastDayRevenue = 0;
        for (const pca of Object.values(perChannelAnalytics)) {
          const revData = pca.revenueViews as { rows?: unknown[][]; columnHeaders?: Array<{ name?: string | null }> } | null;
          if (revData?.rows?.length && revData.columnHeaders) {
            const headers = revData.columnHeaders.map((h) => h.name || "");
            const revIdx = headers.indexOf("estimatedRevenue");
            if (revIdx !== -1) {
              lastDayRevenue += Number(revData.rows[0][revIdx]) || 0;
            }
          }
        }

        const responseData = {
          channels,
          currentPerformance,
          prevPerformance,
          currentRevenue,
          prevRevenue,
          dailyRevenue,
          topVideos: topVideosByViews,
          hasOwnChannel: hasAnyToken,
          channelRevenueMap,
          lastDayRevenue,
          lastDayDate,
          perChannelAnalytics,
          tokenizedChannels: tokenizedChannelIds,
          _debug: {
            totalChannelIds: channelIds.length,
            tokenizedCount: tokenizedChannelIds.length,
            channelTokenErrors,
            perChannelErrors,
            hasAdminToken,
          },
        };

        // Cache dashboard data on success (only if we got real analytics data)
        if (Object.keys(perChannelAnalytics).length > 0) {
          cacheDashboardData(channelIds, responseData).catch(() => {});
          if (rangeCacheRequested) {
            cacheDashboardRangeData(channelIds, dashboardRange, responseData).catch(() => {});
          }
        }

        return Response.json({ data: responseData, _range: { startDate, endDate } });
      }
      case "realtime48": {
        // Fetch last 48 hours of data (actually last 3 days to account for YouTube's 2-day delay)
        const channelIdsParam48 = url.searchParams.get("channelIds") || "";
        const channelIds48 = channelIdsParam48 ? channelIdsParam48.split(",").filter(Boolean) : [];

        if (channelIds48.length === 0) {
          return Response.json({ data: { views: 0, subscribers: 0, watchTime: 0, revenue: 0, dailyBreakdown: [] } });
        }
        if (!hasChannelAccess(channelIds48, channelScope.approved)) {
          return Response.json({ error: "You can only access channels assigned to your account" }, { status: 403 });
        }

        // Check if user has realtime access (admin setting)
        const userEmail48 = session.user?.email || "";
        const realtimeSettings = await kv.get<Record<string, boolean>>("realtime_settings") || {};
        const isAdmin48 = ADMIN_EMAILS.includes(userEmail48);
        // Admin always has access; clients check their setting (default: enabled)
        if (!isAdmin48 && realtimeSettings[userEmail48] === false) {
          return Response.json({ data: { disabled: true, message: "Realtime view is disabled by admin" } });
        }

        const now = new Date();
        const day1 = new Date(now); day1.setDate(now.getDate() - 1);
        const day2 = new Date(now); day2.setDate(now.getDate() - 2);
        const day3 = new Date(now); day3.setDate(now.getDate() - 3);
        const realtimeStart = `${day3.getUTCFullYear()}-${String(day3.getUTCMonth()+1).padStart(2,"0")}-${String(day3.getUTCDate()).padStart(2,"0")}`;
        const realtimeEnd = `${day1.getUTCFullYear()}-${String(day1.getUTCMonth()+1).padStart(2,"0")}-${String(day1.getUTCDate()).padStart(2,"0")}`;

        let totalViews48 = 0;
        let totalSubs48 = 0;
        let totalWatchTime48 = 0;
        let totalRevenue48 = 0;
        const dailyBreakdown: Array<{ date: string; views: number; subscribers: number; watchTime: number; revenue: number }> = [];
        const dailyMap = new Map<string, { views: number; subscribers: number; watchTime: number; revenue: number }>();

        for (const cid of channelIds48) {
          const token48 = await getValidAccessToken(cid);
          if (!token48) continue;
          try {
            const [perfData, revData] = await Promise.all([
              getAnalyticsData(token48, realtimeStart, realtimeEnd, "views,estimatedMinutesWatched,subscribersGained", "day", cid).catch(() => null),
              getAnalyticsData(token48, realtimeStart, realtimeEnd, "estimatedRevenue", "day", cid).catch(() => null),
            ]);
            // Process performance data
            const perf = perfData as { rows?: unknown[][]; columnHeaders?: Array<{ name?: string | null }> } | null;
            if (perf?.rows?.length && perf.columnHeaders) {
              const headers = perf.columnHeaders.map(h => h.name || "");
              const dayIdx = headers.indexOf("day");
              const viewsIdx = headers.indexOf("views");
              const watchIdx = headers.indexOf("estimatedMinutesWatched");
              const subsIdx = headers.indexOf("subscribersGained");
              for (const row of perf.rows) {
                const dayStr = String(row[dayIdx] || "");
                const views = Number(row[viewsIdx] || 0);
                const watch = Number(row[watchIdx] || 0);
                const subs = Number(row[subsIdx] || 0);
                totalViews48 += views;
                totalWatchTime48 += watch;
                totalSubs48 += subs;
                const existing = dailyMap.get(dayStr) || { views: 0, subscribers: 0, watchTime: 0, revenue: 0 };
                existing.views += views;
                existing.watchTime += watch;
                existing.subscribers += subs;
                dailyMap.set(dayStr, existing);
              }
            }
            // Process revenue data
            const rev48 = revData as { rows?: unknown[][]; columnHeaders?: Array<{ name?: string | null }> } | null;
            if (rev48?.rows?.length && rev48.columnHeaders) {
              const headers = rev48.columnHeaders.map(h => h.name || "");
              const dayIdx = headers.indexOf("day");
              const revIdx = headers.indexOf("estimatedRevenue");
              for (const row of rev48.rows) {
                const dayStr = String(row[dayIdx] || "");
                const rev = Number(row[revIdx] || 0);
                totalRevenue48 += rev;
                const existing = dailyMap.get(dayStr) || { views: 0, subscribers: 0, watchTime: 0, revenue: 0 };
                existing.revenue += rev;
                dailyMap.set(dayStr, existing);
              }
            }
          } catch (err48) {
            console.warn(`[realtime48] ${cid} error:`, err48 instanceof Error ? err48.message : err48);
          }
        }

        // Sort daily breakdown by date
        for (const [date, data] of Array.from(dailyMap.entries()).sort()) {
          dailyBreakdown.push({ date, ...data });
        }

        return Response.json({
          data: {
            views: totalViews48,
            subscribers: totalSubs48,
            watchTime: totalWatchTime48,
            revenue: totalRevenue48,
            dailyBreakdown,
            period: { start: realtimeStart, end: realtimeEnd },
          }
        });
      }
      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: unknown) {
    let message = "YouTube API error";
    if (error instanceof Error) {
      message = error.message;
    }
    const errorObj = error as { response?: { data?: { error?: { message?: string; code?: number } } }; code?: number };
    if (errorObj?.response?.data?.error?.message) {
      message = errorObj.response.data.error.message;
    }
    console.error("YouTube API error:", JSON.stringify(error, null, 2));
    return Response.json({ error: message, action }, { status: 500 });
  }
}

function getDefaultStartDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split("T")[0];
}

function getDefaultEndDate(): string {
  return new Date().toISOString().split("T")[0];
}
