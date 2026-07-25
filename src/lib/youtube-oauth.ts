import { getAppUrl } from "@/lib/app-url";

export const YOUTUBE_OAUTH_CONSENT_VERSION = "2026-06-07";

export interface ChannelOAuthState {
  channelId: string;
  channelTitle: string;
  createdBy: string;
  createdAt: string;
  consentedAt?: string;
  consentVersion?: string;
}

export const YOUTUBE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
] as const;

export const YOUTUBE_SCOPE_DETAILS = [
  {
    scope: YOUTUBE_OAUTH_SCOPES[0],
    title: "Manage your YouTube channel",
    description:
      "Read channel and video metadata and perform video updates or deletes only when you explicitly request those actions in the CMS.",
  },
  {
    scope: YOUTUBE_OAUTH_SCOPES[1],
    title: "View YouTube Analytics",
    description:
      "Read views, watch time, traffic, audience, and other non-monetary channel performance metrics for dashboards and reports.",
  },
  {
    scope: YOUTUBE_OAUTH_SCOPES[2],
    title: "View monetary analytics",
    description:
      "Read estimated revenue, CPM, RPM, and monetization metrics for revenue dashboards, monthly reports, and authorized exports.",
  },
] as const;

interface BuildYouTubeOAuthUrlOptions {
  clientId: string;
  redirectUri: string;
  state: string;
}

export function buildYouTubeOAuthUrl({
  clientId,
  redirectUri,
  state,
}: BuildYouTubeOAuthUrlOptions): string {
  const params = new URLSearchParams({
    access_type: "offline",
    client_id: clientId,
    prompt: "consent",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YOUTUBE_OAUTH_SCOPES.join(" "),
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getPublicOrigin(request: Request): string {
  const configuredUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) {
    return new URL(configuredUrl).origin;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") {
    return requestUrl.origin;
  }

  return getAppUrl();
}
