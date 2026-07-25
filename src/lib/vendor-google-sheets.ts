import "server-only";

import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";
import { getAllCachedClientData } from "@/lib/client-data-cache";
import { kv } from "@/lib/redis";
import { getBackendChannels } from "@/lib/backend-api";
import {
  getConfiguredVendorGoogleSheetScopeIds,
  getVendorGoogleSheetConfig,
} from "@/lib/vendor-google-sheet-config";
import {
  getVendorAssignments,
  getVendors,
  getVendorsForOwner,
} from "@/lib/vendors";
import {
  getVendorSheetChannelMetadata,
  saveVendorSheetChannelMetadata,
  vendorSheetChannelMetadataKey,
  type VendorSheetChannelMetadata,
} from "@/lib/vendor-sheet-metadata";

const USERS_KEY = "bainsla_users";
const MONTHLY_PREFIX = "monthly_channel_analytics:";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

interface StoredUser {
  id: string;
  name: string;
  role?: "client" | "company";
  parentId?: string;
  channels?: string[];
  channelNetworks?: Array<{ channelId: string; networkName: string }>;
  status?: "active" | "inactive" | "pending";
}

interface MonthlyChannel {
  channel_id: string;
  channel_name: string;
  revenue_usd: number;
  views: number;
  synced_through: string;
  updated_at: string;
}

interface MonthlyCache {
  month: string;
  channels: MonthlyChannel[];
}

export interface VendorSheetSyncResult {
  status: "updated" | "not_configured";
  vendors?: number;
  months?: number;
  rows?: number;
}

export interface VendorSheetSyncOptions {
  vendorIds?: Set<string>;
  channelIds?: Set<string>;
  months?: Set<string>;
  scopeUserId?: string;
}

function sanitizeSheetName(value: string): string {
  const cleaned = value.replace(/[\\/?*\[\]:]/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || "Vendor").slice(0, 31);
}

export function uniqueVendorSheetNames(vendorNames: string[]): string[] {
  const used = new Set<string>(["summary"]);
  return vendorNames.map((name) => {
    const base = sanitizeSheetName(name);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) {
      const ending = ` (${suffix})`;
      candidate = `${base.slice(0, 31 - ending.length)}${ending}`;
      suffix += 1;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function normalizeLinkedDate(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date((value - 25569) * 86_400_000).toISOString().slice(0, 10);
  }
  const parsed = Date.parse(String(value || "").trim());
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

function googleSheetDateSerial(value: unknown): number | string {
  const date = normalizeLinkedDate(value);
  if (!date) return "";
  return Date.parse(`${date}T00:00:00Z`) / 86_400_000 + 25569;
}

function normalizedHeader(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function preserveHistoricalVendorRows(
  existingHeader: unknown[],
  existingRows: unknown[][],
  nextHeader: Array<string | number>,
  activeChannelIds: Set<string>
): Array<Array<string | number>> {
  const oldColumnByHeader = new Map(
    existingHeader.map((value, index) => [normalizedHeader(value), index])
  );
  const channelIdIndex = oldColumnByHeader.get("channelid");
  if (channelIdIndex === undefined) return [];

  return existingRows.flatMap((row) => {
    const channelId = String(row[channelIdIndex] || "").trim();
    if (!channelId || activeChannelIds.has(channelId)) return [];
    return [nextHeader.map((header) => {
      const normalized = normalizedHeader(header);
      const oldIndex = oldColumnByHeader.get(normalized);
      const value = oldIndex === undefined ? "" : row[oldIndex];
      if (normalized === "linkeddate" || normalized === "linkdate") {
        return googleSheetDateSerial(value);
      }
      if (monthFromRevenueHeader(header)) {
        const revenueText = String(value || "").trim();
        if (!revenueText) return "";
        const revenue = Number(revenueText.replace(/,/g, ""));
        return Number.isFinite(revenue) ? revenue : revenueText;
      }
      return typeof value === "number" ? value : String(value || "");
    })];
  });
}

const DEFAULT_VENDOR_START_MONTH = "2026-02";
const VENDOR_START_MONTHS = new Map([
  ["rajesh white gold", "2025-12"],
  ["devendra wmg", "2026-01"],
  ["devendra other cms", "2026-01"],
]);

export function getVendorStartMonth(vendorName: string): string {
  return VENDOR_START_MONTHS.get(vendorName.trim().toLowerCase()) || DEFAULT_VENDOR_START_MONTH;
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function monthFromRevenueHeader(value: unknown): string {
  const match = String(value || "").match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+Revenue\s+USD$/i
  );
  if (!match) return "";
  const monthNumber = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ].indexOf(match[1].toLowerCase()) + 1;
  return `${match[2]}-${String(monthNumber).padStart(2, "0")}`;
}

export async function syncVendorGoogleSheet(
  options: VendorSheetSyncOptions = {}
): Promise<VendorSheetSyncResult> {
  const config = await getVendorGoogleSheetConfig(options.scopeUserId);
  if (!config) return { status: "not_configured" };
  const { spreadsheetId, clientEmail, privateKey } = config;

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: [SHEETS_SCOPE],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const [
    allVendors,
    allAssignments,
    users,
    cachedClients,
    monthlyKeys,
    backendChannels,
    storedSheetMetadata,
  ] = await Promise.all([
    getVendors(),
    getVendorAssignments(),
    kv.get<StoredUser[]>(USERS_KEY).then((value) => value || []),
    getAllCachedClientData(),
    kv.keys(`${MONTHLY_PREFIX}*`),
    getBackendChannels(),
    getVendorSheetChannelMetadata(options.scopeUserId),
  ]);
  const tenantVendors = getVendorsForOwner(
    allVendors,
    options.scopeUserId || null
  );
  const tenantChannelIds = options.channelIds || new Set(
    users
      .filter((user) =>
        user.status === "active" && (
          options.scopeUserId
            ? user.id === options.scopeUserId || user.parentId === options.scopeUserId
            : user.role === "client" && !user.parentId
        )
      )
      .flatMap((user) => user.channels || [])
  );
  const vendors = options.vendorIds
    ? tenantVendors.filter((vendor) => options.vendorIds?.has(vendor.id))
    : tenantVendors;
  const selectedVendorIds = new Set(vendors.map((vendor) => vendor.id));
  const assignments = allAssignments.filter(
    (assignment) =>
      selectedVendorIds.has(assignment.vendorId) &&
      tenantChannelIds.has(assignment.channelId)
  );
  const monthlyCaches = (
    await Promise.all(monthlyKeys.map((key) => kv.get<MonthlyCache>(key)))
  )
    .filter((cache): cache is MonthlyCache => Boolean(cache?.month))
    .sort((a, b) => a.month.localeCompare(b.month));

  const channelOwners = new Map<string, string>();
  const channelNetworks = new Map<string, string>();
  for (const user of users) {
    if (user.status !== "active") continue;
    for (const channelId of user.channels || []) channelOwners.set(channelId, user.name);
    for (const assignment of user.channelNetworks || []) {
      channelNetworks.set(assignment.channelId, assignment.networkName);
    }
  }
  const linkedDates = new Map(
    backendChannels.map((channel) => [channel.channel_id, normalizeLinkedDate(channel.linked_at)])
  );
  const channelNames = new Map<string, string>();
  for (const client of cachedClients) {
    for (const channel of client.channels || []) {
      if (channel.channelTitle) channelNames.set(channel.channelId, channel.channelTitle);
    }
  }

  const assignmentByVendor = new Map<string, string[]>();
  for (const assignment of assignments) {
    if (!channelOwners.has(assignment.channelId)) continue;
    const ids = assignmentByVendor.get(assignment.vendorId) || [];
    ids.push(assignment.channelId);
    assignmentByVendor.set(assignment.vendorId, ids);
  }

  const allVendorSheetNames = uniqueVendorSheetNames(tenantVendors.map((vendor) => vendor.name));
  const sheetNameByVendorId = new Map(
    tenantVendors.map((vendor, index) => [vendor.id, allVendorSheetNames[index]])
  );
  const vendorSheetNames = vendors.map(
    (vendor) => sheetNameByVendorId.get(vendor.id) || sanitizeSheetName(vendor.name)
  );
  const partialSync = Boolean(options.months);
  const desiredTitles = new Set([
    ...(partialSync ? [] : ["Summary"]),
    ...vendorSheetNames,
  ]);
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = metadata.data.sheets || [];
  const existingByTitle = new Map(
    existingSheets.flatMap((sheet) =>
      sheet.properties?.title && sheet.properties.sheetId !== undefined
        ? [[sheet.properties.title, sheet.properties.sheetId] as const]
        : []
    )
  );

  const addRequests = Array.from(desiredTitles)
    .filter((title) => !existingByTitle.has(title))
    .map((title) => ({ addSheet: { properties: { title } } }));
  if (addRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: addRequests },
    });
  }

  const refreshedMetadata = addRequests.length > 0
    ? await sheets.spreadsheets.get({ spreadsheetId })
    : metadata;
  const sheetIdByTitle = new Map(
    (refreshedMetadata.data.sheets || []).flatMap((sheet) =>
      sheet.properties?.title && sheet.properties.sheetId !== undefined
        ? [[sheet.properties.title, sheet.properties.sheetId] as const]
        : []
    )
  );
  const preservedLinkedDates = new Map<string, string>();
  const existingRevenue = new Map<string, number>();
  const existingMonthsByTitle = new Map<string, Set<string>>();
  const existingRowsByTitle = new Map<
    string,
    { header: unknown[]; channelRows: unknown[][] }
  >();
  const sheetMetadataByChannel = new Map(
    storedSheetMetadata.map((record) => [
      vendorSheetChannelMetadataKey(record.vendorId, record.channelId),
      record,
    ])
  );
  const importedSheetMetadata: VendorSheetChannelMetadata[] = [];
  if (vendorSheetNames.length > 0) {
    const currentValues = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: vendorSheetNames.map((title) => `${quoteSheetName(title)}!A:ZZ`),
    });
    (currentValues.data.valueRanges || []).forEach((range, rangeIndex) => {
      const title = vendorSheetNames[rangeIndex];
      const vendor = vendors[rangeIndex];
      const values = range.values || [];
      const header = values[0] || [];
      const channelIdIndex = header.findIndex((value) => normalizedHeader(value) === "channelid");
      const clientIndex = header.findIndex((value) => normalizedHeader(value) === "client");
      const channelIndex = header.findIndex((value) => normalizedHeader(value) === "channel");
      const networkIndex = header.findIndex((value) => normalizedHeader(value) === "network");
      const linkedDateIndex = header.findIndex((value) => {
        const normalized = normalizedHeader(value);
        return normalized === "linkeddate" || normalized === "linkdate";
      });
      const revenueColumns = header.flatMap((value, columnIndex) => {
        const month = monthFromRevenueHeader(value);
        return month ? [{ month, columnIndex }] : [];
      });
      existingMonthsByTitle.set(
        title,
        new Set(revenueColumns.map(({ month }) => month))
      );
      if (channelIdIndex < 0) return;
      const channelRows = values.slice(1).filter((row) =>
        Boolean(String(row[channelIdIndex] || "").trim())
      );
      existingRowsByTitle.set(title, { header, channelRows });
      const activeChannelIds = new Set(assignmentByVendor.get(vendor.id) || []);
      channelRows.forEach((row) => {
        const channelId = String(row[channelIdIndex] || "").trim();
        if (linkedDateIndex >= 0) {
          const linkedDate = normalizeLinkedDate(row[linkedDateIndex]);
          if (linkedDate) preservedLinkedDates.set(channelId, linkedDate);
        }
        for (const { month, columnIndex } of revenueColumns) {
          const revenue = Number(row[columnIndex]);
          if (Number.isFinite(revenue)) {
            existingRevenue.set(`${title}:${channelId}:${month}`, revenue);
          }
        }
        if (!activeChannelIds.has(channelId)) return;
        const record: VendorSheetChannelMetadata = {
          vendorId: vendor.id,
          channelId,
          clientName: clientIndex >= 0 ? String(row[clientIndex] || "").trim() : "",
          channelName: channelIndex >= 0 ? String(row[channelIndex] || "").trim() : "",
          networkName: networkIndex >= 0 ? String(row[networkIndex] || "").trim() : "",
          linkedDate: linkedDateIndex >= 0
            ? normalizeLinkedDate(row[linkedDateIndex])
            : "",
          updatedAt: new Date().toISOString(),
        };
        sheetMetadataByChannel.set(
          vendorSheetChannelMetadataKey(vendor.id, channelId),
          record
        );
        importedSheetMetadata.push(record);
      });
    });
    await saveVendorSheetChannelMetadata(
      importedSheetMetadata,
      options.scopeUserId
    );
  }
  const unmergeRequests: sheets_v4.Schema$Request[] = (refreshedMetadata.data.sheets || [])
    .filter((sheet) => desiredTitles.has(sheet.properties?.title || ""))
    .flatMap((sheet) => (sheet.merges || []).map((range) => ({ unmergeCells: { range } })));
  if (unmergeRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: unmergeRequests },
    });
  }

  const summaryRows: Array<Array<string | number>> = [[
    "Month",
    "Vendor",
    "Channels",
    "Revenue USD",
    "Synced At",
  ]];
  const vendorRows = new Map<string, Array<Array<string | number>>>();
  const monthlyAnalytics = new Map(
    monthlyCaches.map((cache) => [
      cache.month,
      {
        cache,
        channels: new Map(cache.channels.map((channel) => [channel.channel_id, channel])),
      },
    ])
  );
  let totalRows = 0;

  vendors.forEach((vendor, index) => {
    const title = vendorSheetNames[index];
    const channelIds = assignmentByVendor.get(vendor.id) || [];
    const vendorStartMonth = getVendorStartMonth(vendor.name);
    const vendorMonthKeys = Array.from(
      new Set([
        ...monthlyCaches.map((cache) => cache.month),
        ...(existingMonthsByTitle.get(title) || []),
        ...(options.months || []),
      ])
    )
      .filter((month) => month >= vendorStartMonth)
      .sort();
    const vendorMonthlyAnalytics = vendorMonthKeys.map((month) =>
      monthlyAnalytics.get(month) || {
        cache: { month, channels: [] },
        channels: new Map<string, MonthlyChannel>(),
      }
    );
    const header: Array<string | number> = [
      "Vendor",
      "Client",
      "Channel",
      "Channel Link",
      "Channel ID",
      "Network",
      ...vendorMonthlyAnalytics.map(
        ({ cache }) => `${monthLabel(cache.month)} Revenue USD`
      ),
      "Linked Date",
    ];
    const rows: Array<Array<string | number>> = [header];
    const monthlyRevenueTotals = vendorMonthlyAnalytics.map(() => 0);

    for (const channelId of channelIds) {
      const analyticsByMonth = vendorMonthlyAnalytics.map(({ channels }) => channels.get(channelId));
      const latestAnalytics = [...analyticsByMonth].reverse().find(Boolean);
      const sheetMetadata = sheetMetadataByChannel.get(
        vendorSheetChannelMetadataKey(vendor.id, channelId)
      );
      rows.push([
        vendor.name,
        sheetMetadata ? sheetMetadata.clientName : channelOwners.get(channelId) || "",
        sheetMetadata
          ? sheetMetadata.channelName
          : latestAnalytics?.channel_name || channelNames.get(channelId) || channelId,
        `https://www.youtube.com/channel/${channelId}`,
        channelId,
        sheetMetadata ? sheetMetadata.networkName : channelNetworks.get(channelId) || "",
        ...analyticsByMonth.map((analytics, monthIndex) => {
          const month = vendorMonthlyAnalytics[monthIndex].cache.month;
          const previous = existingRevenue.get(`${title}:${channelId}:${month}`);
          const revenue =
            options.months && !options.months.has(month)
              ? previous ?? analytics?.revenue_usd ?? 0
              : analytics?.revenue_usd ?? previous ?? 0;
          monthlyRevenueTotals[monthIndex] += revenue;
          return Number(revenue.toFixed(2));
        }),
        googleSheetDateSerial(
          sheetMetadata
            ? sheetMetadata.linkedDate
            : preservedLinkedDates.get(channelId) || linkedDates.get(channelId)
        ),
      ]);
      totalRows += 1;
    }
    const existingRows = existingRowsByTitle.get(title);
    const historicalRows = existingRows
      ? preserveHistoricalVendorRows(
          existingRows.header,
          existingRows.channelRows,
          header,
          new Set(channelIds)
        )
      : [];
    for (const historicalRow of historicalRows) {
      vendorMonthlyAnalytics.forEach((_, monthIndex) => {
        const revenue = Number(historicalRow[6 + monthIndex]);
        if (Number.isFinite(revenue)) monthlyRevenueTotals[monthIndex] += revenue;
      });
      rows.push(historicalRow);
      totalRows += 1;
    }
    rows.push(
      [""],
      [""],
      [
        "TOTAL USD",
        "",
        "",
        "",
        "",
        "",
        ...monthlyRevenueTotals.map((value) => Number(value.toFixed(2))),
        "",
      ]
    );

    vendorMonthlyAnalytics.forEach(({ cache }, monthIndex) => {
      summaryRows.push([
        cache.month,
        vendor.name,
        channelIds.length + historicalRows.length,
        Number(monthlyRevenueTotals[monthIndex].toFixed(3)),
        new Date().toISOString(),
      ]);
    });
    vendorRows.set(title, rows);
  });

  const updates = [
    ...(
      partialSync
        ? []
        : [{ range: `${quoteSheetName("Summary")}!A1`, values: summaryRows }]
    ),
    ...Array.from(vendorRows, ([title, values]) => ({
      range: `${quoteSheetName(title)}!A1`,
      values,
    })),
  ];
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: {
      ranges: Array.from(desiredTitles).map((title) => quoteSheetName(title)),
    },
  });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: updates,
    },
  });

  const black = { red: 0, green: 0, blue: 0 };
  const white = { red: 1, green: 1, blue: 1 };
  const headerBlue = { red: 31 / 255, green: 78 / 255, blue: 120 / 255 };
  const totalBlue = { red: 217 / 255, green: 234 / 255, blue: 247 / 255 };
  const linkBlue = { red: 17 / 255, green: 85 / 255, blue: 204 / 255 };
  const thinBorder = { style: "SOLID", color: black };
  const formatRequests: sheets_v4.Schema$Request[] = [];
  const summarySheetId = sheetIdByTitle.get("Summary");
  if (!partialSync && summarySheetId !== undefined) {
    formatRequests.push(
      {
        repeatCell: {
          range: { sheetId: summarySheetId, startRowIndex: 0, endRowIndex: summaryRows.length, startColumnIndex: 0, endColumnIndex: 5 },
          cell: { userEnteredFormat: { textFormat: { fontFamily: "Arial", fontSize: 10, foregroundColor: black }, wrapStrategy: "WRAP", verticalAlignment: "MIDDLE" } },
          fields: "userEnteredFormat(textFormat,wrapStrategy,verticalAlignment)",
        },
      },
      {
        repeatCell: {
          range: { sheetId: summarySheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 },
          cell: { userEnteredFormat: { backgroundColor: headerBlue, textFormat: { fontFamily: "Arial", fontSize: 10, bold: true, foregroundColor: white }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
        },
      }
    );
  }
  Array.from(vendorRows).forEach(([title, rows]) => {
    const sheetId = sheetIdByTitle.get(title);
    if (sheetId === undefined) return;
    const totalRowIndex = rows.length - 1;
    const linkedDateColumn = rows[0].length - 1;
    const columnCount = linkedDateColumn + 1;
    formatRequests.push(
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: rows.length, startColumnIndex: 0, endColumnIndex: columnCount },
          cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontFamily: "Arial", fontSize: 10, bold: false, foregroundColor: black }, verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } },
          fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)",
        },
      },
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columnCount },
          cell: { userEnteredFormat: { backgroundColor: headerBlue, textFormat: { fontFamily: "Arial", fontSize: 10, bold: true, foregroundColor: white }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
        },
      },
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: totalRowIndex, startColumnIndex: linkedDateColumn, endColumnIndex: columnCount },
          cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd-mmm-yyyy" }, horizontalAlignment: "CENTER" } },
          fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
        },
      },
      {
        repeatCell: {
          range: { sheetId, startRowIndex: totalRowIndex, endRowIndex: totalRowIndex + 1, startColumnIndex: 0, endColumnIndex: columnCount },
          cell: { userEnteredFormat: { backgroundColor: totalBlue, textFormat: { fontFamily: "Arial", fontSize: 10, bold: true, foregroundColor: black }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP", borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder } } },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy,borders)",
        },
      },
      {
        mergeCells: {
          range: { sheetId, startRowIndex: totalRowIndex, endRowIndex: totalRowIndex + 1, startColumnIndex: 0, endColumnIndex: 6 },
          mergeType: "MERGE_ALL",
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 42 },
          fields: "pixelSize",
        },
      }
    );
    if (totalRowIndex > 3) {
      formatRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: totalRowIndex - 2, startColumnIndex: 3, endColumnIndex: 4 },
          cell: { userEnteredFormat: { textFormat: { foregroundColor: linkBlue } } },
          fields: "userEnteredFormat.textFormat.foregroundColor",
        },
      });
    }
    if (linkedDateColumn > 6) {
      formatRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: rows.length, startColumnIndex: 6, endColumnIndex: linkedDateColumn },
          cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "0.00" }, horizontalAlignment: "RIGHT" } },
          fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
        },
      });
    }
    [130, 180, 180, 260, 210, 150].forEach((pixelSize, column) => {
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS", startIndex: column, endIndex: column + 1 },
          properties: { pixelSize },
          fields: "pixelSize",
        },
      });
    });
    if (linkedDateColumn > 6) {
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS", startIndex: 6, endIndex: linkedDateColumn },
          properties: { pixelSize: 165 },
          fields: "pixelSize",
        },
      });
    }
    formatRequests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: linkedDateColumn, endIndex: columnCount },
        properties: { pixelSize: 125 },
        fields: "pixelSize",
      },
    });
  });
  if (formatRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });
  }

  return {
    status: "updated",
    vendors: vendors.length,
    months: monthlyCaches.length,
    rows: totalRows,
  };
}

export async function syncAllConfiguredVendorGoogleSheets() {
  const [scopeUserIds, users] = await Promise.all([
    getConfiguredVendorGoogleSheetScopeIds(),
    kv.get<StoredUser[]>(USERS_KEY).then((value) => value || []),
  ]);
  let admin: VendorSheetSyncResult | { status: "failed" };
  try {
    admin = await syncVendorGoogleSheet();
  } catch (error) {
    console.error("[Vendor Sheets] Admin sync failed:", error);
    admin = { status: "failed" };
  }
  const companies = [];

  for (const scopeUserId of scopeUserIds) {
    const company = users.find(
      (user) =>
        user.id === scopeUserId &&
        user.role === "company" &&
        user.status === "active"
    );
    if (!company) continue;

    const scopedUsers = users.filter(
      (user) =>
        user.status === "active" &&
        (user.id === scopeUserId || user.parentId === scopeUserId)
    );
    const channelIds = new Set(scopedUsers.flatMap((user) => user.channels || []));
    try {
      companies.push({
        scopeUserId,
        companyName: company.name,
        ...(await syncVendorGoogleSheet({ scopeUserId, channelIds })),
      });
    } catch (error) {
      console.error(`[Vendor Sheets] Company sync failed for ${scopeUserId}:`, error);
      companies.push({
        scopeUserId,
        companyName: company.name,
        status: "failed" as const,
      });
    }
  }

  return { admin, companies };
}
