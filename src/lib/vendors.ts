import { kv } from "@/lib/redis";

const VENDORS_KEY = "cms_vendors";
const ASSIGNMENTS_KEY = "cms_channel_vendor_assignments";
const USERS_KEY = "bainsla_users";
const OWNER_SCOPE_MIGRATION_KEY = "cms_vendor_owner_scope_version";

export interface Vendor {
  id: string;
  name: string;
  createdByUserId: string | null;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelVendorAssignment {
  channelId: string;
  vendorId: string;
  assignedByEmail: string;
  assignedAt: string;
  updatedAt: string;
}

export interface VendorOwnerUser {
  id: string;
  role?: string;
  parentId?: string;
}

export function normalizeLegacyVendorOwnerScopes(
  vendors: Vendor[],
  users: VendorOwnerUser[]
): Vendor[] {
  const usersById = new Map(users.map((user) => [user.id, user]));
  return vendors.map((vendor) => {
    if (vendor.createdByUserId === null) return vendor;
    if (vendor.createdByUserId === undefined) {
      return { ...vendor, createdByUserId: null };
    }

    const owner = usersById.get(vendor.createdByUserId);
    if (!owner) return vendor;
    const ownerUserId = owner.role === "company"
      ? owner.id
      : owner.parentId || null;
    return ownerUserId === vendor.createdByUserId
      ? vendor
      : { ...vendor, createdByUserId: ownerUserId };
  });
}

export function getVendorsForOwner(
  vendors: Vendor[],
  ownerUserId: string | null
): Vendor[] {
  return vendors.filter((vendor) =>
    ownerUserId
      ? vendor.createdByUserId === ownerUserId
      : vendor.createdByUserId === null || vendor.createdByUserId === undefined
  );
}

export function removeScopedChannelVendorAssignments(
  assignments: ChannelVendorAssignment[],
  channelIds: Set<string>,
  scopedVendorIds: Set<string>
): ChannelVendorAssignment[] {
  return assignments.filter(
    (assignment) =>
      !channelIds.has(assignment.channelId) ||
      !scopedVendorIds.has(assignment.vendorId)
  );
}

export async function getVendors(): Promise<Vendor[]> {
  const [vendors, migrationVersion] = await Promise.all([
    kv.get<Vendor[]>(VENDORS_KEY).then((value) => value || []),
    kv.get<number>(OWNER_SCOPE_MIGRATION_KEY),
  ]);
  if (migrationVersion === 1) return vendors;

  const users = (await kv.get<VendorOwnerUser[]>(USERS_KEY)) || [];
  if (users.length === 0 && vendors.some((vendor) => vendor.createdByUserId)) {
    return vendors;
  }

  const normalized = normalizeLegacyVendorOwnerScopes(vendors, users);
  if (normalized.some((vendor, index) => vendor !== vendors[index])) {
    await kv.set(VENDORS_KEY, normalized);
  }
  await kv.set(OWNER_SCOPE_MIGRATION_KEY, 1);
  return normalized;
}

export async function saveVendors(vendors: Vendor[]): Promise<void> {
  await kv.set(VENDORS_KEY, vendors);
}

export async function getVendorAssignments(): Promise<ChannelVendorAssignment[]> {
  return (await kv.get<ChannelVendorAssignment[]>(ASSIGNMENTS_KEY)) || [];
}

export async function saveVendorAssignments(
  assignments: ChannelVendorAssignment[]
): Promise<void> {
  await kv.set(ASSIGNMENTS_KEY, assignments);
}

export async function clearChannelVendorAssignments(channelIds: string[]): Promise<void> {
  if (channelIds.length === 0) return;
  const ids = new Set(channelIds);
  const assignments = await getVendorAssignments();
  const next = assignments.filter((assignment) => !ids.has(assignment.channelId));
  if (next.length !== assignments.length) await saveVendorAssignments(next);
}
