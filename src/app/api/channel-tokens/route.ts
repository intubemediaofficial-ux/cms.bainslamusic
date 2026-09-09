import { randomBytes } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getChannelToken,
  getTokenStatus,
  isKVConfigured,
  revokeChannelAuthorization,
} from "@/lib/channel-tokens";
import { kv } from "@/lib/redis";
import {
  permanentRemoveFromBackend,
  expireAllTokensOnBackend,
  removeChannelFromBackend,
} from "@/lib/backend-sync";
import { clearChannelVendorAssignments } from "@/lib/vendors";
import { sendEmail, getChannelInviteEmailHtml } from "@/lib/email";
import {
  getPublicOrigin,
  type ChannelOAuthState,
} from "@/lib/youtube-oauth";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

function isAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

interface ChannelScopeUser {
  id: string;
  email: string;
  role: "client" | "company";
  parentId?: string;
  channels?: string[];
  pendingChannels?: string[];
  status?: "active" | "inactive" | "pending";
}

async function getAllowedChannelIds(email: string): Promise<Set<string>> {
  const users = (await kv.get<ChannelScopeUser[]>("bainsla_users")) || [];
  const normalizedEmail = email.toLowerCase();
  const currentUser = users.find((user) => user.email.toLowerCase() === normalizedEmail);
  if (!currentUser || currentUser.status === "inactive") return new Set();
  const scopedUsers = currentUser.role === "company"
    ? [currentUser, ...users.filter((user) => user.parentId === currentUser.id && user.status !== "inactive")]
    : [currentUser];
  return new Set(
    scopedUsers.flatMap((user) => [...(user.channels || []), ...(user.pendingChannels || [])])
  );
}

async function removeChannelAssignments(channelId: string): Promise<void> {
  const users = (await kv.get<ChannelScopeUser[]>("bainsla_users")) || [];
  let changed = false;
  for (const user of users) {
    const channels = (user.channels || []).filter((id) => id !== channelId);
    const pendingChannels = (user.pendingChannels || []).filter((id) => id !== channelId);
    if (
      channels.length !== (user.channels || []).length ||
      pendingChannels.length !== (user.pendingChannels || []).length
    ) {
      user.channels = channels;
      user.pendingChannels = pendingChannels;
      changed = true;
    }
  }
  if (changed) await kv.set("bainsla_users", users);
}

async function revokeChannelAccess(channelId: string): Promise<void> {
  await revokeChannelAuthorization(channelId);
}

async function removeChannelFromCms(channelId: string): Promise<void> {
  await revokeChannelAuthorization(channelId);
  const backendResult = await removeChannelFromBackend(channelId);
  if (!backendResult) throw new Error("Backend channel removal failed");

  await clearChannelVendorAssignments([channelId]);
  await removeChannelAssignments(channelId);
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.userStatus === "inactive") {
    return Response.json({ error: "Account is inactive" }, { status: 403 });
  }

  const isAdminUser = session.user.role === "admin" || isAdmin(session.user.email);
  const allowedChannelIds = isAdminUser
    ? null
    : await getAllowedChannelIds(session.user.email);

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const mutationActions = new Set([
    "deleteToken",
    "revokeToken",
    "bulkExpireTokens",
    "removeChannel",
    "permanentRemoveChannel",
  ]);
  if (action && mutationActions.has(action) && request.method !== "DELETE") {
    return Response.json(
      { error: "This action requires DELETE" },
      { status: 405, headers: { Allow: "DELETE" } }
    );
  }

  switch (action) {
    case "generateInviteLink": {
      const channelId = url.searchParams.get("channelId");
      const channelTitle = url.searchParams.get("channelTitle") || "";
      if (!channelId) {
        return Response.json({ error: "channelId required" }, { status: 400 });
      }
      if (!isAdminUser && !allowedChannelIds?.has(channelId)) {
        return Response.json({ error: "You can only validate assigned channels" }, { status: 403 });
      }

      if (!process.env.GOOGLE_CLIENT_ID) {
        return Response.json({ error: "Google Client ID not configured" }, { status: 500 });
      }

      const origin = getPublicOrigin(request);
      const nonce = randomBytes(32).toString("base64url");
      const state = `cms-oauth-${nonce}`;
      const oauthState: ChannelOAuthState = {
        channelId,
        channelTitle,
        createdBy: session.user.email,
        createdAt: new Date().toISOString(),
      };
      await kv.setex(`channel_oauth_state:${nonce}`, 15 * 60, oauthState);

      const oauthUrl = `${origin}/authorize-channel?state=${encodeURIComponent(state)}`;

      return Response.json({
        data: {
          oauthUrl,
          channelId,
          channelTitle,
          state,
        },
      });
    }

    case "tokenStatus": {
      const channelId = url.searchParams.get("channelId");
      if (!channelId) {
        return Response.json({ error: "channelId required" }, { status: 400 });
      }
      if (!isAdminUser && !allowedChannelIds?.has(channelId)) {
        return Response.json({ error: "You can only access tokens for assigned channels" }, { status: 403 });
      }

      const status = await getTokenStatus(channelId);
      const token = await getChannelToken(channelId);
      const channelMismatch = token?.googleChannelId && token.googleChannelId !== channelId;
      return Response.json({
        data: {
          channelId,
          status,
          channelTitle: token?.channelTitle || null,
          updatedAt: token?.updatedAt || null,
          kvConfigured: isKVConfigured(),
          channelMismatch: !!channelMismatch,
          googleChannelId: token?.googleChannelId || null,
        },
      });
    }

    case "bulkTokenStatus": {
      const channelIdsParam = url.searchParams.get("channelIds") || "";
      const channelIds = channelIdsParam.split(",").filter(Boolean);
      if (!isAdminUser && channelIds.some((channelId) => !allowedChannelIds?.has(channelId))) {
        return Response.json({ error: "You can only access tokens for assigned channels" }, { status: 403 });
      }

      const statuses: Record<string, { status: string; channelTitle?: string; updatedAt?: string; channelMismatch?: boolean; googleChannelId?: string }> = {};
      for (const id of channelIds) {
        const status = await getTokenStatus(id);
        const token = await getChannelToken(id);
        statuses[id] = {
          status,
          channelTitle: token?.channelTitle || undefined,
          updatedAt: token?.updatedAt || undefined,
          channelMismatch: !!(token?.googleChannelId && token.googleChannelId !== id),
          googleChannelId: token?.googleChannelId || undefined,
        };
      }

      return Response.json({ data: { statuses, kvConfigured: isKVConfigured() } });
    }

    case "removeChannel": {
      const channelId = url.searchParams.get("channelId");
      if (!channelId) {
        return Response.json({ error: "channelId required" }, { status: 400 });
      }
      if (!isAdminUser && !allowedChannelIds?.has(channelId)) {
        return Response.json({ error: "You can only remove assigned channels" }, { status: 403 });
      }

      try {
        await removeChannelFromCms(channelId);
        return Response.json({ data: { success: true, channelId } });
      } catch (error) {
        console.error(`[removeChannel] Failed for ${channelId}:`, error);
        return Response.json({ error: "Failed to remove channel completely" }, { status: 502 });
      }
    }

    case "deleteToken": {
      // Allow any authenticated user to delete channel tokens
      // (clients delete their own channel tokens on channel remove/delink)
      const channelId = url.searchParams.get("channelId");
      if (!channelId) {
        return Response.json({ error: "channelId required" }, { status: 400 });
      }
      if (!isAdminUser && !allowedChannelIds?.has(channelId)) {
        return Response.json({ error: "You can only remove tokens for assigned channels" }, { status: 403 });
      }

      try {
        const revocation = await revokeChannelAuthorization(channelId);
        return Response.json({ data: { success: true, channelId, revocation } });
      } catch (error) {
        console.error(`[deleteToken] Failed for ${channelId}:`, error);
        return Response.json(
          { error: "Failed to revoke Google access and delete authorized data" },
          { status: 502 }
        );
      }
    }

    case "bulkExpireTokens": {
      if (!isAdminUser) {
        return Response.json({ error: "Admin access required" }, { status: 403 });
      }
      const clientId = url.searchParams.get("clientId");
      const channelIdsParam = url.searchParams.get("channelIds") || "";
      const channelIds = channelIdsParam.split(",").filter(Boolean);

      if (!clientId || channelIds.length === 0) {
        return Response.json({ error: "clientId and channelIds required" }, { status: 400 });
      }

      const results: { channelId: string; success: boolean; error?: string }[] = [];
      for (const cid of channelIds) {
        try {
          await revokeChannelAccess(cid);
          results.push({ channelId: cid, success: true });
        } catch (err) {
          results.push({ channelId: cid, success: false, error: err instanceof Error ? err.message : String(err) });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      console.log(`[bulkExpireTokens] Admin ${session.user.email} expired tokens for client ${clientId}: ${successCount}/${channelIds.length} channels`);

      // Sync to backend
      expireAllTokensOnBackend(clientId, session.user.email || "admin").catch((err) => {
        console.warn("[bulkExpireTokens] Backend sync error:", err);
      });

      return Response.json({
        data: {
          success: true,
          clientId,
          affectedChannels: channelIds,
          results,
          adminEmail: session.user.email,
          actionDate: new Date().toISOString(),
        },
      });
    }

    case "permanentRemoveChannel": {
      if (!isAdminUser) {
        return Response.json({ error: "Admin access required" }, { status: 403 });
      }
      const channelId = url.searchParams.get("channelId");
      if (!channelId) {
        return Response.json({ error: "channelId required" }, { status: 400 });
      }

      const backendResult = await permanentRemoveFromBackend(
        channelId,
        session.user.email || "admin"
      );
      if (!backendResult) {
        return Response.json({ error: "Backend channel removal failed" }, { status: 502 });
      }

      await revokeChannelAuthorization(channelId);
      await clearChannelVendorAssignments([channelId]);
      await removeChannelAssignments(channelId);

      console.log(`[permanentRemoveChannel] Admin ${session.user.email} permanently removed channel ${channelId}`);

      return Response.json({
        data: {
          success: true,
          channelId,
          adminEmail: session.user.email,
          actionDate: new Date().toISOString(),
        },
      });
    }

    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  return GET(request);
}

const MAX_INVITE_RECIPIENTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.userStatus === "inactive") {
    return Response.json({ error: "Account is inactive" }, { status: 403 });
  }

  let body: { action?: unknown; state?: unknown; emails?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "sendInviteEmail") {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  const state = typeof body.state === "string" ? body.state : "";
  if (!state.startsWith("cms-oauth-")) {
    return Response.json({ error: "Invalid authorization link" }, { status: 400 });
  }
  const nonce = state.slice("cms-oauth-".length);
  const oauthState = await kv.get<ChannelOAuthState>(`channel_oauth_state:${nonce}`);
  if (!oauthState) {
    return Response.json(
      { error: "Authorization link expired. Generate a new link and try again." },
      { status: 410 }
    );
  }

  const isAdminUser = session.user.role === "admin" || isAdmin(session.user.email);
  if (!isAdminUser) {
    const allowedChannelIds = await getAllowedChannelIds(session.user.email);
    if (!allowedChannelIds.has(oauthState.channelId)) {
      return Response.json({ error: "You can only invite for assigned channels" }, { status: 403 });
    }
  }

  const emails = Array.from(
    new Set(
      (Array.isArray(body.emails) ? body.emails : [])
        .filter((e): e is string => typeof e === "string")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e))
    )
  );
  if (emails.length === 0) {
    return Response.json({ error: "At least one valid email is required" }, { status: 400 });
  }
  if (emails.length > MAX_INVITE_RECIPIENTS) {
    return Response.json(
      { error: `Maximum ${MAX_INVITE_RECIPIENTS} recipients per invite` },
      { status: 400 }
    );
  }

  const origin = getPublicOrigin(request);
  const authorizeUrl = `${origin}/authorize-channel?state=${encodeURIComponent(state)}`;
  const channelTitle = oauthState.channelTitle || oauthState.channelId;
  const html = getChannelInviteEmailHtml({
    channelTitle,
    channelId: oauthState.channelId,
    authorizeUrl,
    invitedBy: session.user.name || session.user.email,
  });

  const sent: string[] = [];
  const failed: { email: string; error: string }[] = [];
  for (const to of emails) {
    const result = await sendEmail({
      to,
      subject: `Authorize your YouTube channel "${channelTitle}" on Bainsla Music CMS`,
      html,
    });
    if (result.success) sent.push(to);
    else failed.push({ email: to, error: result.error || "Send failed" });
  }

  if (sent.length === 0) {
    return Response.json(
      { error: failed[0]?.error || "Email could not be sent", data: { sent, failed } },
      { status: 502 }
    );
  }

  console.log(
    `[sendInviteEmail] ${session.user.email} invited ${sent.join(", ")} for channel ${oauthState.channelId}`
  );

  return Response.json({ data: { sent, failed } });
}
