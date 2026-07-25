import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { kv } from "@/lib/redis";
import {
  cacheClientData,
  getCachedClientData,
  getAllCachedClientData,
  restoreCachedClientDataBackup,
  removeChannelFromAllCaches,
  saveBankDetails,
  getBankDetails,
  saveAgreements,
  getAgreements,
  setGlobalWarning,
  getGlobalWarning,
  setClientWarning,
  getClientWarning,
  getSupportRequests,
  addSupportRequest,
  resolveSupportRequest,
  getAdminSettings,
  setAdminSettings,
} from "@/lib/client-data-cache";
import type { CachedClientData, BankDetails, Agreement, AdminWarning, SupportRequest, AdminSettings } from "@/lib/client-data-cache";

export const dynamic = "force-dynamic";

const USERS_KEY = "bainsla_users";

interface StoredUserBasic {
  id: string;
  email: string;
  role: "admin" | "client" | "company";
  parentId?: string;
  channels?: string[];
}

async function getCompanyClientIds(companyEmail: string): Promise<string[]> {
  try {
    const users = (await kv.get<StoredUserBasic[]>(USERS_KEY)) || [];
    const company = users.find((u) => u.email.toLowerCase() === companyEmail.toLowerCase() && u.role === "company");
    if (!company) return [];
    return users.filter((u) => u.parentId === company.id).map((u) => u.id);
  } catch { return []; }
}

async function getCompanyClientEmails(companyEmail: string): Promise<string[]> {
  try {
    const users = (await kv.get<StoredUserBasic[]>(USERS_KEY)) || [];
    const company = users.find((u) => u.email.toLowerCase() === companyEmail.toLowerCase() && u.role === "company");
    if (!company) return [];
    return users.filter((u) => u.parentId === company.id).map((u) => u.email.toLowerCase());
  } catch { return []; }
}

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

function findStoredUser(users: StoredUserBasic[], identifier: string): StoredUserBasic | undefined {
  const normalized = identifier.toLowerCase();
  return users.find(
    (user) => user.id === identifier || user.email.toLowerCase() === normalized
  );
}

function sanitizeCachedData(
  data: CachedClientData,
  user: StoredUserBasic
): CachedClientData {
  const approvedChannels = new Set(user.channels || []);
  const channels = (data.channels || []).filter((channel) =>
    approvedChannels.has(channel.channelId)
  );

  return {
    ...data,
    email: user.email,
    channels,
    totalRevenue: channels.reduce(
      (total, channel) => total + (channel.estimatedRevenue || 0),
      0
    ),
    totalViews: channels.reduce(
      (total, channel) => total + (channel.views || 0),
      0
    ),
    totalSubscribers: channels.reduce(
      (total, channel) => total + (channel.subscribers || 0),
      0
    ),
  };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user?.userStatus === "inactive") {
    return Response.json({ error: "Account is inactive" }, { status: 403 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const userId = url.searchParams.get("userId");
  const isAdmin = ADMIN_EMAILS.includes(session.user?.email?.toLowerCase() || "");

  switch (action) {
    case "getAllCachedData": {
      const isCompanyUser = session.user?.role === "company";
      if (!isAdmin && !isCompanyUser) {
        return Response.json({ error: "Admin or Company only" }, { status: 403 });
      }

      const [data, users] = await Promise.all([
        getAllCachedClientData(),
        kv.get<StoredUserBasic[]>(USERS_KEY).then((stored) => stored || []),
      ]);
      const company = isCompanyUser && !isAdmin
        ? users.find(
            (user) =>
              user.email.toLowerCase() === session.user?.email?.toLowerCase() &&
              user.role === "company"
          )
        : undefined;
      const allowedUsers = isAdmin
        ? users
        : company
          ? [company, ...users.filter((user) => user.parentId === company.id)]
          : [];
      const allowedIds = new Set(allowedUsers.map((user) => user.id));

      const sanitized = data.flatMap((cached) => {
        const user =
          findStoredUser(allowedUsers, cached.userId) ||
          findStoredUser(allowedUsers, cached.email || "");
        if (!user || !allowedIds.has(user.id)) return [];
        return [sanitizeCachedData(cached, user)];
      });

      return Response.json({ data: sanitized });
    }
    case "getCachedData": {
      if (!userId) return Response.json({ error: "userId required" }, { status: 400 });
      const isOwnData = session.user?.email?.toLowerCase() === userId.toLowerCase();
      const isCompanyUser = session.user?.role === "company";
      let isCompanyClient = false;
      if (isCompanyUser && !isOwnData) {
        const [clientIds, clientEmails] = await Promise.all([
          getCompanyClientIds(session.user?.email || ""),
          getCompanyClientEmails(session.user?.email || ""),
        ]);
        isCompanyClient = clientIds.includes(userId) || clientEmails.includes(userId.toLowerCase());
      }
      if (!isAdmin && !isOwnData && !isCompanyClient) {
        return Response.json({ error: "Unauthorized" }, { status: 403 });
      }
      const [data, users] = await Promise.all([
        getCachedClientData(userId),
        kv.get<StoredUserBasic[]>(USERS_KEY).then((stored) => stored || []),
      ]);
      if (!data) return Response.json({ data: null });
      const user = findStoredUser(users, userId);
      return Response.json({ data: user ? sanitizeCachedData(data, user) : null });
    }
    case "getBankDetails": {
      if (!userId) return Response.json({ error: "userId required" }, { status: 400 });
      const isCompanyUser = session.user?.role === "company";
      const isOwnData = session.user?.email?.toLowerCase() === userId.toLowerCase();
      let isCompanyClient = false;
      if (isCompanyUser && !isOwnData) {
        const clientIds = await getCompanyClientIds(session.user?.email || "");
        const clientEmails = await getCompanyClientEmails(session.user?.email || "");
        isCompanyClient = clientIds.includes(userId) || clientEmails.includes(userId.toLowerCase());
      }
      if (!isAdmin && !isOwnData && !isCompanyClient) {
        return Response.json({ error: "Unauthorized" }, { status: 403 });
      }
      const data = await getBankDetails(userId);
      return Response.json({ data });
    }
    case "getAgreements": {
      if (!userId) return Response.json({ error: "userId required" }, { status: 400 });
      if (!isAdmin && session.user?.email?.toLowerCase() !== userId.toLowerCase()) {
        return Response.json({ error: "Unauthorized" }, { status: 403 });
      }
      const data = await getAgreements(userId);
      return Response.json({ data });
    }
    case "getGlobalWarning": {
      const data = await getGlobalWarning();
      return Response.json({ data });
    }
    case "getClientWarning": {
      const targetId = userId || session.user?.email;
      if (!targetId) return Response.json({ error: "userId required" }, { status: 400 });
      if (!isAdmin && session.user?.email?.toLowerCase() !== targetId.toLowerCase()) {
        return Response.json({ error: "Unauthorized" }, { status: 403 });
      }
      const data = await getClientWarning(targetId);
      return Response.json({ data });
    }
    case "getMyWarnings": {
      const email = session.user?.email?.toLowerCase() || "";
      const [globalW, clientW] = await Promise.all([
        getGlobalWarning(),
        getClientWarning(email),
      ]);
      return Response.json({ data: { global: globalW, client: clientW } });
    }
    case "getSupportRequests": {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const data = await getSupportRequests();
      return Response.json({ data });
    }
    case "getMySupportRequests": {
      const email = session.user?.email?.toLowerCase() || "";
      const allReqs = await getSupportRequests();
      const myReqs = allReqs.filter((r) => r.clientEmail.toLowerCase() === email);
      return Response.json({ data: myReqs });
    }
    case "getAdminSettings": {
      const settings = await getAdminSettings();
      return Response.json({ data: settings });
    }
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user?.userStatus === "inactive") {
    return Response.json({ error: "Account is inactive" }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body;
  const isAdmin = ADMIN_EMAILS.includes(session.user?.email?.toLowerCase() || "");

  switch (action) {
    case "cacheData": {
      const { userId, data } = body as { userId: string; data: CachedClientData };
      if (!userId || !data) {
        return Response.json({ error: "userId and data required" }, { status: 400 });
      }
      const isOwnData = session.user?.email?.toLowerCase() === userId.toLowerCase();
      if (!isAdmin && !isOwnData) {
        return Response.json({ error: "Unauthorized" }, { status: 403 });
      }

      const users = (await kv.get<StoredUserBasic[]>(USERS_KEY)) || [];
      const user = findStoredUser(users, userId);
      if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }

      const sanitized = sanitizeCachedData(
        { ...data, lastUpdated: new Date().toISOString() },
        user
      );
      await cacheClientData(userId, sanitized, {
        preserveRevenue: true,
        source: "client_dashboard",
      });
      return Response.json({ success: true, data: sanitized });
    }
    case "saveBankDetails": {
      const { userId, bankDetails } = body as { userId: string; bankDetails: BankDetails };
      if (!userId || !bankDetails) return Response.json({ error: "userId and bankDetails required" }, { status: 400 });
      if (!isAdmin && session.user?.email?.toLowerCase() !== userId.toLowerCase()) {
        return Response.json({ error: "Unauthorized" }, { status: 403 });
      }
      await saveBankDetails(userId, bankDetails);
      return Response.json({ success: true });
    }
    case "removeChannelFromCache": {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { channelId } = body as { channelId: string };
      if (!channelId) return Response.json({ error: "channelId required" }, { status: 400 });
      await removeChannelFromAllCaches(channelId);
      return Response.json({ success: true });
    }
    case "restoreCachedData": {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { userId } = body as { userId: string };
      if (!userId) return Response.json({ error: "userId required" }, { status: 400 });
      const users = (await kv.get<StoredUserBasic[]>(USERS_KEY)) || [];
      const user = findStoredUser(users, userId);
      if (!user) return Response.json({ error: "User not found" }, { status: 404 });
      const allowedChannels = user.channels || [];
      const restored =
        (await restoreCachedClientDataBackup(userId, allowedChannels)) ||
        (user.email.toLowerCase() !== userId.toLowerCase()
          ? await restoreCachedClientDataBackup(user.email, allowedChannels)
          : null);
      if (!restored) return Response.json({ error: "No backup found" }, { status: 404 });
      return Response.json({ success: true, data: restored });
    }
    case "saveAgreements": {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { userId, agreements } = body as { userId: string; agreements: Agreement[] };
      if (!userId || !agreements) return Response.json({ error: "userId and agreements required" }, { status: 400 });
      await saveAgreements(userId, agreements);
      return Response.json({ success: true });
    }
    case "setGlobalWarning": {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { warning } = body as { warning: AdminWarning | null };
      await setGlobalWarning(warning);
      return Response.json({ success: true });
    }
    case "setClientWarning": {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { userId, warning } = body as { userId: string; warning: AdminWarning | null };
      if (!userId) return Response.json({ error: "userId required" }, { status: 400 });
      await setClientWarning(userId, warning);
      return Response.json({ success: true });
    }
    case "submitSupportRequest": {
      const { message, screenshot, clientName } = body as { message: string; screenshot?: string; clientName?: string };
      if (!message?.trim()) return Response.json({ error: "message required" }, { status: 400 });
      const req: SupportRequest = {
        id: `sr-${Date.now()}`,
        clientEmail: session.user?.email?.toLowerCase() || "",
        clientName: clientName || session.user?.name || "Unknown",
        message: message.trim(),
        screenshot,
        status: "open",
        createdAt: new Date().toISOString(),
      };
      await addSupportRequest(req);
      return Response.json({ success: true, data: req });
    }
    case "resolveSupportRequest": {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { requestId, adminResponse } = body as { requestId: string; adminResponse?: string };
      if (!requestId) return Response.json({ error: "requestId required" }, { status: 400 });
      await resolveSupportRequest(requestId, adminResponse);
      return Response.json({ success: true });
    }
    case "setAdminSettings": {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { settings } = body as { settings: AdminSettings };
      if (!settings) return Response.json({ error: "settings required" }, { status: 400 });
      await setAdminSettings(settings);
      return Response.json({ success: true });
    }
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
}
