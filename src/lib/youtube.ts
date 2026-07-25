import { google } from "googleapis";

function getAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

function getApiKeyYouTube() {
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return google.youtube({ version: "v3", auth: apiKey });
}

export async function getChannelStatsByIdPublic(channelIds: string[]) {
  if (channelIds.length === 0) return [];
  const youtube = getApiKeyYouTube();
  if (!youtube) return [];
  const allItems: Array<Record<string, unknown>> = [];
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const response = await youtube.channels.list({
      part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
      id: batch,
    });
    if (response.data.items) {
      allItems.push(...response.data.items.map((item) => ({ ...item })));
    }
  }
  return allItems;
}

export async function getChannelVideosPublic(channelId: string, maxResults = 0) {
  const youtube = getApiKeyYouTube();
  if (!youtube) return [];
  const channelRes = await youtube.channels.list({
    part: ["contentDetails"],
    id: [channelId],
  });
  const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return [];

  const allVideoIds: string[] = [];
  let nextPageToken: string | undefined;
  // maxResults=0 means fetch ALL videos (no limit)
  while (maxResults === 0 || allVideoIds.length < maxResults) {
    const playlistRes = await youtube.playlistItems.list({
      part: ["contentDetails"],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken: nextPageToken,
    });
    const ids = playlistRes.data.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => !!id) || [];
    allVideoIds.push(...ids);
    nextPageToken = playlistRes.data.nextPageToken ?? undefined;
    if (!nextPageToken) break;
  }
  if (allVideoIds.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allItems: any[] = [];
  for (let i = 0; i < allVideoIds.length; i += 50) {
    const batch = allVideoIds.slice(i, i + 50);
    const videoResponse = await youtube.videos.list({
      part: ["snippet", "statistics", "contentDetails", "status"],
      id: batch,
    });
    if (videoResponse.data.items) {
      allItems.push(...videoResponse.data.items);
    }
  }
  return allItems;
}

export async function getChannelStats(accessToken: string) {
  const auth = getAuthClient(accessToken);
  const youtube = google.youtube({ version: "v3", auth });

  const response = await youtube.channels.list({
    part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
    mine: true,
  });

  return response.data.items || [];
}

export async function getChannelStatsById(
  accessToken: string,
  channelIds: string[]
) {
  if (channelIds.length === 0) return [];
  const auth = getAuthClient(accessToken);
  const youtube = google.youtube({ version: "v3", auth });

  const allItems: Array<Record<string, unknown>> = [];
  // YouTube API allows max 50 IDs per request
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const response = await youtube.channels.list({
      part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
      id: batch,
    });
    if (response.data.items) {
      allItems.push(
        ...response.data.items.map((item) => ({
          ...item,
        }))
      );
    }
  }
  return allItems;
}

export async function lookupChannel(
  accessToken: string,
  query: string
) {
  const auth = getAuthClient(accessToken);
  const youtube = google.youtube({ version: "v3", auth });

  // Try by channel ID first (starts with UC)
  if (query.startsWith("UC") && query.length >= 20) {
    const response = await youtube.channels.list({
      part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
      id: [query],
    });
    if (response.data.items?.length) return response.data.items;
  }

  // Try by handle (@username)
  if (query.startsWith("@")) {
    const response = await youtube.channels.list({
      part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
      forHandle: query,
    });
    if (response.data.items?.length) return response.data.items;
  }

  // Try extracting channel ID from URL
  const urlPatterns = [
    /youtube\.com\/channel\/(UC[\w-]+)/,
    /youtube\.com\/@([\w.-]+)/,
    /youtube\.com\/c\/([\w.-]+)/,
  ];
  for (const pattern of urlPatterns) {
    const match = query.match(pattern);
    if (match) {
      const idOrHandle = match[1];
      if (idOrHandle.startsWith("UC")) {
        const response = await youtube.channels.list({
          part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
          id: [idOrHandle],
        });
        if (response.data.items?.length) return response.data.items;
      } else {
        const response = await youtube.channels.list({
          part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
          forHandle: `@${idOrHandle}`,
        });
        if (response.data.items?.length) return response.data.items;
      }
    }
  }

  // Fallback: search for channel
  const searchResponse = await youtube.search.list({
    part: ["snippet"],
    q: query,
    type: ["channel"],
    maxResults: 5,
  });

  if (!searchResponse.data.items?.length) return [];

  const channelIds = searchResponse.data.items
    .map((item) => item.snippet?.channelId)
    .filter(Boolean)
    .join(",");

  if (!channelIds) return [];

  const channelResponse = await youtube.channels.list({
    part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
    id: [channelIds],
  });

  return channelResponse.data.items || [];
}

export async function getChannelVideos(
  accessToken: string,
  channelId: string,
  maxResults = 0
) {
  const auth = getAuthClient(accessToken);
  const youtube = google.youtube({ version: "v3", auth });

  // Get the uploads playlist for the channel
  const channelRes = await youtube.channels.list({
    part: ["contentDetails"],
    id: [channelId],
  });
  const uploadsPlaylistId =
    channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) return [];

  // Fetch ALL videos from the uploads playlist (maxResults=0 means no limit)
  const allVideoIds: string[] = [];
  let nextPageToken: string | undefined;

  while (maxResults === 0 || allVideoIds.length < maxResults) {
    const playlistRes = await youtube.playlistItems.list({
      part: ["contentDetails"],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken: nextPageToken,
    });

    const ids = playlistRes.data.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => !!id) || [];

    allVideoIds.push(...ids);
    nextPageToken = playlistRes.data.nextPageToken ?? undefined;
    if (!nextPageToken) break;
  }

  if (allVideoIds.length === 0) return [];

  // Fetch full video details in batches of 50
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allItems: any[] = [];
  for (let i = 0; i < allVideoIds.length; i += 50) {
    const batch = allVideoIds.slice(i, i + 50);
    const videoResponse = await youtube.videos.list({
      part: ["snippet", "statistics", "contentDetails", "status"],
      id: batch,
    });
    if (videoResponse.data.items) {
      allItems.push(...videoResponse.data.items);
    }
  }

  return allItems;
}

export async function getAnalyticsData(
  accessToken: string,
  startDate: string,
  endDate: string,
  metrics: string = "views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes,averageViewDuration",
  dimensions: string = "day",
  channelId?: string
) {
  const auth = getAuthClient(accessToken);
  const analytics = google.youtubeAnalytics({ version: "v2", auth });

  const ids = channelId ? `channel==${channelId}` : "channel==MINE";

  const response = await analytics.reports.query({
    ids,
    startDate,
    endDate,
    metrics,
    dimensions: dimensions || undefined,
    sort: dimensions === "day" ? "day" : undefined,
  });

  return response.data;
}

export async function getTrafficSources(
  accessToken: string,
  startDate: string,
  endDate: string,
  channelId?: string
) {
  const auth = getAuthClient(accessToken);
  const analytics = google.youtubeAnalytics({ version: "v2", auth });

  const ids = channelId ? `channel==${channelId}` : "channel==MINE";

  const response = await analytics.reports.query({
    ids,
    startDate,
    endDate,
    metrics: "views,estimatedMinutesWatched",
    dimensions: "insightTrafficSourceType",
    sort: "-views",
  });

  return response.data;
}

export async function getCountryData(
  accessToken: string,
  startDate: string,
  endDate: string,
  channelId?: string
) {
  const auth = getAuthClient(accessToken);
  const analytics = google.youtubeAnalytics({ version: "v2", auth });

  const ids = channelId ? `channel==${channelId}` : "channel==MINE";

  const response = await analytics.reports.query({
    ids,
    startDate,
    endDate,
    metrics: "views,estimatedMinutesWatched",
    dimensions: "country",
    sort: "-views",
    maxResults: 10,
  });

  return response.data;
}

export async function getDemographics(
  accessToken: string,
  startDate: string,
  endDate: string,
  channelId?: string
) {
  const auth = getAuthClient(accessToken);
  const analytics = google.youtubeAnalytics({ version: "v2", auth });

  const ids = channelId ? `channel==${channelId}` : "channel==MINE";

  const response = await analytics.reports.query({
    ids,
    startDate,
    endDate,
    metrics: "viewerPercentage",
    dimensions: "ageGroup,gender",
  });

  return response.data;
}

export async function getDeviceData(
  accessToken: string,
  startDate: string,
  endDate: string,
  channelId?: string
) {
  const auth = getAuthClient(accessToken);
  const analytics = google.youtubeAnalytics({ version: "v2", auth });

  const ids = channelId ? `channel==${channelId}` : "channel==MINE";

  const response = await analytics.reports.query({
    ids,
    startDate,
    endDate,
    metrics: "views,estimatedMinutesWatched",
    dimensions: "deviceType",
    sort: "-views",
  });

  return response.data;
}

export async function getRevenueData(
  accessToken: string,
  startDate: string,
  endDate: string,
  channelId?: string
) {
  const auth = getAuthClient(accessToken);
  const analytics = google.youtubeAnalytics({ version: "v2", auth });

  const ids = channelId ? `channel==${channelId}` : "channel==MINE";

  // Use flat totals (no dimensions) for accurate date-range revenue.
  // dimensions:"month" can return inaccurate partial-month data when
  // the date range doesn't align with calendar months.
  try {
    const response = await analytics.reports.query({
      ids,
      startDate,
      endDate,
      metrics: "estimatedRevenue,estimatedAdRevenue,grossRevenue",
    });
    return response.data;
  } catch {
    // grossRevenue requires content owner access — fallback without it
    try {
      const response = await analytics.reports.query({
        ids,
        startDate,
        endDate,
        metrics: "estimatedRevenue,estimatedAdRevenue",
      });
      return response.data;
    } catch {
      // Final fallback — just estimatedRevenue
      try {
        const response = await analytics.reports.query({
          ids,
          startDate,
          endDate,
          metrics: "estimatedRevenue",
        });
        return response.data;
      } catch {
        return null;
      }
    }
  }
}

export async function getTopVideos(
  accessToken: string,
  startDate: string,
  endDate: string,
  channelId?: string
) {
  const auth = getAuthClient(accessToken);
  const analytics = google.youtubeAnalytics({ version: "v2", auth });

  const ids = channelId ? `channel==${channelId}` : "channel==MINE";

  const response = await analytics.reports.query({
    ids,
    startDate,
    endDate,
    metrics: "views,likes,estimatedMinutesWatched,subscribersGained,estimatedRevenue",
    dimensions: "video",
    sort: "-views",
    maxResults: 10,
  });

  if (!response.data.rows?.length) return { analytics: response.data, videos: [] };

  const videoIds =
    response.data.rows.map((row) => row[0] as string).join(",");

  const youtube = google.youtube({ version: "v3", auth });
  const videoResponse = await youtube.videos.list({
    part: ["snippet", "statistics", "contentDetails"],
    id: [videoIds],
  });

  return {
    analytics: response.data,
    videos: videoResponse.data.items || [],
  };
}
