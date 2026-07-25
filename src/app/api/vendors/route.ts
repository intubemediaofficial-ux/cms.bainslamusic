import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllCachedClientData } from "@/lib/client-data-cache";
import {
  getMonthlyChannelAnalytics,
  isValidMonth,
  monthsInRange,
  refreshMonthlyChannels,
} from "@/lib/monthly-channel-analytics";
import { kv } from "@/lib/redis";
import {
  getVendorGoogleSheetConfig,
  getVendorGoogleSheetServiceAccountEmail,
  saveScopedVendorGoogleSheetConfig,
  saveVendorGoogleSheetConfig,
} from "@/lib/vendor-google-sheet-config";
import {
  buildVendorExcelWorkbook,
  buildVendorMonthExportValues,
} from "@/lib/vendor-excel-export";
import {
  syncVendorGoogleSheet,
  uniqueVendorSheetNames,
} from "@/lib/vendor-google-sheets";
import {
  getVendorSheetChannelMetadata,
  vendorSheetChannelMetadataKey,
} from "@/lib/vendor-sheet-metadata";
import {
  ChannelVendorAssignment,
  getVendorAssignments,
  getVendors,
  getVendorsForOwner,
  removeScopedChannelVendorAssignments,
  saveVendorAssignments,
  saveVendors,
  Vendor,
} from "@/lib/vendors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const USERS_KEY = "bainsla_users";
const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: "client" | "company";
  parentId?: string;
  channels?: string[];
  pendingChannels?: string[];
  channelNetworks?: Array<{
    channelId: string;
    networkId: string;
    networkName: string;
    revenueSharePercent?: number;
  }>;
  status?: "active" | "inactive" | "pending";
}

interface VendorScope {
  email: string;
  isAdmin: boolean;
  currentUser: StoredUser | null;
  vendorOwnerUserId: string | null;
  viewingCompanyAsAdmin: boolean;
  approvedChannelIds: Set<string>;
  manageableChannelIds: Set<string>;
  channelOwners: Map<string, StoredUser>;
  channelNetworks: Map<string, string>;
}

async function getScope(requestedCompanyId?: string): Promise<VendorScope | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email || session?.user?.userStatus === "inactive") return null;

  const users = (await kv.get<StoredUser[]>(USERS_KEY)) || [];
  const isAdmin = ADMIN_EMAILS.includes(email);
  const authenticatedUser = users.find((user) => user.email.toLowerCase() === email) || null;
  const selectedCompany = isAdmin && requestedCompanyId
    ? users.find(
        (user) =>
          user.id === requestedCompanyId &&
          user.role === "company"
      ) || null
    : null;
  if (isAdmin && requestedCompanyId && !selectedCompany) return null;
  const currentUser = selectedCompany || authenticatedUser;

  let scopedUsers: StoredUser[];
  if (selectedCompany) {
    scopedUsers = [
      selectedCompany,
      ...users.filter(
        (user) => user.parentId === selectedCompany.id && user.status === "active"
      ),
    ];
  } else if (isAdmin) {
    scopedUsers = users.filter(
      (user) =>
        user.status === "active" &&
        user.role === "client" &&
        !user.parentId
    );
  } else if (!currentUser || currentUser.status !== "active") {
    return null;
  } else if (currentUser.role === "company") {
    scopedUsers = [
      currentUser,
      ...users.filter(
        (user) => user.parentId === currentUser.id && user.status === "active"
      ),
    ];
  } else {
    scopedUsers = [currentUser];
  }

  const approvedChannelIds = new Set(scopedUsers.flatMap((user) => user.channels || []));
  const manageableChannelIds = new Set(
    scopedUsers.flatMap((user) => [
      ...(user.channels || []),
      ...(user.pendingChannels || []),
    ])
  );
  const channelOwners = new Map<string, StoredUser>();
  const channelNetworks = new Map<string, string>();
  for (const user of scopedUsers) {
    for (const channelId of user.channels || []) channelOwners.set(channelId, user);
    for (const assignment of user.channelNetworks || []) {
      channelNetworks.set(assignment.channelId, assignment.networkName);
    }
  }

  return {
    email,
    isAdmin,
    currentUser,
    vendorOwnerUserId: selectedCompany?.id || (
      isAdmin
        ? null
        : currentUser?.role === "company"
          ? currentUser.id
          : currentUser?.parentId || null
    ),
    viewingCompanyAsAdmin: Boolean(selectedCompany),
    approvedChannelIds,
    manageableChannelIds,
    channelOwners,
    channelNetworks,
  };
}

function getVisibleVendors(
  scope: VendorScope,
  vendors: Vendor[],
  assignments: ChannelVendorAssignment[] = []
): Vendor[] {
  const tenantVendors = getVendorsForOwner(vendors, scope.vendorOwnerUserId);
  if (canManageVendorSheets(scope)) return tenantVendors;
  const assignedVendorIds = new Set(
    assignments
      .filter((assignment) => scope.manageableChannelIds.has(assignment.channelId))
      .map((assignment) => assignment.vendorId)
  );
  return tenantVendors.filter((vendor) => assignedVendorIds.has(vendor.id));
}

function normalizeName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function reportMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

async function buildVendorReports(
  scope: VendorScope,
  vendors: Vendor[],
  assignments: ChannelVendorAssignment[],
  month: string
) {
  const [analytics, cachedClients, sheetMetadata] = await Promise.all([
    getMonthlyChannelAnalytics(month, { allowFetch: false }),
    getAllCachedClientData(),
    getVendorSheetChannelMetadata(sheetScopeUserId(scope)),
  ]);
  const analyticsMap = new Map(
    analytics.channels.map((channel) => [channel.channel_id, channel])
  );
  const nameMap = new Map<string, string>();
  const sheetMetadataMap = new Map(
    sheetMetadata.map((record) => [
      vendorSheetChannelMetadataKey(record.vendorId, record.channelId),
      record,
    ])
  );
  for (const client of cachedClients) {
    for (const channel of client.channels || []) {
      if (channel.channelTitle) nameMap.set(channel.channelId, channel.channelTitle);
    }
  }

  return vendors.map((vendor) => {
    const channelIds = assignments
      .filter(
        (assignment) =>
          assignment.vendorId === vendor.id &&
          scope.approvedChannelIds.has(assignment.channelId)
      )
      .map((assignment) => assignment.channelId);
    const channels = channelIds
      .map((channelId) => {
        const row = analyticsMap.get(channelId);
        const owner = scope.channelOwners.get(channelId);
        const sheetValues = sheetMetadataMap.get(
          vendorSheetChannelMetadataKey(vendor.id, channelId)
        );
        return {
          channel_id: channelId,
          channel_name: sheetValues
            ? sheetValues.channelName
            : row?.channel_name || nameMap.get(channelId) || channelId,
          client_name: sheetValues ? sheetValues.clientName : owner?.name || "",
          vendor_name: vendor.name,
          network_name: sheetValues
            ? sheetValues.networkName
            : scope.channelNetworks.get(channelId) || "",
          linked_date: sheetValues?.linkedDate || "",
          revenue_usd: row?.revenue_usd || 0,
          views: row?.views || 0,
          synced_through: row?.synced_through || null,
          updated_at: row?.updated_at || null,
          available: Boolean(row),
        };
      })
      .sort((a, b) => a.channel_name.localeCompare(b.channel_name));

    return {
      month,
      vendor,
      channels,
      totals: {
        channels: channels.length,
        revenue_usd: channels.reduce((sum, channel) => sum + channel.revenue_usd, 0),
        views: channels.reduce((sum, channel) => sum + channel.views, 0),
      },
      cacheStatus: analytics.cacheStatus,
      missingChannels: channels.filter((channel) => !channel.available).length,
    };
  });
}

function sheetScopeUserId(scope: VendorScope): string | undefined {
  return scope.vendorOwnerUserId || undefined;
}

function canManageVendorSheets(scope: VendorScope): boolean {
  return scope.isAdmin || scope.currentUser?.role === "company";
}

async function syncSheetBeforeCachedRead(
  scope: VendorScope,
  vendorIds: Set<string>,
  month: string
): Promise<void> {
  if (!canManageVendorSheets(scope)) return;
  try {
    await syncVendorGoogleSheet({
      scopeUserId: sheetScopeUserId(scope),
      vendorIds,
      channelIds: scope.approvedChannelIds,
      months: new Set([month]),
    });
  } catch (error) {
    console.error("[Vendors] Google Sheet metadata import failed:", error);
  }
}

async function syncSheetAfterMutation(
  scope: VendorScope,
  suppressErrors = true
) {
  try {
    const vendors = await getVendors();
    const vendorIds = new Set(
      getVendorsForOwner(vendors, scope.vendorOwnerUserId).map((vendor) => vendor.id)
    );
    return await syncVendorGoogleSheet({
      scopeUserId: sheetScopeUserId(scope),
      vendorIds,
      channelIds: scope.approvedChannelIds,
    });
  } catch (error) {
    console.error("[Vendors] Google Sheets sync failed:", error);
    if (!suppressErrors) throw error;
    return { status: "failed" as const };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = await getScope(url.searchParams.get("companyId") || undefined);
  if (!scope) return Response.json({ error: "Unauthorized or invalid company scope" }, { status: 401 });

  const action = url.searchParams.get("action") || "list";
  const [vendors, assignments] = await Promise.all([
    getVendors(),
    getVendorAssignments(),
  ]);
  const visibleVendors = getVisibleVendors(scope, vendors, assignments);
  const visibleVendorIds = new Set(visibleVendors.map((vendor) => vendor.id));
  const scopedAssignments = assignments.filter(
    (assignment) =>
      visibleVendorIds.has(assignment.vendorId) &&
      scope.manageableChannelIds.has(assignment.channelId)
  );

  if (action === "list") {
    const [sheetConfig, serviceAccountEmail] = canManageVendorSheets(scope)
      ? await Promise.all([
          getVendorGoogleSheetConfig(sheetScopeUserId(scope)),
          getVendorGoogleSheetServiceAccountEmail(sheetScopeUserId(scope)),
        ])
      : [null, ""];
    const counts = new Map<string, number>();
    for (const assignment of scopedAssignments) {
      if (!scope.approvedChannelIds.has(assignment.channelId)) continue;
      counts.set(assignment.vendorId, (counts.get(assignment.vendorId) || 0) + 1);
    }
    return Response.json({
      data: {
        vendors: visibleVendors
          .map((vendor) => ({
            ...vendor,
            channelCount: counts.get(vendor.id) || 0,
            canEdit: canManageVendorSheets(scope),
            canAssign: canManageVendorSheets(scope),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        assignments: scopedAssignments,
        assignedVendors: visibleVendors.map((vendor) => ({
          id: vendor.id,
          name: vendor.name,
        })),
        sheetConnection: canManageVendorSheets(scope)
          ? {
              configured: Boolean(sheetConfig),
              serviceAccountEmail,
            }
          : null,
        scope: {
          companyId: scope.vendorOwnerUserId,
          companyName: scope.vendorOwnerUserId ? scope.currentUser?.name || "Company" : null,
          viewingCompanyAsAdmin: scope.viewingCompanyAsAdmin,
        },
      },
    });
  }

  if (action === "export") {
    if (!canManageVendorSheets(scope)) {
      return Response.json({ error: "Vendor export requires Admin or Company access" }, { status: 403 });
    }
    const vendorId = url.searchParams.get("vendorId") || "";
    const month = url.searchParams.get("month") || "";
    if (!isValidMonth(month)) {
      return Response.json({ error: "month=YYYY-MM is required" }, { status: 400 });
    }
    const selectedVendor = visibleVendors.find((vendor) => vendor.id === vendorId);
    if (!selectedVendor) {
      return Response.json({ error: "Vendor not found" }, { status: 404 });
    }
    const vendorIndex = visibleVendors.findIndex((vendor) => vendor.id === selectedVendor.id);
    const sheetTitle = uniqueVendorSheetNames(visibleVendors.map((vendor) => vendor.name))[vendorIndex];
    try {
      await syncSheetBeforeCachedRead(scope, new Set([vendorId]), month);
      const report = (await buildVendorReports(
        scope,
        [selectedVendor],
        scopedAssignments,
        month
      ))[0];
      const values = buildVendorMonthExportValues(
        selectedVendor.name,
        reportMonthLabel(month),
        report.channels.map((channel) => ({
          channelId: channel.channel_id,
          channelName: channel.channel_name,
          clientName: channel.client_name,
          networkName: channel.network_name,
          revenueUsd: channel.revenue_usd,
          linkedDate: channel.linked_date,
        }))
      );
      const data = await buildVendorExcelWorkbook(sheetTitle, values);
      const baseName = selectedVendor.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "vendor";
      const filename = `${baseName}-${month}-revenue.xlsx`;
      return new Response(data, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error("[Vendors] vendor Excel export failed:", error);
      return Response.json({ error: "Vendor Excel export failed" }, { status: 502 });
    }
  }

  if (action === "report" || action === "reports") {
    const vendorId = url.searchParams.get("vendorId") || "";
    const month = url.searchParams.get("month") || "";
    if (!isValidMonth(month) || (action === "report" && !vendorId)) {
      return Response.json(
        { error: action === "report" ? "vendorId and month=YYYY-MM are required" : "month=YYYY-MM is required" },
        { status: 400 }
      );
    }
    const reportVendors = action === "report"
      ? visibleVendors.filter((vendor) => vendor.id === vendorId)
      : visibleVendors;
    if (action === "report" && reportVendors.length === 0) {
      return Response.json({ error: "Vendor not found" }, { status: 404 });
    }
    if (action === "report") {
      await syncSheetBeforeCachedRead(scope, new Set([vendorId]), month);
    }
    const reports = await buildVendorReports(
      scope,
      reportVendors,
      scopedAssignments,
      month
    );
    return Response.json({ data: action === "report" ? reports[0] : { month, reports } });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const scope = await getScope(
    typeof body.companyId === "string" ? body.companyId : undefined
  );
  if (!scope) return Response.json({ error: "Unauthorized or invalid company scope" }, { status: 401 });
  if (!canManageVendorSheets(scope)) {
    return Response.json({ error: "Vendor Management requires Admin or Company access" }, { status: 403 });
  }

  const name = normalizeName(body.name);
  if (!name) return Response.json({ error: "Vendor name is required" }, { status: 400 });

  const vendors = await getVendors();
  const visible = getVisibleVendors(scope, vendors);
  const duplicate = visible.find(
    (vendor) => vendor.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return Response.json({ error: "Vendor with this name already exists" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const vendor: Vendor = {
    id: crypto.randomUUID(),
    name,
    createdByUserId: scope.vendorOwnerUserId,
    createdByEmail: scope.email,
    createdAt: now,
    updatedAt: now,
  };
  await saveVendors([...vendors, vendor]);
  const sheetSync = await syncSheetAfterMutation(scope);
  return Response.json({ data: vendor, sheetSync }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const scope = await getScope(
    typeof body.companyId === "string" ? body.companyId : undefined
  );
  if (!scope) return Response.json({ error: "Unauthorized or invalid company scope" }, { status: 401 });
  if (!canManageVendorSheets(scope)) {
    return Response.json({ error: "Vendor Management requires Admin or Company access" }, { status: 403 });
  }

  const action = body.action;
  if (action === "configureSheet") {
    if (!canManageVendorSheets(scope)) {
      return Response.json({ error: "Company or Admin access required" }, { status: 403 });
    }
    const spreadsheetInput =
      typeof body.spreadsheetId === "string" ? body.spreadsheetId.trim() : "";
    const spreadsheetId =
      spreadsheetInput.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
      (/^[a-zA-Z0-9_-]{20,}$/.test(spreadsheetInput) ? spreadsheetInput : "");
    if (!spreadsheetId) {
      return Response.json({ error: "Invalid Google Sheet URL" }, { status: 400 });
    }
    const clientEmail = typeof body.clientEmail === "string" ? body.clientEmail.trim() : "";
    const privateKey = typeof body.privateKey === "string" ? body.privateKey.trim() : "";
    if (
      !clientEmail.endsWith(".gserviceaccount.com") ||
      !privateKey.includes("-----BEGIN PRIVATE KEY-----") ||
      !privateKey.includes("-----END PRIVATE KEY-----")
    ) {
      return Response.json({ error: "Invalid service-account JSON" }, { status: 400 });
    }
    if (scope.vendorOwnerUserId) {
      await saveScopedVendorGoogleSheetConfig(scope.vendorOwnerUserId, {
        spreadsheetId,
        clientEmail,
        privateKey,
      });
    } else {
      await saveVendorGoogleSheetConfig({ spreadsheetId, clientEmail, privateKey });
    }
    try {
      return Response.json({ data: await syncSheetAfterMutation(scope, false) });
    } catch (error) {
      console.error("[Vendors] Google Sheets configuration test failed:", error);
      return Response.json(
        { error: "Sheet saved, but access failed. Share it with the service-account email as Editor." },
        { status: 502 }
      );
    }
  }
  if (action === "syncSheet") {
    if (!canManageVendorSheets(scope)) {
      return Response.json({ error: "Company or Admin access required" }, { status: 403 });
    }
    try {
      return Response.json({ data: await syncSheetAfterMutation(scope, false) });
    } catch (error) {
      console.error("[Vendors] Google Sheets sync failed:", error);
      return Response.json({ error: "Google Sheets sync failed" }, { status: 502 });
    }
  }
  const [vendors, assignments] = await Promise.all([
    getVendors(),
    getVendorAssignments(),
  ]);
  const visibleVendors = getVisibleVendors(scope, vendors, assignments);
  const visibleVendorIds = new Set(visibleVendors.map((vendor) => vendor.id));
  const revenueVisibleVendors = visibleVendors;

  if (action === "syncRevenue") {
    if (!canManageVendorSheets(scope)) {
      return Response.json({ error: "Company or Admin access required" }, { status: 403 });
    }
    const requestedVendorIds = Array.isArray(body.vendorIds)
      ? Array.from(
          new Set(
            body.vendorIds.filter(
              (id: unknown): id is string => typeof id === "string" && id.length > 0
            )
          )
        )
      : [];
    const fromMonth = typeof body.fromMonth === "string" ? body.fromMonth : "";
    const toMonth = typeof body.toMonth === "string" ? body.toMonth : "";
    if (requestedVendorIds.length === 0) {
      return Response.json({ error: "Select at least one vendor" }, { status: 400 });
    }
    if (!isValidMonth(fromMonth) || !isValidMonth(toMonth)) {
      return Response.json(
        { error: "fromMonth and toMonth must be valid YYYY-MM up to the current month" },
        { status: 400 }
      );
    }
    if (fromMonth > toMonth) {
      return Response.json({ error: "fromMonth cannot be after toMonth" }, { status: 400 });
    }
    const selectedVendorIds = new Set(
      revenueVisibleVendors
        .filter((vendor) => requestedVendorIds.includes(vendor.id))
        .map((vendor) => vendor.id)
    );
    if (selectedVendorIds.size === 0) {
      return Response.json({ error: "Vendor is not in your current scope" }, { status: 403 });
    }
    const channelIds = Array.from(
      new Set(
        assignments
          .filter(
            (assignment) =>
              selectedVendorIds.has(assignment.vendorId) &&
              scope.approvedChannelIds.has(assignment.channelId)
          )
          .map((assignment) => assignment.channelId)
      )
    );
    if (channelIds.length === 0) {
      return Response.json({ error: "Selected vendors have no assigned channels" }, { status: 400 });
    }
    const months = monthsInRange(fromMonth, toMonth);
    const refreshResults = [];
    for (const month of months) {
      refreshResults.push(await refreshMonthlyChannels(month, channelIds));
    }
    let sheetSync;
    try {
      sheetSync = await syncVendorGoogleSheet({
        scopeUserId: sheetScopeUserId(scope),
        vendorIds: selectedVendorIds,
        channelIds: new Set(channelIds),
        months: new Set(months),
      });
    } catch (error) {
      console.error("[Vendors] revenue sync sheet update failed:", error);
      return Response.json(
        { error: "Revenue refreshed, but Google Sheet update failed", refresh: refreshResults },
        { status: 502 }
      );
    }
    return Response.json({
      data: {
        vendors: selectedVendorIds.size,
        channels: channelIds.length,
        months,
        refresh: refreshResults,
        sheetSync,
      },
    });
  }

  if (action === "assign") {
    const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
    const vendorId = typeof body.vendorId === "string" ? body.vendorId.trim() : "";
    if (!channelId || !scope.manageableChannelIds.has(channelId)) {
      return Response.json({ error: "Channel is not in your current scope" }, { status: 403 });
    }
    if (vendorId && !visibleVendors.some((vendor) => vendor.id === vendorId)) {
      return Response.json({ error: "Vendor is not in your current scope" }, { status: 403 });
    }

    const next = removeScopedChannelVendorAssignments(
      assignments,
      new Set([channelId]),
      visibleVendorIds
    );
    if (vendorId) {
      const now = new Date().toISOString();
      const previous = assignments.find(
        (assignment) =>
          assignment.channelId === channelId &&
          visibleVendorIds.has(assignment.vendorId)
      );
      next.push({
        channelId,
        vendorId,
        assignedByEmail: scope.email,
        assignedAt: previous?.assignedAt || now,
        updatedAt: now,
      });
    }
    await saveVendorAssignments(next);
    const sheetSync = await syncSheetAfterMutation(scope);
    return Response.json({ data: { channelId, vendorId: vendorId || null }, sheetSync });
  }

  if (action === "assignMany") {
    if (!Array.isArray(body.assignments)) {
      return Response.json({ error: "assignments array is required" }, { status: 400 });
    }
    const requested: Array<{ channelId: string; vendorId: string }> = body.assignments
      .filter(
        (item: unknown): item is { channelId: string; vendorId: string } =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { channelId?: unknown }).channelId === "string" &&
          typeof (item as { vendorId?: unknown }).vendorId === "string"
      )
      .map((item: { channelId: string; vendorId: string }) => ({
        channelId: item.channelId.trim(),
        vendorId: item.vendorId.trim(),
      }));
    const invalid = requested.find(
      (item: { channelId: string; vendorId: string }) =>
        !scope.manageableChannelIds.has(item.channelId) ||
        (item.vendorId && !visibleVendors.some((vendor) => vendor.id === item.vendorId))
    );
    if (invalid) {
      return Response.json({ error: "Assignment is outside your current scope" }, { status: 403 });
    }

    const channelIds = new Set(requested.map((item: { channelId: string }) => item.channelId));
    const next = removeScopedChannelVendorAssignments(
      assignments,
      channelIds,
      visibleVendorIds
    );
    const now = new Date().toISOString();
    for (const item of requested) {
      if (!item.vendorId) continue;
      const previous = assignments.find(
        (assignment) =>
          assignment.channelId === item.channelId &&
          visibleVendorIds.has(assignment.vendorId)
      );
      next.push({
        channelId: item.channelId,
        vendorId: item.vendorId,
        assignedByEmail: scope.email,
        assignedAt: previous?.assignedAt || now,
        updatedAt: now,
      });
    }
    await saveVendorAssignments(next);
    const sheetSync = await syncSheetAfterMutation(scope);
    return Response.json({ data: { updated: requested.length }, sheetSync });
  }

  if (action === "rename") {
    const vendorId = typeof body.vendorId === "string" ? body.vendorId : "";
    const name = normalizeName(body.name);
    const vendor = visibleVendors.find((item) => item.id === vendorId);
    if (!vendor) {
      return Response.json({ error: "Vendor is not editable" }, { status: 403 });
    }
    if (!name) return Response.json({ error: "Vendor name is required" }, { status: 400 });
    const duplicate = visibleVendors.some(
      (item) => item.id !== vendorId && item.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      return Response.json({ error: "Vendor with this name already exists" }, { status: 409 });
    }
    const updated = vendors.map((item) =>
      item.id === vendorId ? { ...item, name, updatedAt: new Date().toISOString() } : item
    );
    await saveVendors(updated);
    const sheetSync = await syncSheetAfterMutation(scope);
    return Response.json({ data: updated.find((item) => item.id === vendorId), sheetSync });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const scope = await getScope(url.searchParams.get("companyId") || undefined);
  if (!scope) return Response.json({ error: "Unauthorized or invalid company scope" }, { status: 401 });
  if (!canManageVendorSheets(scope)) {
    return Response.json({ error: "Vendor Management requires Admin or Company access" }, { status: 403 });
  }

  const vendorId = url.searchParams.get("vendorId") || "";
  const [vendors, assignments] = await Promise.all([
    getVendors(),
    getVendorAssignments(),
  ]);
  const vendor = getVisibleVendors(scope, vendors).find((item) => item.id === vendorId);
  if (!vendor) return Response.json({ error: "Vendor not found" }, { status: 404 });

  const vendorAssignments = assignments.filter((assignment) => assignment.vendorId === vendorId);
  const canDelete =
    scope.isAdmin ||
    vendorAssignments.every((assignment) =>
      scope.manageableChannelIds.has(assignment.channelId)
    );
  if (!canDelete) return Response.json({ error: "Vendor is not deletable" }, { status: 403 });

  await Promise.all([
    saveVendors(vendors.filter((item) => item.id !== vendorId)),
    saveVendorAssignments(
      assignments.filter((assignment) => assignment.vendorId !== vendorId)
    ),
  ]);
  const sheetSync = await syncSheetAfterMutation(scope);
  return Response.json({ data: { deleted: true }, sheetSync });
}
