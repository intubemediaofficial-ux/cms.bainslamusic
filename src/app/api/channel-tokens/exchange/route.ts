import { google, type youtube_v3 } from "googleapis";
import {
  getChannelToken,
  isKVConfigured,
  revokeGoogleCredential,
  setChannelToken,
  type ChannelToken,
} from "@/lib/channel-tokens";
import { kv } from "@/lib/redis";
import { removeChannelFromAllCaches } from "@/lib/client-data-cache";
import {
  syncRevenueDownstreamSheets,
  syncVerifiedChannelRevenue,
  type ChannelRevenueSyncStatus,
  type RevenueDownstreamSyncResult,
} from "@/lib/client-data-sync";
import {
  getPublicOrigin,
  YOUTUBE_OAUTH_CONSENT_VERSION,
  YOUTUBE_OAUTH_SCOPES,
  type ChannelOAuthState,
} from "@/lib/youtube-oauth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ChannelScopeUser {
  channels?: string[];
  pendingChannels?: string[];
  status?: "active" | "inactive" | "pending";
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function safelyRevokeCredential(token: string): Promise<void> {
  try {
    await revokeGoogleCredential(token);
  } catch (error) {
    console.warn(`[OAuth] Failed to revoke rejected authorization: ${errorMessage(error)}`);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: string;
      state?: string;
    };
    const { code, state } = body;
    if (!code || !state) {
      return Response.json({ error: "Missing code or state" }, { status: 400 });
    }

    const inviteMatch = state.match(/^cms-oauth-([A-Za-z0-9_-]+)$/);
    if (!inviteMatch) {
      return Response.json({ error: "Invalid or unsupported OAuth state" }, { status: 400 });
    }

    const oauthStateKey = `channel_oauth_state:${inviteMatch[1]}`;
    const oauthState = await kv.get<ChannelOAuthState>(oauthStateKey);
    if (!oauthState?.channelId) {
      return Response.json(
        { error: "This validation link has expired. Generate a new Validate Token link." },
        { status: 400 }
      );
    }
    if (
      !oauthState.consentedAt ||
      oauthState.consentVersion !== YOUTUBE_OAUTH_CONSENT_VERSION
    ) {
      return Response.json(
        { error: "Review and accept the authorization disclosures before continuing." },
        { status: 400 }
      );
    }

    const stateClaimed = await kv.setIfNotExists(`${oauthStateKey}:used`, "1", 15 * 60);
    if (!stateClaimed) {
      return Response.json(
        { error: "This authorization link has already been used. Generate a new link." },
        { status: 400 }
      );
    }
    await kv.del(oauthStateKey);

    const expectedChannelId = oauthState.channelId;
    const users = (await kv.get<ChannelScopeUser[]>("bainsla_users")) || [];
    const isStillAssigned = users.some(
      (user) =>
        user.status !== "inactive" &&
        [...(user.channels || []), ...(user.pendingChannels || [])].includes(
          expectedChannelId
        )
    );
    if (!isStillAssigned) {
      return Response.json({ error: "This channel is no longer assigned" }, { status: 403 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${getPublicOrigin(request)}/callback`;
    if (!clientId || !clientSecret) {
      return Response.json({ error: "Google OAuth not configured" }, { status: 500 });
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
    if (!tokenResponse.ok) {
      console.error(
        `[OAuth] Authorization-code exchange failed: ${tokenData.error || tokenResponse.status}`
      );
      return Response.json(
        { error: tokenData.error_description || "Failed to exchange authorization code" },
        { status: 400 }
      );
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return Response.json({ error: "No access token received" }, { status: 400 });
    }

    const grantedScopes = (tokenData.scope || "").split(" ").filter(Boolean);
    const missingScopes = YOUTUBE_OAUTH_SCOPES.filter(
      (scope) => !grantedScopes.includes(scope)
    );
    if (missingScopes.length > 0) {
      await safelyRevokeCredential(accessToken);
      return Response.json(
        {
          error:
            "Required YouTube permissions were not granted. Please retry and approve all requested permissions.",
        },
        { status: 400 }
      );
    }

    let channel: youtube_v3.Schema$Channel | undefined;
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      const youtube = google.youtube({ version: "v3", auth: oauth2Client });
      const channelResponse = await youtube.channels.list({
        part: ["snippet", "statistics"],
        mine: true,
      });
      channel = channelResponse.data.items?.[0];
    } catch (error) {
      await safelyRevokeCredential(accessToken);
      console.warn(
        `[OAuth] Channel ownership verification failed for ${expectedChannelId}: ${errorMessage(error)}`
      );
      return Response.json(
        {
          error:
            "Google authorization succeeded, but channel ownership could not be verified. No token was stored. Please retry later.",
        },
        { status: 502 }
      );
    }

    if (!channel?.id) {
      await safelyRevokeCredential(accessToken);
      return Response.json(
        {
          error:
            "The selected Google account did not return a YouTube channel. No token was stored.",
        },
        { status: 400 }
      );
    }
    const verifiedChannel = channel;
    const googleChannelId = verifiedChannel.id;
    const channelTitle = verifiedChannel.snippet?.title || expectedChannelId;
    if (googleChannelId !== expectedChannelId) {
      await safelyRevokeCredential(accessToken);
      console.warn(
        `[OAuth] Channel mismatch. Expected ${expectedChannelId}; received ${googleChannelId}`
      );
      return Response.json(
        {
          error: `This Google account manages "${channelTitle}" (${googleChannelId}), not the assigned channel (${expectedChannelId}). No token was stored.`,
        },
        { status: 400 }
      );
    }

    const existingToken = await getChannelToken(expectedChannelId);
    const refreshToken = tokenData.refresh_token || existingToken?.refreshToken;
    if (!refreshToken) {
      await safelyRevokeCredential(accessToken);
      return Response.json(
        {
          error:
            "Google did not return offline authorization. No token was stored. Revoke InTubeMedia in Google permissions and retry.",
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const channelToken: ChannelToken = {
      channelId: expectedChannelId,
      channelTitle,
      accessToken,
      refreshToken,
      tokenExpiry: Date.now() + (tokenData.expires_in || 3600) * 1000,
      createdAt: existingToken?.createdAt || now,
      updatedAt: now,
      lastValidatedAt: now,
      lastChannelVerifiedAt: now,
      googleChannelId,
      grantedScopes: grantedScopes.join(" "),
    };
    try {
      await removeChannelFromAllCaches(expectedChannelId);
      await setChannelToken(expectedChannelId, channelToken);
    } catch (error) {
      await safelyRevokeCredential(accessToken);
      console.error(
        `[OAuth] Failed to persist verified authorization for ${expectedChannelId}: ${errorMessage(error)}`
      );
      return Response.json(
        { error: "Authorization could not be stored securely. No token was retained." },
        { status: 503 }
      );
    }

    console.log(
      `[OAuth] Verified and stored encrypted authorization for ${expectedChannelId}`
    );

    let revenueSyncStatus: ChannelRevenueSyncStatus = "failed";
    try {
      revenueSyncStatus = await syncVerifiedChannelRevenue(expectedChannelId, {
        channelTitle,
        subscribers: Number(verifiedChannel.statistics?.subscriberCount || 0),
        views: Number(verifiedChannel.statistics?.viewCount || 0),
        videoCount: Number(verifiedChannel.statistics?.videoCount || 0),
        thumbnail: verifiedChannel.snippet?.thumbnails?.default?.url || "",
      });
    } catch (error) {
      console.warn(
        `[OAuth] Immediate revenue sync failed for ${expectedChannelId}: ${errorMessage(error)}`
      );
    }

    let downstreamSyncStatus: RevenueDownstreamSyncResult = {
      status: "partial",
      vendorSheet: "failed",
      clientSheet: "failed",
    };
    try {
      downstreamSyncStatus = await syncRevenueDownstreamSheets();
    } catch (error) {
      console.warn(
        `[OAuth] Immediate downstream sync failed for ${expectedChannelId}: ${errorMessage(error)}`
      );
    }

    return Response.json({
      data: {
        success: true,
        kvConfigured: isKVConfigured(),
        revenueSyncStatus,
        downstreamSyncStatus,
        channelInfo: {
          channelId: expectedChannelId,
          channelTitle,
          subscribers: Number(verifiedChannel.statistics?.subscriberCount || 0),
          totalViews: Number(verifiedChannel.statistics?.viewCount || 0),
          totalVideos: Number(verifiedChannel.statistics?.videoCount || 0),
          thumbnail: verifiedChannel.snippet?.thumbnails?.default?.url || "",
        },
      },
    });
  } catch (error) {
    console.error(`[OAuth] Exchange failed: ${errorMessage(error)}`);
    return Response.json(
      { error: "Failed to process authorization callback" },
      { status: 500 }
    );
  }
}
