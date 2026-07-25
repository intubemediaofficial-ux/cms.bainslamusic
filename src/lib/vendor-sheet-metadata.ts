import "server-only";

import { kv } from "@/lib/redis";

const METADATA_PREFIX = "cms_vendor_sheet_metadata:";

export interface VendorSheetChannelMetadata {
  vendorId: string;
  channelId: string;
  clientName: string;
  channelName: string;
  networkName: string;
  linkedDate: string;
  updatedAt: string;
}

function metadataKey(scopeUserId?: string): string {
  return `${METADATA_PREFIX}${scopeUserId || "admin"}`;
}

export function vendorSheetChannelMetadataKey(
  vendorId: string,
  channelId: string
): string {
  return `${vendorId}:${channelId}`;
}

export async function getVendorSheetChannelMetadata(
  scopeUserId?: string
): Promise<VendorSheetChannelMetadata[]> {
  return (await kv.get<VendorSheetChannelMetadata[]>(metadataKey(scopeUserId))) || [];
}

export async function saveVendorSheetChannelMetadata(
  records: VendorSheetChannelMetadata[],
  scopeUserId?: string
): Promise<void> {
  if (records.length === 0) return;
  const current = await getVendorSheetChannelMetadata(scopeUserId);
  const merged = new Map(
    current.map((record) => [
      vendorSheetChannelMetadataKey(record.vendorId, record.channelId),
      record,
    ])
  );
  for (const record of records) {
    merged.set(
      vendorSheetChannelMetadataKey(record.vendorId, record.channelId),
      record
    );
  }
  await kv.set(metadataKey(scopeUserId), Array.from(merged.values()));
}
