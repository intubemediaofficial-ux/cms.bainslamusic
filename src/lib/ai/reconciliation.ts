import "server-only";

import type { AiDashboardContext } from "@/lib/ai/context";
import { getVendorGoogleSheetConfig } from "@/lib/vendor-google-sheet-config";
import {
  getVendorSheetChannelMetadata,
  vendorSheetChannelMetadataKey,
} from "@/lib/vendor-sheet-metadata";
import {
  getVendorAssignments,
  getVendors,
  getVendorsForOwner,
} from "@/lib/vendors";

export interface SheetReconciliationIssue {
  id: string;
  severity: "warning" | "info";
  type: "missing_metadata" | "client_name" | "channel_name" | "network_name";
  vendorName: string;
  channelId: string;
  channelTitle: string;
  dashboardValue: string;
  sheetValue: string;
  message: string;
}

export interface SheetReconciliationResult {
  configured: boolean;
  vendorCount: number;
  assignedChannelCount: number;
  matchedChannelCount: number;
  historicalRowCount: number;
  issueCount: number;
  score: number;
  issues: SheetReconciliationIssue[];
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function buildSheetReconciliation(
  context: AiDashboardContext
): Promise<SheetReconciliationResult> {
  const scopeUserId = context.access.vendorOwnerUserId || undefined;
  const [config, allVendors, allAssignments, metadata] = await Promise.all([
    getVendorGoogleSheetConfig(scopeUserId),
    getVendors(),
    getVendorAssignments(),
    getVendorSheetChannelMetadata(scopeUserId),
  ]);
  const vendors = getVendorsForOwner(allVendors, context.access.vendorOwnerUserId);
  const vendorNames = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
  const allowedChannelIds = new Set(
    context.access.selectedUsers.flatMap((user) => user.channels || [])
  );
  const assignments = allAssignments.filter(
    (assignment) =>
      allowedChannelIds.has(assignment.channelId) &&
      vendorNames.has(assignment.vendorId)
  );
  const activeKeys = new Set(
    assignments.map((assignment) =>
      vendorSheetChannelMetadataKey(assignment.vendorId, assignment.channelId)
    )
  );
  const metadataByKey = new Map(
    metadata.map((record) => [
      vendorSheetChannelMetadataKey(record.vendorId, record.channelId),
      record,
    ])
  );
  const channelInsights = new Map(
    context.insights.channels.map((channel) => [channel.channelId, channel])
  );
  const ownerByChannel = new Map<string, string>();
  const networkByChannel = new Map<string, string>();
  for (const user of context.access.selectedUsers) {
    for (const channelId of user.channels || []) ownerByChannel.set(channelId, user.name);
    for (const assignment of user.channelNetworks || []) {
      networkByChannel.set(assignment.channelId, assignment.networkName);
    }
  }

  const issues: SheetReconciliationIssue[] = [];
  let matchedChannelCount = 0;
  for (const assignment of assignments) {
    const vendorName = vendorNames.get(assignment.vendorId) || "Unknown vendor";
    const channel = channelInsights.get(assignment.channelId);
    const channelTitle = channel?.channelTitle || assignment.channelId;
    const key = vendorSheetChannelMetadataKey(
      assignment.vendorId,
      assignment.channelId
    );
    const record = metadataByKey.get(key);
    if (!record) {
      issues.push({
        id: `missing-${key}`,
        severity: "warning",
        type: "missing_metadata",
        vendorName,
        channelId: assignment.channelId,
        channelTitle,
        dashboardValue: "Assigned",
        sheetValue: "Not imported",
        message: `${channelTitle} is assigned to ${vendorName}, but no editable Sheet metadata has been imported yet.`,
      });
      continue;
    }

    const channelIssuesBefore = issues.length;
    const ownerName = ownerByChannel.get(assignment.channelId) || "";
    const networkName = networkByChannel.get(assignment.channelId) || "";
    if (ownerName && record.clientName && normalize(ownerName) !== normalize(record.clientName)) {
      issues.push({
        id: `client-${key}`,
        severity: "info",
        type: "client_name",
        vendorName,
        channelId: assignment.channelId,
        channelTitle,
        dashboardValue: ownerName,
        sheetValue: record.clientName,
        message: `${channelTitle} has different Client names in the dashboard and Sheet metadata.`,
      });
    }
    if (record.channelName && normalize(channelTitle) !== normalize(record.channelName)) {
      issues.push({
        id: `channel-${key}`,
        severity: "info",
        type: "channel_name",
        vendorName,
        channelId: assignment.channelId,
        channelTitle,
        dashboardValue: channelTitle,
        sheetValue: record.channelName,
        message: `${channelTitle} has an editable Sheet channel name that differs from the cache title.`,
      });
    }
    if (networkName && record.networkName && normalize(networkName) !== normalize(record.networkName)) {
      issues.push({
        id: `network-${key}`,
        severity: "info",
        type: "network_name",
        vendorName,
        channelId: assignment.channelId,
        channelTitle,
        dashboardValue: networkName,
        sheetValue: record.networkName,
        message: `${channelTitle} has different Network values in the dashboard and Sheet metadata.`,
      });
    }
    if (issues.length === channelIssuesBefore) matchedChannelCount += 1;
  }

  const historicalRowCount = metadata.filter(
    (record) =>
      vendorNames.has(record.vendorId) &&
      !activeKeys.has(vendorSheetChannelMetadataKey(record.vendorId, record.channelId))
  ).length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const infoCount = issues.length - warningCount;
  const score = assignments.length
    ? Math.max(
        0,
        Math.round(
          100 -
            (warningCount * 20 + infoCount * 5) /
              Math.max(1, assignments.length)
        )
      )
    : 100;

  return {
    configured: Boolean(config),
    vendorCount: vendors.length,
    assignedChannelCount: assignments.length,
    matchedChannelCount,
    historicalRowCount,
    issueCount: issues.length,
    score,
    issues: issues.slice(0, 100),
  };
}
