import { kv } from "@/lib/redis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revokeChannelAuthorization } from "@/lib/channel-tokens";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const NETWORKS_KEY = "bainsla_networks";
const USERS_KEY = "bainsla_users";

export interface Network {
  id: string;
  name: string;
  revenueSharePercent: number;
  createdDate: string;
}

interface NetworkReference {
  networkId: string;
  networkName: string;
}

interface StoredNetworkUser {
  id: string;
  name: string;
  email: string;
  parentId?: string;
  networks?: NetworkReference[];
  channelNetworks?: Array<NetworkReference & { channelId: string }>;
  customNetworks?: string[];
}

interface CustomNetwork {
  id: string;
  name: string;
  createdBy: string;
  createdByEmail: string;
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

// Deprecated network names to auto-remove (keep only "WMG - MUSIC")
const DEPRECATED_NETWORK_NAMES = ["T-Series", "Sony Music", "InTubeMedia", "Other"];

async function getNetworks(): Promise<Network[]> {
  try {
    const networks = await kv.get<Network[]>(NETWORKS_KEY);
    if (!networks) return [];
    // Auto-cleanup: remove deprecated networks from KV
    const cleaned = networks.filter((n) => !DEPRECATED_NETWORK_NAMES.includes(n.name));
    if (cleaned.length !== networks.length) {
      await kv.set(NETWORKS_KEY, cleaned);
    }
    return cleaned;
  } catch (error) {
    console.error("[Networks] Failed to read from KV:", error);
    return [];
  }
}

async function saveNetworks(networks: Network[]): Promise<boolean> {
  try {
    await kv.set(NETWORKS_KEY, networks);
    return true;
  } catch (error) {
    console.error("[Networks] Failed to save to KV:", error);
    return false;
  }
}

function normalizeNetworkName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function customNetworkId(email: string, name: string): string {
  return `custom-${crypto
    .createHash("sha256")
    .update(`${email.toLowerCase()}:${normalizeNetworkName(name)}`)
    .digest("hex")}`;
}

function referenceMatches(
  reference: NetworkReference,
  target: { id: string; name: string }
): boolean {
  const legacyNameOnly =
    !reference.networkId ||
    reference.networkId.startsWith("name:") ||
    reference.networkId.startsWith("custom-name:");
  return (
    reference.networkId === target.id ||
    (legacyNameOnly &&
      normalizeNetworkName(reference.networkName) === normalizeNetworkName(target.name))
  );
}

async function invalidateAffectedChannels(channelIds: string[]): Promise<number> {
  const results = await Promise.allSettled(
    channelIds.map((channelId) => revokeChannelAuthorization(channelId))
  );
  return results.filter((result) => result.status === "rejected").length;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const networks = await getNetworks();

  // For admin: also return all user-created custom networks
  const url = new URL(request.url);
  if (url.searchParams.get("include_custom") === "true" && ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    try {
      const users = await kv.get<StoredNetworkUser[]>(USERS_KEY);
      const allCustom: CustomNetwork[] = [];
      if (users) {
        for (const user of users) {
          if (user.customNetworks?.length) {
            for (const name of user.customNetworks) {
              allCustom.push({
                id: customNetworkId(user.email, name),
                name,
                createdBy: user.name,
                createdByEmail: user.email,
              });
            }
          }
        }
      }
      return Response.json({ data: networks, customNetworks: allCustom });
    } catch {
      return Response.json({ data: networks, customNetworks: [] });
    }
  }

  return Response.json({ data: networks });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, revenueSharePercent } = body;

    if (!name) {
      return Response.json({ error: "Network name is required" }, { status: 400 });
    }

    const networks = await getNetworks();
    const exists = networks.some((n) => n.name.toLowerCase() === name.toLowerCase().trim());
    if (exists) {
      return Response.json({ error: "Network with this name already exists" }, { status: 409 });
    }

    const newNetwork: Network = {
      id: crypto.randomUUID(),
      name: name.trim(),
      revenueSharePercent: Number(revenueSharePercent) || 0,
      createdDate: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    };

    networks.push(newNetwork);
    const saved = await saveNetworks(networks);
    if (!saved) {
      return Response.json({ error: "Failed to save network" }, { status: 500 });
    }

    return Response.json({ data: newNetwork }, { status: 201 });
  } catch (error) {
    console.error("[Networks] Error creating network:", error);
    return Response.json({ error: "Failed to create network" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, revenueSharePercent } = body;

    if (!id) {
      return Response.json({ error: "Network ID is required" }, { status: 400 });
    }

    const networks = await getNetworks();
    const idx = networks.findIndex((n) => n.id === id);
    if (idx === -1) {
      return Response.json({ error: "Network not found" }, { status: 404 });
    }

    if (name) networks[idx].name = name.trim();
    if (revenueSharePercent !== undefined) networks[idx].revenueSharePercent = Number(revenueSharePercent);

    const saved = await saveNetworks(networks);
    if (!saved) {
      return Response.json({ error: "Failed to update network" }, { status: 500 });
    }

    return Response.json({ data: networks[idx] });
  } catch (error) {
    console.error("[Networks] Error updating network:", error);
    return Response.json({ error: "Failed to update network" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Network ID is required" }, { status: 400 });
    }

    const [networks, storedUsers] = await Promise.all([
      getNetworks(),
      kv.get<StoredNetworkUser[]>(USERS_KEY),
    ]);
    const users = storedUsers || [];
    const originalUsers = structuredClone(users);
    const network = networks.find((item) => item.id === id);
    let customOwner: StoredNetworkUser | undefined;
    let customName = "";

    if (!network) {
      for (const user of users) {
        const matchedName = (user.customNetworks || []).find(
          (name) => customNetworkId(user.email, name) === id
        );
        if (matchedName) {
          customOwner = user;
          customName = matchedName;
          break;
        }
      }
    }

    if (!network && !customOwner) {
      return Response.json({ error: "Network not found" }, { status: 404 });
    }

    const target = network
      ? { id: network.id, name: network.name }
      : { id, name: customName };
    const affectedChannelIds = new Set<string>();
    const customOwnerIds = new Set(
      customOwner
        ? [
            customOwner.id,
            ...users
              .filter((user) => user.parentId === customOwner.id)
              .map((user) => user.id),
          ]
        : []
    );

    for (const user of users) {
      const canMatchCustom = !customOwner || customOwnerIds.has(user.id);
      user.networks = (user.networks || []).filter(
        (reference) => !((network || canMatchCustom) && referenceMatches(reference, target))
      );
      user.channelNetworks = (user.channelNetworks || []).filter((reference) => {
        const matches = (network || canMatchCustom) && referenceMatches(reference, target);
        if (matches) affectedChannelIds.add(reference.channelId);
        return !matches;
      });
      if (customOwner && user.id === customOwner.id) {
        user.customNetworks = (user.customNetworks || []).filter(
          (name) => normalizeNetworkName(name) !== normalizeNetworkName(customName)
        );
      }
    }

    const nextNetworks = network
      ? networks.filter((item) => item.id !== network.id)
      : networks;
    const usersSaved = await kv.set(USERS_KEY, users).then(() => true).catch((error) => {
      console.error("[Networks] Failed to save user cleanup:", error);
      return false;
    });
    if (!usersSaved) {
      return Response.json({ error: "Failed to delete network safely" }, { status: 500 });
    }
    const networksSaved = await saveNetworks(nextNetworks);
    if (!networksSaved) {
      await kv.set(USERS_KEY, originalUsers).catch((error) => {
        console.error("[Networks] Failed to roll back user cleanup:", error);
      });
      return Response.json({ error: "Failed to delete network safely" }, { status: 500 });
    }

    const channelIds = Array.from(affectedChannelIds);
    const revocationFailures = await invalidateAffectedChannels(channelIds);

    return Response.json({
      data: {
        success: true,
        deletedNetwork: target.name,
        affectedChannels: channelIds.length,
        revocationFailures,
      },
    });
  } catch (error) {
    console.error("[Networks] Error deleting network:", error);
    return Response.json({ error: "Failed to delete network" }, { status: 500 });
  }
}
