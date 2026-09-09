import { randomBytes } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { kv } from "@/lib/redis";
import { getChannelToken, getTokenStatus } from "@/lib/channel-tokens";
import { getChannelStatsByIdPublic } from "@/lib/youtube";
import { sendEmail, getChannelListInviteEmailHtml } from "@/lib/email";
import {
  CHANNEL_INVITE_TTL_SECONDS,
  channelInviteKey,
  channelInvitePath,
  getPublicOrigin,
  type ChannelInviteBatch,
  type ChannelOAuthState,
} from "@/lib/youtube-oauth";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];
const MAX_RECIPIENTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface StoredUser {
  id: string;
  name?: string;
  email: string;
  role: "client" | "company";
  parentId?: string;
  channels?: string[];
  pendingChannels?: string[];
  status?: "active" | "inactive" | "pending";
}

interface InviteChannelRow {
  channelId: string;
  title: string;
  thumbnail: string;
  status: "verified" | "expired" | "pending";
}

function noStoreJson(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: { "Cache-Control": "no-store", ...init?.headers },
  });
}

function clientChannelIds(user: StoredUser): string[] {
  return Array.from(new Set([...(user.channels || []), ...(user.pendingChannels || [])]));
}

async function loadInvite(
  token: string
): Promise<{ key: string; invite: ChannelInviteBatch; client: StoredUser } | null> {
  const key = channelInviteKey(token);
  if (!key) return null;
  const invite = await kv.get<ChannelInviteBatch>(key);
  if (!invite) return null;
  const users = (await kv.get<StoredUser[]>("bainsla_users")) || [];
  const client = users.find((u) => u.id === invite.clientId);
  if (!client || client.status === "inactive") return null;
  return { key, invite, client };
}

async function buildChannelRows(channelIds: string[]): Promise<InviteChannelRow[]> {
  const rows = await Promise.all(
    channelIds.map(async (channelId): Promise<InviteChannelRow> => {
      const [status, token] = await Promise.all([
        getTokenStatus(channelId),
        getChannelToken(channelId),
      ]);
      return {
        channelId,
        title: token?.channelTitle || "",
        thumbnail: "",
        status: status === "valid" ? "verified" : status === "expired" ? "expired" : "pending",
      };
    })
  );

  const missing = rows.filter((r) => !r.title).map((r) => r.channelId);
  if (missing.length > 0) {
    try {
      const items = await getChannelStatsByIdPublic(missing);
      for (const item of items) {
        const id = typeof item.id === "string" ? item.id : "";
        const snippet = item.snippet as
          | { title?: string | null; thumbnails?: { default?: { url?: string | null } } }
          | undefined;
        const row = rows.find((r) => r.channelId === id);
        if (row) {
          row.title = snippet?.title || row.title;
          row.thumbnail = snippet?.thumbnails?.default?.url || "";
        }
      }
    } catch (error) {
      console.warn(
        `[channel-invites] Channel lookup failed: ${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }

  return rows.map((r) => ({ ...r, title: r.title || r.channelId }));
}

// Public: channel owner opens the invite page
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("invite") || "";
  const loaded = await loadInvite(token);
  if (!loaded) {
    return noStoreJson(
      { error: "This link has expired or is invalid. Ask Bainsla Music for a new link." },
      { status: 410 }
    );
  }

  const channels = await buildChannelRows(clientChannelIds(loaded.client));
  return noStoreJson({
    data: {
      clientName: loaded.client.name || loaded.client.email,
      channels,
      verifiedCount: channels.filter((c) => c.status === "verified").length,
    },
  });
}

// Public: channel owner clicks "Authorize" on one channel of the invite
async function startChannelAuthorization(
  request: Request,
  body: { invite?: unknown; channelId?: unknown }
): Promise<Response> {
  const token = typeof body.invite === "string" ? body.invite : "";
  const channelId = typeof body.channelId === "string" ? body.channelId : "";
  const loaded = await loadInvite(token);
  if (!loaded) {
    return noStoreJson(
      { error: "This link has expired or is invalid. Ask Bainsla Music for a new link." },
      { status: 410 }
    );
  }
  if (!channelId || !clientChannelIds(loaded.client).includes(channelId)) {
    return noStoreJson({ error: "This channel is not part of your invite" }, { status: 403 });
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    return noStoreJson({ error: "Google OAuth is not configured" }, { status: 500 });
  }

  const existing = await getChannelToken(channelId);
  const nonce = randomBytes(32).toString("base64url");
  const state = `cms-oauth-${nonce}`;
  const oauthState: ChannelOAuthState = {
    channelId,
    channelTitle: existing?.channelTitle || channelId,
    createdBy: loaded.invite.createdBy,
    createdAt: new Date().toISOString(),
    returnTo: channelInvitePath(token),
  };
  await kv.setex(`channel_oauth_state:${nonce}`, 15 * 60, oauthState);

  return noStoreJson({
    data: { authorizeUrl: `/authorize-channel?state=${encodeURIComponent(state)}` },
  });
}

// Authenticated admin/company: create an invite for a client and email it
async function createInvite(
  request: Request,
  body: { clientId?: unknown; emails?: unknown }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.userStatus === "inactive") {
    return noStoreJson({ error: "Account is inactive" }, { status: 403 });
  }
  const isAdminUser =
    session.user.role === "admin" || ADMIN_EMAILS.includes(session.user.email.toLowerCase());

  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  if (!clientId) {
    return noStoreJson({ error: "clientId required" }, { status: 400 });
  }

  const users = (await kv.get<StoredUser[]>("bainsla_users")) || [];
  const client = users.find((u) => u.id === clientId);
  if (!client || client.status === "inactive") {
    return noStoreJson({ error: "Client not found" }, { status: 404 });
  }
  if (!isAdminUser) {
    const me = users.find((u) => u.email.toLowerCase() === session.user.email!.toLowerCase());
    const ownsClient =
      !!me && (me.id === client.id || (me.role === "company" && client.parentId === me.id));
    if (!ownsClient) {
      return noStoreJson({ error: "You can only invite your own clients" }, { status: 403 });
    }
  }

  const channelIds = clientChannelIds(client);
  if (channelIds.length === 0) {
    return noStoreJson({ error: "This client has no channels to authorize" }, { status: 400 });
  }

  const requested = Array.isArray(body.emails)
    ? body.emails.filter((e): e is string => typeof e === "string")
    : [];
  const emails = Array.from(
    new Set(
      (requested.length > 0 ? requested : [client.email])
        .map((e) => e.trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e))
    )
  );
  if (emails.length === 0) {
    return noStoreJson({ error: "At least one valid email is required" }, { status: 400 });
  }
  if (emails.length > MAX_RECIPIENTS) {
    return noStoreJson({ error: `Maximum ${MAX_RECIPIENTS} recipients` }, { status: 400 });
  }

  const token = randomBytes(32).toString("base64url");
  const invite: ChannelInviteBatch = {
    clientId: client.id,
    clientEmail: client.email,
    createdBy: session.user.email,
    createdAt: new Date().toISOString(),
  };
  await kv.setex(channelInviteKey(token)!, CHANNEL_INVITE_TTL_SECONDS, invite);

  const inviteUrl = `${getPublicOrigin(request)}${channelInvitePath(token)}`;
  const rows = await buildChannelRows(channelIds);
  const html = getChannelListInviteEmailHtml({
    clientName: client.name || client.email,
    channels: rows.map((r) => ({
      channelId: r.channelId,
      title: r.title,
      verified: r.status === "verified",
    })),
    inviteUrl,
    invitedBy: session.user.name || session.user.email,
  });

  const sent: string[] = [];
  const failed: { email: string; error: string }[] = [];
  for (const to of emails) {
    const result = await sendEmail({
      to,
      subject: `Authorize your ${channelIds.length} YouTube channel${channelIds.length === 1 ? "" : "s"} on Bainsla Music CMS`,
      html,
    });
    if (result.success) sent.push(to);
    else failed.push({ email: to, error: result.error || "Send failed" });
  }

  console.log(
    `[channel-invites] ${session.user.email} created invite for client ${client.id} (${channelIds.length} channels); sent=${sent.length} failed=${failed.length}`
  );

  return noStoreJson({
    data: {
      inviteUrl,
      channelCount: channelIds.length,
      pendingCount: rows.filter((r) => r.status !== "verified").length,
      sent,
      failed,
    },
  });
}

export async function POST(request: Request) {
  let body: { action?: unknown; invite?: unknown; channelId?: unknown; clientId?: unknown; emails?: unknown };
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "start") return startChannelAuthorization(request, body);
  if (body.action === "create") return createInvite(request, body);
  return noStoreJson({ error: "Invalid action" }, { status: 400 });
}
