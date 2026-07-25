import { kv } from "@/lib/redis";
import { getServerSession } from "next-auth";
import { after } from "next/server";
import { authOptions } from "@/lib/auth";
import { sendEmail, getWelcomeEmailHtml } from "@/lib/email";
import { addAuditLog } from "@/lib/audit-log";
import { createSystemNotification } from "@/lib/notifications";
import { clearChannelVendorAssignments } from "@/lib/vendors";
import { syncVendorGoogleSheet } from "@/lib/vendor-google-sheets";
import { getAppUrl } from "@/lib/app-url";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const USERS_KEY = "bainsla_users";
const NETWORKS_KEY = "bainsla_networks";

export interface NetworkAssignment {
  networkId: string;
  networkName: string;
  revenueSharePercent: number;
}

interface NetworkRecord {
  id: string;
  name: string;
  revenueSharePercent: number;
}

export interface ChannelNetworkAssignment {
  channelId: string;
  networkId: string;
  networkName: string;
  revenueSharePercent: number;
}

export interface CompanyBranding {
  brandName?: string;
  brandColor?: string;
  brandLogo?: string;
}

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  channels: string[];
  pendingChannels?: string[];
  channelAddedDates?: Record<string, string>;
  status: "active" | "inactive" | "pending";
  joinedDate: string;
  category: string;
  role: "client" | "company";
  parentId?: string;
  networks?: NetworkAssignment[];
  channelNetworks?: ChannelNetworkAssignment[];
  customNetworks?: string[];
  branding?: CompanyBranding;
  whiteLabelEnabled?: boolean;
  revenueSharePercent?: number;
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function normalizeChannelIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((channelId): channelId is string => typeof channelId === "string" && channelId.length > 0))
  );
}

function normalizeNetworkName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function currentChannelDate(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function reconcileChannelAddedDates(user: StoredUser): void {
  const managedChannelIds = new Set([
    ...(user.channels || []),
    ...(user.pendingChannels || []),
  ]);
  const dates = { ...(user.channelAddedDates || {}) };
  for (const channelId of managedChannelIds) {
    dates[channelId] ||= currentChannelDate();
  }
  for (const channelId of Object.keys(dates)) {
    if (!managedChannelIds.has(channelId)) delete dates[channelId];
  }
  user.channelAddedDates = dates;
}

function customNetworkId(email: string, name: string): string {
  return `custom-${crypto
    .createHash("sha256")
    .update(`${email.toLowerCase()}:${normalizeNetworkName(name)}`)
    .digest("hex")}`;
}

async function syncSheetAfterNetworkChange() {
  try {
    return await syncVendorGoogleSheet();
  } catch (error) {
    console.error("[Users] Google Sheets network sync failed:", error);
    return { status: "failed" as const };
  }
}

// Deprecated network names to auto-remove from user assignments
const DEPRECATED_NETWORK_NAMES = ["T-Series", "Sony Music", "InTubeMedia", "Other"];

async function getUsers(): Promise<StoredUser[]> {
  try {
    const users = await kv.get<StoredUser[]>(USERS_KEY);
    if (!users) return [];
    // Auto-cleanup: remove deprecated network names from user assignments
    let cleaned = false;
    for (const u of users) {
      if (u.networks?.length) {
        const before = u.networks.length;
        u.networks = u.networks.filter((n) => !DEPRECATED_NETWORK_NAMES.includes(n.networkName));
        if (u.networks.length !== before) cleaned = true;
      }
      if (u.channelNetworks?.length) {
        const before = u.channelNetworks.length;
        u.channelNetworks = u.channelNetworks.filter((cn) => !DEPRECATED_NETWORK_NAMES.includes(cn.networkName));
        if (u.channelNetworks.length !== before) cleaned = true;
      }
      if (u.customNetworks?.length) {
        const before = u.customNetworks.length;
        u.customNetworks = u.customNetworks.filter((cn) => !DEPRECATED_NETWORK_NAMES.includes(cn));
        if (u.customNetworks.length !== before) cleaned = true;
      }
    }

    const channelOwners = new Map<string, string>();
    for (const user of users) {
      const seenApproved = new Set<string>();
      user.channels = user.channels.filter((channelId) => {
        const ownerId = channelOwners.get(channelId);
        if (seenApproved.has(channelId) || (ownerId && ownerId !== user.id)) {
          cleaned = true;
          return false;
        }
        seenApproved.add(channelId);
        channelOwners.set(channelId, user.id);
        return true;
      });

      if (user.pendingChannels?.length) {
        const seenPending = new Set<string>();
        user.pendingChannels = user.pendingChannels.filter((channelId) => {
          const ownerId = channelOwners.get(channelId);
          if (
            seenApproved.has(channelId) ||
            seenPending.has(channelId) ||
            (ownerId && ownerId !== user.id)
          ) {
            cleaned = true;
            return false;
          }
          seenPending.add(channelId);
          channelOwners.set(channelId, user.id);
          return true;
        });
      }
    }
    if (cleaned) {
      await kv.set(USERS_KEY, users);
    }
    return users;
  } catch (error) {
    console.error("[Users] Failed to read from KV:", error);
    throw new Error(`KV read failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function saveUsers(users: StoredUser[]): Promise<boolean> {
  try {
    await kv.set(USERS_KEY, users);
    return true;
  } catch (error) {
    console.error("[Users] Failed to save to KV:", error);
    return false;
  }
}

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  return ADMIN_EMAILS.includes(session.user.email.toLowerCase());
}

async function isCompany(): Promise<{ isCompany: boolean; companyUser?: StoredUser }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { isCompany: false };
  const email = session.user.email.toLowerCase();
  if (ADMIN_EMAILS.includes(email)) return { isCompany: false };
  try {
    const users = await getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email && u.role === "company" && u.status === "active");
    if (user) return { isCompany: true, companyUser: user };
  } catch { /* ignore */ }
  return { isCompany: false };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.userStatus === "inactive") {
    return Response.json({ error: "Account is inactive" }, { status: 403 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  // Non-admin: return only own user info (for fetching assigned networks etc.)
  if (action === "me") {
    try {
      const users = await getUsers();
      const me = users.find((u) => u.email.toLowerCase() === session.user!.email!.toLowerCase());
      if (!me) return Response.json({ data: null });
      const { password, ...safe } = me;
      return Response.json({ data: safe });
    } catch (error) {
      console.error("[Users GET me] Error:", error);
      return Response.json({ error: "Storage error", kvError: true, details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  }

  if (action === "branding") {
    try {
      const users = await getUsers();
      const me = users.find((u) => u.email.toLowerCase() === session.user!.email!.toLowerCase());
      if (!me) return Response.json({ data: null });

      if (me.whiteLabelEnabled && me.branding) {
        return Response.json({ data: me.branding });
      }

      if (me.parentId) {
        const parent = users.find((u) => u.id === me.parentId);
        if (parent?.whiteLabelEnabled && parent.branding) {
          return Response.json({ data: parent.branding });
        }
      }

      return Response.json({ data: null });
    } catch (error) {
      console.error("[Users GET branding] Error:", error);
      return Response.json({ error: "Storage error", kvError: true }, { status: 500 });
    }
  }

  if (action === "channelScope") {
    try {
      const users = await getUsers();
      const email = session.user.email.toLowerCase();
      const admin = ADMIN_EMAILS.includes(email);
      const me = users.find((user) => user.email.toLowerCase() === email);

      if (!admin && !me) return Response.json({ data: { channelIds: [] } });

      const scopedUsers = admin
        ? users
        : me?.role === "company"
          ? [me, ...users.filter((user) => user.parentId === me.id && user.status !== "inactive")]
          : me
            ? [me]
            : [];
      const channelIds = Array.from(new Set(scopedUsers.flatMap((user) => user.channels || [])));
      const channelAddedDates = Object.fromEntries(
        scopedUsers.flatMap((user) => Object.entries(user.channelAddedDates || {}))
      );
      return Response.json({ data: { channelIds, channelAddedDates } });
    } catch (error) {
      console.error("[Users GET channelScope] Error:", error);
      return Response.json({ error: "Storage error", kvError: true }, { status: 500 });
    }
  }

  // Company: return only their own clients
  if (action === "myClients") {
    const { isCompany: isComp, companyUser } = await isCompany();
    if (!isComp || !companyUser) {
      return Response.json({ error: "Unauthorized — company access only" }, { status: 401 });
    }
    try {
      const users = await getUsers();
      const myClients = users.filter((u) => u.parentId === companyUser.id);
      const safeClients = myClients.map(({ password, ...u }) => u);
      return Response.json({ data: safeClients });
    } catch (error) {
      console.error("[Users GET myClients] Error:", error);
      return Response.json({ error: "Storage error", kvError: true }, { status: 500 });
    }
  }

  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await getUsers();
    const safeUsers = users.map(({ password, ...u }) => u);
    return Response.json({ data: safeUsers });
  } catch (error) {
    console.error("[Users GET] Error:", error);
    return Response.json({ error: "Failed to fetch users from storage", kvError: true, details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await isAdmin();
  const { isCompany: isComp, companyUser } = admin ? { isCompany: false, companyUser: undefined } : await isCompany();

  if (!admin && !isComp) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, email, password, phone, channels, category, networks, channelNetworks } = body;

    if (!name || !email || !password) {
      return Response.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    const users = await getUsers();
    const exists = users.some(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (exists) {
      return Response.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    const requestedChannels = normalizeChannelIds(channels);
    const assignedChannels = new Set(
      users.flatMap((user) => [...(user.channels || []), ...(user.pendingChannels || [])])
    );
    const conflictingChannel = requestedChannels.find((channelId) => assignedChannels.has(channelId));
    if (conflictingChannel) {
      return Response.json(
        { error: `Channel ${conflictingChannel} is already assigned to another account` },
        { status: 409 }
      );
    }

    // Determine role: admin can create companies, companies create clients
    let newRole: "client" | "company" = "client";
    let parentId: string | undefined;
    if (admin && body.role === "company") {
      newRole = "company";
    } else if (isComp && companyUser) {
      newRole = "client";
      parentId = companyUser.id;
    }

    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashPassword(password),
      phone: phone?.trim() || "",
      channels: requestedChannels,
      channelAddedDates: Object.fromEntries(
        requestedChannels.map((channelId) => [channelId, currentChannelDate()])
      ),
      status: "active",
      joinedDate: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      category: category || "Music",
      role: newRole,
      networks: networks || [],
      channelNetworks: channelNetworks || [],
      ...(parentId ? { parentId } : {}),
      ...(body.whiteLabelEnabled ? { whiteLabelEnabled: true } : {}),
      ...(body.revenueSharePercent ? { revenueSharePercent: Number(body.revenueSharePercent) } : {}),
    };

    users.push(newUser);
    const saved = await saveUsers(users);
    if (!saved) {
      return Response.json(
        { error: "Failed to save user" },
        { status: 500 }
      );
    }

    // Send welcome email (non-blocking — don't fail user creation if email fails)
    const creatorName = isComp && companyUser ? companyUser.name : "InTubeMedia Admin";
    sendEmail({
      to: newUser.email,
      subject: `Welcome to InTubeMedia — Your ${newRole === "company" ? "Company" : "Client"} Account`,
      html: getWelcomeEmailHtml({
        name: newUser.name,
        email: newUser.email,
        password: password,
        role: newRole,
        createdBy: creatorName,
      }),
    }).then((result) => {
      if (result.success) {
        console.log(`[Users] Welcome email sent to ${newUser.email}`);
      } else {
        console.error(`[Users] Failed to send welcome email to ${newUser.email}:`, result.error);
      }
    }).catch((err) => {
      console.error(`[Users] Welcome email error for ${newUser.email}:`, err);
    });

    const session = await getServerSession(authOptions);
    addAuditLog({
      action: "user_created",
      performedBy: session?.user?.email || "unknown",
      performedByRole: admin ? "admin" : "company",
      targetUser: newUser.name,
      targetEmail: newUser.email,
      details: `Created ${newRole} user "${newUser.name}" (${newUser.email})`,
    }).catch(() => {});

    createSystemNotification(
      newUser.id,
      newUser.email,
      "welcome",
      "Welcome to InTubeMedia!",
      `Your ${newRole} account has been created. Login at ${new URL(getAppUrl()).host} with your email.`
    ).catch(() => {});

    const { password: _, ...safeUser } = newUser;
    return Response.json({ data: safeUser }, { status: 201 });
  } catch (error) {
    console.error("[Users] Error creating user:", error);
    return Response.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const admin = await isAdmin();
  const { isCompany: isComp, companyUser } = admin ? { isCompany: false, companyUser: undefined } : await isCompany();
  const putSession = await getServerSession(authOptions);
  if (!admin && putSession?.user?.userStatus === "inactive") {
    return Response.json({ error: "Account is inactive" }, { status: 403 });
  }
  const isSelfUpdate = !admin && !isComp && !!putSession?.user?.email;
  if (!admin && !isComp && !isSelfUpdate) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, email, password, phone, channels, category, status, networks, channelNetworks } = body;

    if (body.type === "assign_channel_network") {
      if (!admin && !isComp) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const userId = typeof body.userId === "string" ? body.userId : "";
      const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
      const networkName = typeof body.networkName === "string" ? body.networkName.trim() : "";
      if (!userId || !channelId) {
        return Response.json({ error: "userId and channelId required" }, { status: 400 });
      }

      const users = await getUsers();
      const userIdx = users.findIndex((user) => user.id === userId);
      if (userIdx === -1) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }
      if (isComp && companyUser && users[userIdx].parentId !== companyUser.id) {
        return Response.json({ error: "You can only manage networks for your own clients" }, { status: 403 });
      }
      const managedChannelIds = new Set([
        ...(users[userIdx].channels || []),
        ...(users[userIdx].pendingChannels || []),
      ]);
      if (!managedChannelIds.has(channelId)) {
        return Response.json({ error: "Channel is not assigned to this user" }, { status: 400 });
      }

      let nextAssignment: ChannelNetworkAssignment | null = null;
      if (networkName) {
        const availableNetworks = (await kv.get<NetworkRecord[]>(NETWORKS_KEY)) || [];
        const network = availableNetworks.find(
          (item) => normalizeNetworkName(item.name) === normalizeNetworkName(networkName)
        );
        if (!network) {
          return Response.json({ error: "Network not found" }, { status: 404 });
        }
        nextAssignment = {
          channelId,
          networkId: network.id,
          networkName: network.name,
          revenueSharePercent: network.revenueSharePercent || 0,
        };
      }

      users[userIdx].channelNetworks = (users[userIdx].channelNetworks || []).filter(
        (assignment) => assignment.channelId !== channelId
      );
      if (nextAssignment) users[userIdx].channelNetworks.push(nextAssignment);

      const saved = await saveUsers(users);
      if (!saved) {
        return Response.json({ error: "Failed to save network assignment" }, { status: 500 });
      }
      after(syncSheetAfterNetworkChange);
      addAuditLog({
        action: "channel_network_assigned",
        performedBy: putSession?.user?.email || "unknown",
        performedByRole: admin ? "admin" : "company",
        targetUser: users[userIdx].name,
        targetEmail: users[userIdx].email,
        details: `${networkName ? `Assigned network "${nextAssignment?.networkName}" to` : "Removed network from"} channel ${channelId}`,
      }).catch(() => {});
      return Response.json({
        data: {
          channelId,
          network: nextAssignment,
          user: users[userIdx].name,
        },
      });
    }

    // Approve, reject, or unapprove a channel
    if (body.type === "approve_channel" || body.type === "reject_channel" || body.type === "unapprove_channel") {
      const { userId, channelId } = body;
      if (!userId || !channelId) {
        return Response.json({ error: "userId and channelId required" }, { status: 400 });
      }
      const users = await getUsers();
      const userIdx = users.findIndex((u) => u.id === userId);
      if (userIdx === -1) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }
      if (isComp && companyUser && users[userIdx].parentId !== companyUser.id) {
        return Response.json({ error: "You can only manage channels for your own clients" }, { status: 403 });
      }

      if (body.type === "approve_channel") {
        const channelOwner = users.find(
          (user) =>
            user.id !== users[userIdx].id &&
            ([...(user.channels || []), ...(user.pendingChannels || [])]).includes(channelId)
        );
        if (channelOwner) {
          return Response.json(
            { error: `Channel ${channelId} is already assigned to another account` },
            { status: 409 }
          );
        }
      }

      if (body.type === "unapprove_channel") {
        // Move from channels to pendingChannels
        users[userIdx].channels = users[userIdx].channels.filter((c) => c !== channelId);
        if (!users[userIdx].pendingChannels) users[userIdx].pendingChannels = [];
        if (!users[userIdx].pendingChannels.includes(channelId)) {
          users[userIdx].pendingChannels.push(channelId);
        }
        users[userIdx].channelAddedDates ||= {};
        users[userIdx].channelAddedDates[channelId] ||= currentChannelDate();
      } else {
        // Remove from pendingChannels
        users[userIdx].pendingChannels = (users[userIdx].pendingChannels || []).filter((c) => c !== channelId);
        // If approving, add to channels
        if (body.type === "approve_channel") {
          if (!users[userIdx].channels.includes(channelId)) {
            users[userIdx].channels.push(channelId);
          }
          users[userIdx].channelAddedDates ||= {};
          users[userIdx].channelAddedDates[channelId] ||= currentChannelDate();
        } else if (users[userIdx].channelAddedDates) {
          delete users[userIdx].channelAddedDates[channelId];
        }
      }
      const saved = await saveUsers(users);
      if (!saved) return Response.json({ error: "Failed to update" }, { status: 500 });
      if (body.type === "reject_channel") {
        await clearChannelVendorAssignments([channelId]);
      }
      const session = await getServerSession(authOptions);
      addAuditLog({
        action: `channel_${body.type}`,
        performedBy: session?.user?.email || "unknown",
        performedByRole: admin ? "admin" : "company",
        targetUser: users[userIdx].name,
        targetEmail: users[userIdx].email,
        details: `${body.type.replace("_", " ")} channel ${channelId} for "${users[userIdx].name}"`,
      }).catch(() => {});
      return Response.json({ data: { success: true, action: body.type, channelId, user: users[userIdx].name } });
    }

    // Channel transfer between users
    if (body.type === "transfer_channel") {
      const { fromUserId, toUserId, channelId } = body;
      if (!fromUserId || !toUserId || !channelId) {
        return Response.json({ error: "fromUserId, toUserId, channelId required" }, { status: 400 });
      }
      const users = await getUsers();
      const fromIdx = users.findIndex((u) => u.id === fromUserId);
      const toIdx = users.findIndex((u) => u.id === toUserId);
      if (fromIdx === -1 || toIdx === -1) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }
      if (
        isComp &&
        companyUser &&
        (users[fromIdx].parentId !== companyUser.id || users[toIdx].parentId !== companyUser.id)
      ) {
        return Response.json({ error: "You can only transfer channels between your own clients" }, { status: 403 });
      }
      users[fromIdx].channels = users[fromIdx].channels.filter((c) => c !== channelId);
      if (users[fromIdx].channelAddedDates) delete users[fromIdx].channelAddedDates[channelId];
      if (users[fromIdx].channelNetworks) {
        users[fromIdx].channelNetworks = users[fromIdx].channelNetworks!.filter((cn) => cn.channelId !== channelId);
      }
      if (!users[toIdx].channels.includes(channelId)) {
        users[toIdx].channels.push(channelId);
      }
      users[toIdx].channelAddedDates ||= {};
      users[toIdx].channelAddedDates[channelId] = currentChannelDate();
      const saved = await saveUsers(users);
      if (!saved) return Response.json({ error: "Failed to transfer" }, { status: 500 });
      await clearChannelVendorAssignments([channelId]);
      const session = await getServerSession(authOptions);
      addAuditLog({
        action: "channel_transfer",
        performedBy: session?.user?.email || "unknown",
        performedByRole: admin ? "admin" : "company",
        targetUser: users[fromIdx].name,
        targetEmail: users[fromIdx].email,
        details: `Transferred channel ${channelId} from "${users[fromIdx].name}" to "${users[toIdx].name}"`,
      }).catch(() => {});
      return Response.json({ data: { success: true, fromUser: users[fromIdx].name, toUser: users[toIdx].name, channelId } });
    }

    if (!id) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    const users = await getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (isComp && companyUser && users[idx].id === companyUser.id) {
      if (body.branding !== undefined) users[idx].branding = body.branding;
      if (body.revenueSharePercent !== undefined) users[idx].revenueSharePercent = body.revenueSharePercent;
      if (Array.isArray(body.customNetworks)) {
        users[idx].customNetworks = body.customNetworks.filter((n: unknown) => typeof n === "string" && (n as string).trim().length > 0).map((n: unknown) => (n as string).trim());
      }
      const saved = await saveUsers(users);
      if (!saved) return Response.json({ error: "Failed to save company settings" }, { status: 500 });
      const { password: _, ...safe } = users[idx];
      return Response.json({ data: safe });
    }

    // Self-update: client can only update their own limited fields
    if (isSelfUpdate && !admin && !isComp) {
      if (users[idx].email.toLowerCase() !== putSession!.user!.email!.toLowerCase()) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (body.branding !== undefined) users[idx].branding = body.branding;
      if (body.revenueSharePercent !== undefined) users[idx].revenueSharePercent = body.revenueSharePercent;
      if (Array.isArray(body.customNetworks)) {
        users[idx].customNetworks = body.customNetworks.filter((n: unknown) => typeof n === "string" && (n as string).trim().length > 0).map((n: unknown) => (n as string).trim());
      }
      const saved = await saveUsers(users);
      if (!saved) return Response.json({ error: "Failed to save" }, { status: 500 });
      const { password: _, ...safe } = users[idx];
      return Response.json({ data: safe });
    }

    if (isComp && companyUser && users[idx].parentId !== companyUser.id) {
      return Response.json({ error: "You can only update your own clients" }, { status: 403 });
    }

    const requestedChannels = Array.isArray(channels) ? normalizeChannelIds(channels) : null;
    const previousApprovedChannels = new Set(users[idx].channels || []);
    const requestedPendingChannels = Array.isArray(body.pendingChannels)
      ? normalizeChannelIds(body.pendingChannels)
      : null;
    const channelsOwnedByOthers = new Set(
      users
        .filter((user) => user.id !== id)
        .flatMap((user) => [...(user.channels || []), ...(user.pendingChannels || [])])
    );
    const conflictingChannel = [...(requestedChannels || []), ...(requestedPendingChannels || [])]
      .find((channelId) => channelsOwnedByOthers.has(channelId));
    if (conflictingChannel) {
      return Response.json(
        { error: `Channel ${conflictingChannel} is already assigned to another account` },
        { status: 409 }
      );
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const emailInUse = users.some(
        (user) => user.id !== id && user.email.toLowerCase() === normalizedEmail
      );
      if (emailInUse) {
        return Response.json({ error: "User with this email already exists" }, { status: 409 });
      }
      users[idx].email = normalizedEmail;
    }
    if (name) users[idx].name = name.trim();
    if (password) users[idx].password = hashPassword(password);
    if (phone !== undefined) users[idx].phone = (phone || "").trim();
    if (requestedChannels) {
      users[idx].channels = requestedChannels;
      const approved = new Set(requestedChannels);
      users[idx].pendingChannels = (users[idx].pendingChannels || []).filter((channelId) => !approved.has(channelId));
    }
    if (requestedPendingChannels) {
      const approved = new Set(users[idx].channels);
      users[idx].pendingChannels = requestedPendingChannels.filter((channelId) => !approved.has(channelId));
    }
    if (requestedChannels || requestedPendingChannels) reconcileChannelAddedDates(users[idx]);
    if (category) users[idx].category = category;
    if (status) users[idx].status = status;
    if (networks !== undefined) users[idx].networks = networks;
    if (channelNetworks !== undefined) users[idx].channelNetworks = channelNetworks;
    if (body.branding !== undefined) users[idx].branding = body.branding;
    if (body.whiteLabelEnabled !== undefined) users[idx].whiteLabelEnabled = body.whiteLabelEnabled;
    if (body.revenueSharePercent !== undefined) users[idx].revenueSharePercent = body.revenueSharePercent;
    if (Array.isArray(body.customNetworks)) {
      users[idx].customNetworks = body.customNetworks.filter((n: unknown) => typeof n === "string" && (n as string).trim().length > 0).map((n: unknown) => (n as string).trim());
    }
    // Only admin can change role. A company with child clients must keep its hierarchy.
    if (admin && body.role && (body.role === "client" || body.role === "company")) {
      if (
        users[idx].role === "company" &&
        body.role === "client" &&
        users.some((user) => user.parentId === users[idx].id)
      ) {
        return Response.json(
          { error: "Reassign or delete this company's child clients before changing its role" },
          { status: 409 }
        );
      }
      users[idx].role = body.role;
    }

    const saved = await saveUsers(users);
    if (!saved) {
      return Response.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }
    if (requestedChannels) {
      const currentChannels = new Set(users[idx].channels);
      await clearChannelVendorAssignments(
        Array.from(previousApprovedChannels).filter((channelId) => !currentChannels.has(channelId))
      );
    }

    const changes: string[] = [];
    if (name) changes.push(`name→"${name.trim()}"`);
    if (email) changes.push(`email→"${email}"`);
    if (password) changes.push("password changed");
    if (status) changes.push(`status→${status}`);
    if (channels) changes.push(`channels updated (${channels.length})`);
    if (body.role) changes.push(`role→${body.role}`);
    const session = await getServerSession(authOptions);
    addAuditLog({
      action: status ? "user_status_changed" : password ? "user_password_changed" : "user_updated",
      performedBy: session?.user?.email || "unknown",
      performedByRole: admin ? "admin" : "company",
      targetUser: users[idx].name,
      targetEmail: users[idx].email,
      details: `Updated "${users[idx].name}": ${changes.join(", ")}`,
    }).catch(() => {});

    if (channelNetworks !== undefined) after(syncSheetAfterNetworkChange);
    const { password: _, ...safeUser } = users[idx];
    return Response.json({ data: safeUser });
  } catch (error) {
    console.error("[Users] Error updating user:", error);
    return Response.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// PATCH: Allow logged-in client to sync their localStorage channels to KV
// New channels go to pendingChannels (require admin approval)
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.userStatus === "inactive") {
    return Response.json({ error: "Account is inactive" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      channels,
      pendingChannels,
      removeChannels,
      customNetworks,
      channelNetworks,
      channelAddedDates,
    } = body;

    const hasChannelAddedDates =
      channelAddedDates &&
      typeof channelAddedDates === "object" &&
      !Array.isArray(channelAddedDates);
    if (!Array.isArray(channels) && !Array.isArray(pendingChannels) && !Array.isArray(removeChannels) && !Array.isArray(customNetworks) && !Array.isArray(channelNetworks) && !hasChannelAddedDates) {
      return Response.json({ error: "channels, pendingChannels, removeChannels, customNetworks, channelNetworks, or channelAddedDates required" }, { status: 400 });
    }

    const users = await getUsers();
    const userEmail = session.user.email.toLowerCase();
    const idx = users.findIndex((u) => u.email.toLowerCase() === userEmail);

    if (idx === -1) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    const previousManagedChannels = new Set([
      ...(users[idx].channels || []),
      ...(users[idx].pendingChannels || []),
    ]);

    // Remove channels from both approved and pending lists
    const removedChannelIds = Array.isArray(removeChannels)
      ? removeChannels.filter((c: unknown): c is string => typeof c === "string" && c.length > 0)
      : [];
    if (removedChannelIds.length > 0) {
      const removeSet = new Set(removedChannelIds);
      users[idx].channels = users[idx].channels.filter((ch) => !removeSet.has(ch));
      if (users[idx].pendingChannels) {
        users[idx].pendingChannels = users[idx].pendingChannels!.filter((ch) => !removeSet.has(ch));
      }
    }

    const channelsOwnedByOthers = new Set(
      users
        .filter((user) => user.id !== users[idx].id)
        .flatMap((user) => [...(user.channels || []), ...(user.pendingChannels || [])])
    );
    const rejectedChannels = new Set<string>();

    // Approved assignments are controlled by Admin/Company approval, never by browser state.
    if (Array.isArray(channels)) {
      const requestedApproved = new Set(
        channels.filter(
          (channelId: unknown): channelId is string =>
            typeof channelId === "string" && channelId.length > 0
        )
      );
      users[idx].channels = users[idx].channels.filter((channelId) => requestedApproved.has(channelId));
    }

    if (Array.isArray(pendingChannels)) {
      const approved = new Set(users[idx].channels);
      const validPending = pendingChannels.filter(
        (channelId: unknown): channelId is string =>
          typeof channelId === "string" && channelId.length > 0 && !approved.has(channelId)
      );
      users[idx].pendingChannels = Array.from(
        new Set(
          validPending.filter((channelId) => {
            if (channelsOwnedByOthers.has(channelId)) {
              rejectedChannels.add(channelId);
              return false;
            }
            return true;
          })
        )
      );
    }

    if (hasChannelAddedDates) {
      users[idx].channelAddedDates ||= {};
      const managedChannelIds = new Set([
        ...(users[idx].channels || []),
        ...(users[idx].pendingChannels || []),
      ]);
      for (const [channelId, date] of Object.entries(channelAddedDates)) {
        if (
          managedChannelIds.has(channelId) &&
          typeof date === "string" &&
          date.trim() &&
          !users[idx].channelAddedDates[channelId]
        ) {
          users[idx].channelAddedDates[channelId] = date.trim();
        }
      }
    }
    if (
      Array.isArray(channels) ||
      Array.isArray(pendingChannels) ||
      Array.isArray(removeChannels) ||
      hasChannelAddedDates
    ) {
      reconcileChannelAddedDates(users[idx]);
    }

    // Save custom network names
    if (Array.isArray(customNetworks)) {
      const validNetworks = customNetworks.filter((n: unknown) => typeof n === "string" && (n as string).trim().length > 0).map((n: unknown) => (n as string).trim());
      users[idx].customNetworks = [...new Set(validNetworks)];
    }

    if (Array.isArray(channelNetworks)) {
      const availableNetworks = (await kv.get<NetworkRecord[]>(NETWORKS_KEY)) || [];
      const networkByName = new Map(
        availableNetworks.map((network) => [normalizeNetworkName(network.name), network])
      );
      const customNames = new Set(
        (users[idx].customNetworks || []).map((name) => normalizeNetworkName(name))
      );
      const managedChannelIds = new Set([
        ...(users[idx].channels || []),
        ...(users[idx].pendingChannels || []),
      ]);
      const validAssignments: ChannelNetworkAssignment[] = channelNetworks.flatMap((assignment: unknown) => {
        if (!assignment || typeof assignment !== "object") return [];
        const value = assignment as Partial<ChannelNetworkAssignment>;
        if (
          typeof value.channelId !== "string" ||
          !managedChannelIds.has(value.channelId) ||
          typeof value.networkId !== "string" ||
          typeof value.networkName !== "string" ||
          !value.networkName.trim()
        ) {
          return [];
        }
        const networkName = value.networkName.trim();
        const knownNetwork = networkByName.get(normalizeNetworkName(networkName));
        const isCustom = customNames.has(normalizeNetworkName(networkName));
        return [{
          channelId: value.channelId,
          networkId: knownNetwork?.id || (isCustom ? customNetworkId(users[idx].email, networkName) : value.networkId),
          networkName,
          revenueSharePercent:
            typeof value.revenueSharePercent === "number"
              ? Math.min(100, Math.max(0, value.revenueSharePercent))
              : knownNetwork?.revenueSharePercent || 0,
        }];
      });
      users[idx].channelNetworks = [
        ...(users[idx].channelNetworks || []).filter(
          (assignment) => !managedChannelIds.has(assignment.channelId)
        ),
        ...validAssignments,
      ];
    }

    const saved = await saveUsers(users);
    if (!saved) {
      return Response.json({ error: "Failed to sync channels" }, { status: 500 });
    }
    const currentManagedChannels = new Set([
      ...(users[idx].channels || []),
      ...(users[idx].pendingChannels || []),
    ]);
    await clearChannelVendorAssignments([
      ...removedChannelIds,
      ...Array.from(previousManagedChannels).filter(
        (channelId) => !currentManagedChannels.has(channelId)
      ),
    ]);

    if (Array.isArray(channelNetworks)) after(syncSheetAfterNetworkChange);
    return Response.json({
      data: {
        success: true,
        channels: users[idx].channels,
        pendingChannels: users[idx].pendingChannels || [],
        customNetworks: users[idx].customNetworks || [],
        channelNetworks: users[idx].channelNetworks || [],
        channelAddedDates: users[idx].channelAddedDates || {},
        rejectedChannels: Array.from(rejectedChannels),
      },
    });
  } catch (error) {
    console.error("[Users] Error syncing channels:", error);
    return Response.json({ error: "Failed to sync channels" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = await isAdmin();
  const { isCompany: isComp, companyUser } = admin ? { isCompany: false, companyUser: undefined } : await isCompany();
  if (!admin && !isComp) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    const users = await getUsers();

    // Company can only delete their own clients
    if (isComp && companyUser) {
      const target = users.find((u) => u.id === id);
      if (!target || target.parentId !== companyUser.id) {
        return Response.json({ error: "You can only delete your own clients" }, { status: 403 });
      }
    }

    const deletedUser = users.find((u) => u.id === id);
    if (admin && deletedUser?.role === "company") {
      const childCount = users.filter((user) => user.parentId === deletedUser.id).length;
      if (childCount > 0) {
        return Response.json(
          {
            error: `This company has ${childCount} client account${childCount === 1 ? "" : "s"}. Reassign or delete those clients before deleting the company.`,
          },
          { status: 409 }
        );
      }
    }
    const filtered = users.filter((u) => u.id !== id);

    if (filtered.length === users.length) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const saved = await saveUsers(filtered);
    if (!saved) {
      return Response.json(
        { error: "Failed to delete user" },
        { status: 500 }
      );
    }
    await clearChannelVendorAssignments([
      ...(deletedUser?.channels || []),
      ...(deletedUser?.pendingChannels || []),
    ]);

    const session = await getServerSession(authOptions);
    addAuditLog({
      action: "user_deleted",
      performedBy: session?.user?.email || "unknown",
      performedByRole: admin ? "admin" : "company",
      targetUser: deletedUser?.name || id,
      targetEmail: deletedUser?.email || "",
      details: `Deleted user "${deletedUser?.name || id}" (${deletedUser?.email || ""})`,
    }).catch(() => {});

    return Response.json({ data: { success: true } });
  } catch (error) {
    console.error("[Users] Error deleting user:", error);
    return Response.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
