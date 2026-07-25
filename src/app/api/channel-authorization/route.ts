import { kv } from "@/lib/redis";
import {
  buildYouTubeOAuthUrl,
  getPublicOrigin,
  YOUTUBE_OAUTH_CONSENT_VERSION,
  YOUTUBE_SCOPE_DETAILS,
  type ChannelOAuthState,
} from "@/lib/youtube-oauth";

export const dynamic = "force-dynamic";

function getStateKey(state: string | null): string | null {
  const match = state?.match(/^cms-oauth-([A-Za-z0-9_-]+)$/);
  return match ? `channel_oauth_state:${match[1]}` : null;
}

function noStoreJson(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });
}

export async function GET(request: Request) {
  const state = new URL(request.url).searchParams.get("state");
  const stateKey = getStateKey(state);
  if (!stateKey) {
    return noStoreJson({ error: "Invalid authorization link" }, { status: 400 });
  }

  const oauthState = await kv.get<ChannelOAuthState>(stateKey);
  if (!oauthState?.channelId) {
    return noStoreJson(
      { error: "This authorization link has expired. Request a new link from InTubeMedia." },
      { status: 410 }
    );
  }

  return noStoreJson({
    data: {
      channelId: oauthState.channelId,
      channelTitle: oauthState.channelTitle || oauthState.channelId,
      scopes: YOUTUBE_SCOPE_DETAILS,
      consentVersion: YOUTUBE_OAUTH_CONSENT_VERSION,
    },
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    state?: string;
    acceptedPolicies?: boolean;
    confirmsChannelAuthority?: boolean;
  };
  const stateKey = getStateKey(body.state || null);
  if (!stateKey) {
    return noStoreJson({ error: "Invalid authorization link" }, { status: 400 });
  }
  if (!body.acceptedPolicies || !body.confirmsChannelAuthority) {
    return noStoreJson(
      { error: "Policy acceptance and channel authority confirmation are required" },
      { status: 400 }
    );
  }

  const oauthState = await kv.get<ChannelOAuthState>(stateKey);
  const ttl = await kv.ttl(stateKey);
  if (!oauthState?.channelId || ttl <= 0) {
    return noStoreJson(
      { error: "This authorization link has expired. Request a new link from InTubeMedia." },
      { status: 410 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return noStoreJson({ error: "Google OAuth is not configured" }, { status: 500 });
  }

  const origin = getPublicOrigin(request);
  const consentedState: ChannelOAuthState = {
    ...oauthState,
    consentedAt: new Date().toISOString(),
    consentVersion: YOUTUBE_OAUTH_CONSENT_VERSION,
  };
  await kv.setex(stateKey, ttl, consentedState);

  return noStoreJson({
    data: {
      oauthUrl: buildYouTubeOAuthUrl({
        clientId,
        redirectUri: `${origin}/callback`,
        state: body.state || "",
      }),
    },
  });
}
