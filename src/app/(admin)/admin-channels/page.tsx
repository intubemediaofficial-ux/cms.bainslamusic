"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  ExternalLink,
  Shield,
  Radio,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  DollarSign,
  Eye,
  MoreVertical,
  Trash2,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Key,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  channels: string[];
  pendingChannels?: string[];
  channelNetworks?: ChannelNetworkAssignment[];
  status: "active" | "inactive";
  joinedDate: string;
  category: string;
}

interface YouTubeChannel {
  id?: string | null;
  snippet?: {
    title?: string | null;
    customUrl?: string | null;
    thumbnails?: {
      default?: { url?: string | null } | null;
      medium?: { url?: string | null } | null;
    } | null;
  } | null;
  statistics?: {
    subscriberCount?: string | null;
    videoCount?: string | null;
    viewCount?: string | null;
  } | null;
}

const CLIENTS_KEY = "bainsla_admin_clients";
const PER_PAGE_OPTIONS = [10, 25, 50, 100];

function getClients(): Client[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CLIENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

interface VendorOption {
  id: string;
  name: string;
}

interface VendorAssignment {
  channelId: string;
  vendorId: string;
}

interface NetworkOption {
  id: string;
  name: string;
  revenueSharePercent: number;
}

interface ChannelNetworkAssignment {
  channelId: string;
  networkId: string;
  networkName: string;
  revenueSharePercent: number;
}

type ChannelRow = {
  channelId: string;
  name: string;
  thumbnail: string;
  subscribers: number;
  videos: number;
  views: number;
  revenue: number;
  clientId: string;
  clientName: string;
  category: string;
  tokenStatus?: string;
  approvalStatus?: "approved" | "pending";
};

export default function AdminChannelsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAuthenticated = status === "authenticated" && !!session?.user?.email;

  const [clients, setClients] = useState<Client[]>([]);
  const [channelDataMap, setChannelDataMap] = useState<Record<string, YouTubeChannel>>({});
  const [channelRevenueMap, setChannelRevenueMap] = useState<Record<string, number>>({});
  const [channelClientMap, setChannelClientMap] = useState<Record<string, string>>({}); // channelId → client name
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [clientFilter, setClientFilter] = useState("");
  const [tokenFilter, setTokenFilter] = useState<string>("all");
  const [tokenStatuses, setTokenStatuses] = useState<Record<string, string>>({});
  const [selectedChannel, setSelectedChannel] = useState<ChannelRow | null>(null);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingActionLoading, setPendingActionLoading] = useState<string | null>(null);
  const [validatingChannelId, setValidatingChannelId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [revenuePeriod, setRevenuePeriod] = useState<string>("cached");
  const [periodRevenueMap, setPeriodRevenueMap] = useState<Record<string, number>>({});
  const [periodRevenueLoading, setPeriodRevenueLoading] = useState(false);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [channelVendorIds, setChannelVendorIds] = useState<Record<string, string>>({});
  const [vendorSavingId, setVendorSavingId] = useState<string | null>(null);
  const [networkOptions, setNetworkOptions] = useState<NetworkOption[]>([]);
  const [networkSavingId, setNetworkSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  useEffect(() => {
    // Fetch clients from API (KV) for admin, fallback to localStorage
    const fetchClients = async () => {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const json = await res.json();
          if (json.data?.length) {
            setClients(json.data);
            return;
          }
        }
      } catch { /* fallback below */ }
      setClients(getClients());
    };
    if (status === "authenticated" && session?.user?.role === "admin") {
      fetchClients();
    } else {
      queueMicrotask(() => setClients(getClients()));
    }
  }, [status, session]);

  const fetchVendors = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch("/api/vendors?action=list", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to load vendors");
      setVendors(json.data?.vendors || []);
      setChannelVendorIds(
        Object.fromEntries(
          (json.data?.assignments || []).map((assignment: VendorAssignment) => [
            assignment.channelId,
            assignment.vendorId,
          ])
        )
      );
    } catch {
      setVendors([]);
      setChannelVendorIds({});
    }
  }, [isAuthenticated]);

  const fetchNetworks = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch("/api/networks", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to load networks");
      setNetworkOptions(
        (json.data || []).sort((a: NetworkOption, b: NetworkOption) => a.name.localeCompare(b.name))
      );
    } catch {
      setNetworkOptions([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchVendors();
      void fetchNetworks();
    });
  }, [fetchNetworks, fetchVendors]);

  const handleVendorAssignment = useCallback(async (channelId: string, vendorId: string) => {
    setVendorSavingId(channelId);
    try {
      const response = await fetch("/api/vendors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", channelId, vendorId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to assign vendor");
      setChannelVendorIds((current) => ({ ...current, [channelId]: vendorId }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to assign vendor");
    } finally {
      setVendorSavingId(null);
    }
  }, []);

  const handleNetworkAssignment = useCallback(async (
    userId: string,
    channelId: string,
    networkName: string
  ) => {
    if (!userId) {
      window.alert("Channel owner could not be found");
      return;
    }
    setNetworkSavingId(channelId);
    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "assign_channel_network",
          userId,
          channelId,
          networkName,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to assign network");
      const nextAssignment = json.data?.network as ChannelNetworkAssignment | null;
      setClients((current) => current.map((client) => {
        if (client.id !== userId) return client;
        const nextAssignments = (client.channelNetworks || []).filter(
          (assignment) => assignment.channelId !== channelId
        );
        if (nextAssignment) nextAssignments.push(nextAssignment);
        return { ...client, channelNetworks: nextAssignments };
      }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to assign network");
    } finally {
      setNetworkSavingId(null);
    }
  }, []);

  // Fetch token statuses for all channels (KV + cached)
  useEffect(() => {
    if (!isAuthenticated) return;
    const kvIds = clients.flatMap((c) => c.channels);
    const cachedIds = Object.keys(channelDataMap);
    const allIdsSet = new Set([...kvIds, ...cachedIds].filter((id) => !id.startsWith("UCtest") && id !== "test"));
    const allIds = Array.from(allIdsSet);
    if (allIds.length === 0) return;
    const fetchStatuses = async () => {
      try {
        const res = await fetch(`/api/channel-tokens?action=bulkTokenStatus&channelIds=${allIds.join(",")}`);
        if (res.ok) {
          const json = await res.json();
          const statuses: Record<string, string> = {};
          for (const [id, val] of Object.entries(json.data?.statuses || {})) {
            statuses[id] = (val as { status: string }).status;
          }
          setTokenStatuses(statuses);
        }
      } catch { /* silent */ }
    };
    fetchStatuses();
  }, [clients, channelDataMap, isAuthenticated]);

  const loadCachedChannels = useCallback(async () => {
    const newMap: Record<string, YouTubeChannel> = {};
    const revMap: Record<string, number> = {};
    const clientMap: Record<string, string> = {};

    for (const client of clients) {
      for (const channelId of client.channels) {
        newMap[channelId] = {
          id: channelId,
          snippet: { title: channelId, thumbnails: { default: { url: "" }, medium: { url: "" } } },
          statistics: { subscriberCount: "0", videoCount: "0", viewCount: "0" },
        };
        revMap[channelId] = 0;
        clientMap[channelId] = client.name;
      }
    }

    try {
      const cachedRes = await fetch("/api/client-data?action=getAllCachedData");
      if (cachedRes.ok) {
        const cachedJson = await cachedRes.json();
        for (const cachedClient of cachedJson.data || []) {
          const clientEmail = (cachedClient.email || "").toLowerCase();
          const matchedClient = clients.find(
            (client) => client.email.toLowerCase() === clientEmail
          );
          const clientName = matchedClient?.name || cachedClient.email || "Unknown";

          for (const channel of cachedClient.channels || []) {
            newMap[channel.channelId] = {
              id: channel.channelId,
              snippet: {
                title: channel.channelTitle || channel.channelId,
                thumbnails: {
                  default: { url: channel.thumbnail || "" },
                  medium: { url: channel.thumbnail || "" },
                },
              },
              statistics: {
                subscriberCount: String(channel.subscribers || 0),
                videoCount: String(channel.videoCount || 0),
                viewCount: String(channel.views || 0),
              },
            };
            revMap[channel.channelId] = channel.estimatedRevenue || 0;
            clientMap[channel.channelId] = clientName;
          }
        }
      }
    } catch {
      // Assigned channel IDs still render from the server-authoritative user list.
    } finally {
      setChannelDataMap(newMap);
      setChannelRevenueMap(revMap);
      setChannelClientMap(clientMap);
      setLoadingChannels(false);
    }
  }, [clients]);

  useEffect(() => {
    if (!isAuthenticated) return;
    queueMicrotask(() => {
      setLoadingChannels(true);
      void loadCachedChannels();
    });
  }, [isAuthenticated, loadCachedChannels]);

  const refreshChannelStats = useCallback(async () => {
    setLoadingChannels(true);
    try {
      await fetch("/api/sync-client-data?mode=stats");
    } finally {
      await loadCachedChannels();
      setLastRefresh(new Date());
    }
  }, [loadCachedChannels]);

  // Fetch revenue for specific month/period when selected
  useEffect(() => {
    if (revenuePeriod === "cached" || !isAuthenticated) return;
    const allIds = clients.flatMap((c) => c.channels).filter((id) => !id.startsWith("UCtest") && id !== "test");
    if (allIds.length === 0) return;

    let startDate: string;
    let endDate: string;

    if (revenuePeriod.match(/^\d{4}-\d{2}$/)) {
      // Month filter
      const [year, month] = revenuePeriod.split("-").map(Number);
      startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const now = new Date();
      const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
      const endDay = isCurrentMonth ? now.getDate() : lastDay;
      endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    } else {
      const numDays = parseInt(revenuePeriod) || 28;
      const endD = new Date();
      endDate = `${endD.getFullYear()}-${String(endD.getMonth()+1).padStart(2,"0")}-${String(endD.getDate()).padStart(2,"0")}`;
      const startD = new Date();
      startD.setDate(startD.getDate() - numDays);
      startDate = `${startD.getFullYear()}-${String(startD.getMonth()+1).padStart(2,"0")}-${String(startD.getDate()).padStart(2,"0")}`;
    }

    queueMicrotask(() => {
      setPeriodRevenueLoading(true);
      void (async () => {
        try {
          const monthlyQuery = revenuePeriod.match(/^\d{4}-\d{2}$/) ? `&monthly=${revenuePeriod}` : "";
          const res = await fetch(`/api/youtube?action=dashboardFull&channelIds=${encodeURIComponent(allIds.join(","))}&startDate=${startDate}&endDate=${endDate}${monthlyQuery}`);
          if (res.ok) {
            const json = await res.json();
            const crMap = json.data?.channelRevenueMap || {};
            const newRevMap: Record<string, number> = {};
            for (const [cid, val] of Object.entries(crMap)) {
              newRevMap[cid] = (val as { revenue: number }).revenue || 0;
            }
            setPeriodRevenueMap(newRevMap);
          }
        } catch { /* silent */ }
        setPeriodRevenueLoading(false);
      })();
    });
  }, [revenuePeriod, isAuthenticated, clients]);

  const allChannelRows: ChannelRow[] = useMemo(() => {
    const rows: ChannelRow[] = [];
    const seenIds = new Set<string>();
    for (const client of clients) {
      // Include both approved and pending channels
      const pendingSet = new Set(client.pendingChannels || []);
      const allClientChannels = [...client.channels, ...(client.pendingChannels || [])];
      for (const chId of allClientChannels) {
        if (seenIds.has(chId)) continue;
        // Skip test/placeholder channel IDs if we have real cached data
        if ((chId.startsWith("UCtest") || chId === "test") && Object.keys(channelDataMap).some((k) => !k.startsWith("UCtest") && k !== "test")) {
          continue;
        }
        seenIds.add(chId);
        const data = channelDataMap[chId];
        rows.push({
          channelId: chId,
          name: data?.snippet?.title || chId,
          thumbnail: data?.snippet?.thumbnails?.medium?.url || data?.snippet?.thumbnails?.default?.url || "",
          subscribers: Number(data?.statistics?.subscriberCount || 0),
          videos: Number(data?.statistics?.videoCount || 0),
          views: Number(data?.statistics?.viewCount || 0),
          revenue: (revenuePeriod !== "cached" ? periodRevenueMap[chId] : channelRevenueMap[chId]) || 0,
          clientId: client.id,
          clientName: client.name,
          category: client.category,
          tokenStatus: tokenStatuses[chId] || "none",
          approvalStatus: pendingSet.has(chId) ? "pending" : "approved",
        });
      }
    }
    // Also include cached channels that aren't yet in any client's KV channel list
    for (const [chId, data] of Object.entries(channelDataMap)) {
      if (seenIds.has(chId)) continue;
      if (chId.startsWith("UCtest") || chId === "test") continue;
      // Find client name from channelClientMap (mapped from cached data email)
      const cachedClientName = channelClientMap[chId] || "";
      // Try to match to a known client
      const matchedClient = clients.find((c) => c.name === cachedClientName);
      rows.push({
        channelId: chId,
        name: data?.snippet?.title || chId,
        thumbnail: data?.snippet?.thumbnails?.medium?.url || data?.snippet?.thumbnails?.default?.url || "",
        subscribers: Number(data?.statistics?.subscriberCount || 0),
        videos: Number(data?.statistics?.videoCount || 0),
        views: Number(data?.statistics?.viewCount || 0),
        revenue: (revenuePeriod !== "cached" ? periodRevenueMap[chId] : channelRevenueMap[chId]) || 0,
        clientId: matchedClient?.id || "",
        clientName: cachedClientName || "Unknown",
        category: matchedClient?.category || "-",
        tokenStatus: tokenStatuses[chId] || "none",
      });
    }
    return rows;
  }, [clients, channelDataMap, channelRevenueMap, channelClientMap, tokenStatuses, revenuePeriod, periodRevenueMap]);

  const filteredChannels = useMemo(() => {
    let result = allChannelRows;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.channelId.toLowerCase().includes(q) ||
          c.clientName.toLowerCase().includes(q)
      );
    }

    if (clientFilter) {
      result = result.filter((c) => c.clientName === clientFilter);
    }

    if (tokenFilter !== "all") {
      result = result.filter((c) => {
        if (tokenFilter === "valid") return c.tokenStatus === "valid";
        if (tokenFilter === "expired") return c.tokenStatus === "expired";
        if (tokenFilter === "none") return c.tokenStatus === "none" || !c.tokenStatus;
        return true;
      });
    }

    // Sort: approved channels first, then pending
    result.sort((a, b) => {
      if (a.approvalStatus === "approved" && b.approvalStatus === "pending") return -1;
      if (a.approvalStatus === "pending" && b.approvalStatus === "approved") return 1;
      return 0;
    });

    return result;
  }, [allChannelRows, searchQuery, clientFilter, tokenFilter]);

  const totalPages = Math.ceil(filteredChannels.length / perPage);
  const pageChannels = filteredChannels.slice((currentPage - 1) * perPage, currentPage * perPage);

  const handleValidateToken = async (channelId: string, channelName: string) => {
    const authorizationWindow = window.open("about:blank", "_blank");
    setValidatingChannelId(channelId);
    try {
      const response = await fetch(
        `/api/channel-tokens?action=generateInviteLink&channelId=${encodeURIComponent(channelId)}&channelTitle=${encodeURIComponent(channelName)}`,
        { cache: "no-store" }
      );
      const json = await response.json();
      if (!response.ok || !json.data?.oauthUrl) throw new Error("Authorization link failed");

      if (authorizationWindow) {
        authorizationWindow.opener = null;
        authorizationWindow.location.href = json.data.oauthUrl;
      } else {
        window.location.assign(json.data.oauthUrl);
      }
      setActiveActionMenu(null);
      setMenuPosition(null);
    } catch {
      authorizationWindow?.close();
      alert("Token validation link नहीं बना। दोबारा कोशिश करें।");
    } finally {
      setValidatingChannelId(null);
    }
  };

  const handleDeleteChannel = async (channelId: string, clientName: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(
        `/api/channel-tokens?action=removeChannel&channelId=${encodeURIComponent(channelId)}`,
        { method: "DELETE", cache: "no-store" }
      );
      if (!response.ok) throw new Error("Channel removal failed");

      setClients((previous) =>
        previous.map((client) =>
          client.name === clientName ||
          client.email === clientName ||
          client.channels.includes(channelId) ||
          (client.pendingChannels || []).includes(channelId)
            ? {
                ...client,
                channels: client.channels.filter((id) => id !== channelId),
                pendingChannels: (client.pendingChannels || []).filter((id) => id !== channelId),
              }
            : client
        )
      );
      setChannelDataMap((previous) => {
        const next = { ...previous };
        delete next[channelId];
        return next;
      });
      setDeleteConfirm(null);
      setActiveActionMenu(null);
      setMenuPosition(null);
    } catch {
      alert("Error deleting channel. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferChannel = async (channelId: string, fromClientName: string) => {
    const otherClients = clients.filter((c) => c.name !== fromClientName);
    if (otherClients.length === 0) {
      alert("No other clients to transfer to.");
      return;
    }
    const targetName = prompt(
      `Transfer channel to which client?\n\nAvailable:\n${otherClients.map((c) => `- ${c.name}`).join("\n")}\n\nType the client name:`
    );
    if (!targetName) return;
    const targetClient = otherClients.find(
      (c) => c.name.toLowerCase() === targetName.toLowerCase()
    );
    if (!targetClient) {
      alert("Client not found. Make sure to type the exact name.");
      return;
    }
    const fromClient = clients.find(
      (c) => c.name === fromClientName || c.channels.includes(channelId)
    );
    if (!fromClient) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "transfer_channel",
          channelId,
          fromUserId: fromClient.id,
          toUserId: targetClient.id,
        }),
      });
      if (res.ok) {
        setClients((prev) =>
          prev.map((c) => {
            if (c.id === fromClient.id)
              return { ...c, channels: c.channels.filter((ch) => ch !== channelId) };
            if (c.id === targetClient.id)
              return { ...c, channels: [...c.channels, channelId] };
            return c;
          })
        );
        setActiveActionMenu(null);
        setMenuPosition(null);
        alert(`Channel transferred to ${targetClient.name}`);
      } else {
        alert("Failed to transfer channel.");
      }
    } catch {
      alert("Error transferring channel.");
    }
    setActionLoading(false);
  };

  // Pending channels from all clients
  const pendingChannelsList = useMemo(() => {
    const list: { channelId: string; clientId: string; clientName: string; clientEmail: string }[] = [];
    for (const client of clients) {
      if (client.pendingChannels?.length) {
        for (const ch of client.pendingChannels) {
          list.push({ channelId: ch, clientId: client.id, clientName: client.name, clientEmail: client.email });
        }
      }
    }
    return list;
  }, [clients]);

  const handleApproveChannel = async (userId: string, channelId: string) => {
    setPendingActionLoading(channelId);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "approve_channel", userId, channelId }),
      });
      if (res.ok) {
        // Find client info for notification
        const client = clients.find((c) => c.id === userId);
        // Send notification to client
        if (client) {
          fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: client.id,
              userEmail: client.email,
              type: "channel_approved",
              title: "Channel Approved!",
              message: `Your channel ${channelId} has been approved. Please validate your token now — go to Channels page, copy the invite link, and validate to start seeing data.`,
            }),
          }).catch(() => {});
        }
        // Update local state
        setClients((prev) => prev.map((c) => {
          if (c.id === userId) {
            return {
              ...c,
              channels: [...c.channels, channelId],
              pendingChannels: (c.pendingChannels || []).filter((ch) => ch !== channelId),
            };
          }
          return c;
        }));
      }
    } catch { /* silent */ }
    setPendingActionLoading(null);
  };

  const handleRejectChannel = async (userId: string, channelId: string) => {
    setPendingActionLoading(channelId);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "reject_channel", userId, channelId }),
      });
      if (res.ok) {
        setClients((prev) => prev.map((c) => {
          if (c.id === userId) {
            return {
              ...c,
              pendingChannels: (c.pendingChannels || []).filter((ch) => ch !== channelId),
            };
          }
          return c;
        }));
      }
    } catch { /* silent */ }
    setPendingActionLoading(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Shield className="w-4 h-4 text-red-500" />
        <span className="text-red-500 font-medium">Admin</span>
        <span>›</span>
        <span className="text-foreground font-medium">All Channels</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">All Channels</h1>
        <p className="text-sm text-muted mt-1">View all YouTube channels across all clients.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-purple-600 font-medium">Total Channels</p>
            <p className="text-2xl font-bold text-purple-900">{allChannelRows.length}</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-green-600 font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-green-900">${allChannelRows.reduce((s, c) => s + c.revenue, 0).toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
            <Eye className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">Total Subscribers</p>
            <p className="text-2xl font-bold text-blue-900">{formatNumber(allChannelRows.reduce((s, c) => s + c.subscribers, 0))}</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-amber-600 font-medium">Token Status</p>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-green-700">{allChannelRows.filter(c => c.tokenStatus === "valid").length} Valid</span>
              <span className="text-sm font-bold text-amber-700">{allChannelRows.filter(c => c.tokenStatus === "expired").length} Expired</span>
              <span className="text-sm font-bold text-red-700">{allChannelRows.filter(c => c.tokenStatus === "none" || !c.tokenStatus).length} None</span>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Period Filter */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">Revenue Period:</span>
          <button
            onClick={() => { setRevenuePeriod("cached"); setPeriodRevenueMap({}); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${revenuePeriod === "cached" ? "bg-primary text-white" : "bg-slate-100 text-muted hover:bg-slate-200"}`}
          >
            Cached
          </button>
          {["7", "28", "90"].map((d) => (
            <button
              key={d}
              onClick={() => setRevenuePeriod(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${revenuePeriod === d ? "bg-primary text-white" : "bg-slate-100 text-muted hover:bg-slate-200"}`}
            >
              {d} Days
            </button>
          ))}
          <span className="text-xs text-muted mx-1">|</span>
          {(() => {
            const months: { value: string; label: string }[] = [];
            const now = new Date();
            for (let i = 0; i < 6; i++) {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
              months.push({ value: val, label });
            }
            return months.map((m) => (
              <button
                key={m.value}
                onClick={() => setRevenuePeriod(m.value)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${revenuePeriod === m.value ? "bg-primary text-white" : "bg-slate-100 text-muted hover:bg-slate-200"}`}
              >
                {m.label}
              </button>
            ));
          })()}
          {periodRevenueLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary ml-2" />}
        </div>
      </div>

      {/* Cached Stats Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          <span>Cached Stats</span>
          <span className="text-muted">· Loaded {lastRefresh.toLocaleTimeString()}</span>
        </div>
        <button
          onClick={refreshChannelStats}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          title="Refresh the server channel snapshot"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Pending Channels Approval Section */}
      {pendingChannelsList.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-amber-900">Pending Channel Approvals ({pendingChannelsList.length})</h2>
          </div>
          <div className="space-y-3">
            {pendingChannelsList.map((item) => (
              <div key={`${item.clientId}-${item.channelId}`} className="bg-white rounded-lg border border-amber-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.channelId}</p>
                  <p className="text-xs text-muted">Client: <span className="font-medium">{item.clientName}</span> ({item.clientEmail})</p>
                </div>
                <div className="flex items-center gap-2">
                  {pendingActionLoading === item.channelId ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : (
                    <>
                      <button
                        onClick={() => handleApproveChannel(item.clientId, item.channelId)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectChannel(item.clientId, item.channelId)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search by channel name, ID, or client..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={clientFilter}
            onChange={(e) => { setClientFilter(e.target.value); setCurrentPage(1); }}
            className="border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <select
            value={tokenFilter}
            onChange={(e) => { setTokenFilter(e.target.value); setCurrentPage(1); }}
            className="border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All Tokens</option>
            <option value="valid">Valid</option>
            <option value="expired">Expired</option>
            <option value="none">Not Validated</option>
          </select>
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="border border-border rounded-lg px-3 py-2 text-sm"
          >
            {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
          <button
            onClick={() => { setSearchQuery(""); setClientFilter(""); setTokenFilter("all"); setCurrentPage(1); }}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground px-3 py-2 border border-border rounded-lg"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {loadingChannels && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted">Loading channel data...</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">Channel</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Subscribers</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Videos</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Views</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Revenue</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Vendor</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Network</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Token</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageChannels.map((channel) => (
                <tr key={`${channel.clientName}-${channel.channelId}`} className="border-b border-border hover:bg-slate-50 cursor-pointer" onClick={() => window.open(`https://www.youtube.com/channel/${channel.channelId}`, '_blank')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 shrink-0">
                        {channel.thumbnail ? (
                          <img
                            src={channel.thumbnail}
                            alt={channel.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">
                            {channel.name[0]}
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{channel.name}</span>
                        <p className="text-xs text-muted">{channel.channelId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{formatNumber(channel.subscribers)}</td>
                  <td className="px-4 py-3 text-foreground">{channel.videos.toLocaleString()}</td>
                  <td className="px-4 py-3 text-foreground">{formatNumber(channel.views)}</td>
                  <td className="px-4 py-3 text-green-600 font-medium">${channel.revenue.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-primary">{channel.clientName}</span>
                  </td>
                  <td className="px-4 py-3 min-w-[160px]" onClick={(event) => event.stopPropagation()}>
                    <select
                      value={channelVendorIds[channel.channelId] || ""}
                      disabled={vendorSavingId === channel.channelId}
                      onChange={(event) => void handleVendorAssignment(channel.channelId, event.target.value)}
                      className="w-full px-2 py-1.5 border border-border rounded text-xs bg-white disabled:opacity-60"
                    >
                      <option value="">No vendor</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 min-w-[170px]" onClick={(event) => event.stopPropagation()}>
                    {(() => {
                      const currentNetwork = clients
                        .find((client) => client.id === channel.clientId)
                        ?.channelNetworks?.find((assignment) => assignment.channelId === channel.channelId)
                        ?.networkName || "";
                      return (
                        <select
                          value={currentNetwork}
                          disabled={networkSavingId === channel.channelId || !channel.clientId}
                          onChange={(event) => void handleNetworkAssignment(
                            channel.clientId,
                            channel.channelId,
                            event.target.value
                          )}
                          className="w-full px-2 py-1.5 border border-border rounded text-xs bg-white disabled:opacity-60"
                          aria-label={`Network for ${channel.name}`}
                        >
                          <option value="">No network</option>
                          {currentNetwork && !networkOptions.some((network) => network.name === currentNetwork) && (
                            <option value={currentNetwork}>{currentNetwork}</option>
                          )}
                          {networkOptions.map((network) => (
                            <option key={network.id} value={network.name}>{network.name}</option>
                          ))}
                        </select>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-foreground">{channel.category}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        channel.tokenStatus === "valid" ? "bg-green-100 text-green-700" :
                        channel.tokenStatus === "expired" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {channel.tokenStatus === "valid" ? "✓ Valid" :
                         channel.tokenStatus === "expired" ? "⏱ Expired" :
                         "✗ Not Validated"}
                      </span>
                      {clients.some((c) => (c.pendingChannels || []).includes(channel.channelId)) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                          Pending Approval
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedChannel(channel); }}
                        className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Channel Details"
                      >
                        <Eye className="w-4 h-4 text-blue-500" />
                      </button>
                      <a
                        href={`https://www.youtube.com/channel/${channel.channelId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                        title="View on YouTube"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-4 h-4 text-red-500" />
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (activeActionMenu === channel.channelId) {
                            setActiveActionMenu(null);
                            setMenuPosition(null);
                          } else {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setMenuPosition({ top: rect.bottom + 4, left: rect.right - 200 });
                            setActiveActionMenu(channel.channelId);
                          }
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                        title="More actions"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pageChannels.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-muted">
                    {loadingChannels
                      ? "Loading..."
                      : "No channels found. Add clients with channel IDs first."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50">
            <p className="text-sm text-muted">
              Showing {(currentPage - 1) * perPage + 1} to{" "}
              {Math.min(currentPage * perPage, filteredChannels.length)} of {filteredChannels.length}
            </p>
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border disabled:opacity-50 hover:bg-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-border disabled:opacity-50 hover:bg-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Channel Detail Modal */}
      {selectedChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedChannel(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">Channel Details</h2>
                <button onClick={() => setSelectedChannel(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <RotateCcw className="w-5 h-5 text-muted" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-200 shrink-0">
                  {selectedChannel.thumbnail ? (
                    <img src={selectedChannel.thumbnail} alt={selectedChannel.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xl">
                      {selectedChannel.name[0]}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedChannel.name}</h3>
                  <p className="text-sm text-muted">{selectedChannel.channelId}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                    selectedChannel.tokenStatus === "valid" ? "bg-green-100 text-green-700" :
                    selectedChannel.tokenStatus === "expired" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    Token: {selectedChannel.tokenStatus === "valid" ? "✓ Valid" :
                            selectedChannel.tokenStatus === "expired" ? "⏱ Expired" :
                            "✗ Not Validated"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-600 font-medium">Subscribers</p>
                  <p className="text-lg font-bold text-blue-900">{formatNumber(selectedChannel.subscribers)}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-600 font-medium">Revenue (28d)</p>
                  <p className="text-lg font-bold text-green-900">${selectedChannel.revenue.toFixed(2)}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-xs text-purple-600 font-medium">Total Views</p>
                  <p className="text-lg font-bold text-purple-900">{formatNumber(selectedChannel.views)}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-600 font-medium">Videos</p>
                  <p className="text-lg font-bold text-amber-900">{selectedChannel.videos.toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted">Client</span>
                  <span className="font-medium text-foreground">{selectedChannel.clientName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted">Vendor</span>
                  <span className="font-medium text-foreground">
                    {vendors.find((vendor) => vendor.id === channelVendorIds[selectedChannel.channelId])?.name || "No vendor"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted">Network</span>
                  <span className="font-medium text-foreground">
                    {clients
                      .find((client) => client.id === selectedChannel.clientId)
                      ?.channelNetworks?.find((assignment) => assignment.channelId === selectedChannel.channelId)
                      ?.networkName || "No network"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted">Category</span>
                  <span className="font-medium text-foreground">{selectedChannel.category}</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <a
                  href={`https://www.youtube.com/channel/${selectedChannel.channelId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on YouTube
                </a>
                {selectedChannel.tokenStatus === "valid" && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Revoke Google access for ${selectedChannel.name} and delete its stored YouTube data? The channel owner will need to authorize again.`)) return;
                      const response = await fetch(
                        `/api/channel-tokens?action=deleteToken&channelId=${encodeURIComponent(selectedChannel.channelId)}`,
                        { method: "DELETE" }
                      );
                      if (!response.ok) {
                        alert("Google access could not be revoked. Please retry.");
                        return;
                      }
                      setTokenStatuses((prev) => ({ ...prev, [selectedChannel.channelId]: "none" }));
                      setSelectedChannel({ ...selectedChannel, tokenStatus: "none" });
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm"
                  >
                    <XCircle className="w-4 h-4" />
                    Revoke Access
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3-Dot Action Menu Portal */}
      {activeActionMenu && menuPosition && (() => {
        const channel = pageChannels.find((c) => c.channelId === activeActionMenu);
        if (!channel) return null;
        return (
          <>
            <div
              className="fixed inset-0 z-[70]"
              onClick={() => { setActiveActionMenu(null); setMenuPosition(null); }}
            />
            <div
              className="fixed z-[80] bg-white rounded-lg shadow-lg border border-border py-1 min-w-[200px]"
              style={{ top: menuPosition.top, left: Math.max(8, menuPosition.left) }}
            >
              <button
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 flex items-center gap-2"
                onClick={() => {
                  setSelectedChannel(channel);
                  setActiveActionMenu(null);
                  setMenuPosition(null);
                }}
              >
                <Eye className="w-4 h-4 text-blue-500" />
                View Details
              </button>
              <a
                href={`https://www.youtube.com/channel/${channel.channelId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-2"
                onClick={() => { setActiveActionMenu(null); setMenuPosition(null); }}
              >
                <ExternalLink className="w-4 h-4 text-red-500" />
                View on YouTube
              </a>
              {tokenStatuses[channel.channelId] !== "valid" && (
                <button
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-green-50 flex items-center gap-2 text-green-700 disabled:opacity-60"
                  disabled={validatingChannelId === channel.channelId}
                  onClick={() => handleValidateToken(channel.channelId, channel.name)}
                >
                  {validatingChannelId === channel.channelId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  Validate Token
                </button>
              )}
              <button
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-amber-50 flex items-center gap-2"
                onClick={() => {
                  handleTransferChannel(channel.channelId, channel.clientName);
                }}
              >
                <ArrowRightLeft className="w-4 h-4 text-amber-500" />
                Transfer to Client
              </button>
              {(() => {
                const owner = clients.find((c) => c.channels.includes(channel.channelId));
                const isPending = clients.some((c) => (c.pendingChannels || []).includes(channel.channelId));
                if (isPending && owner) {
                  return (
                    <button
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-green-50 flex items-center gap-2 text-green-600"
                      onClick={() => {
                        handleApproveChannel(owner.id, channel.channelId);
                        setActiveActionMenu(null);
                        setMenuPosition(null);
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve Channel
                    </button>
                  );
                }
                if (!isPending && owner) {
                  return (
                    <button
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-amber-50 flex items-center gap-2 text-amber-600"
                      onClick={async () => {
                        // Move from approved to pending (unapprove)
                        try {
                          const res = await fetch("/api/users", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ type: "unapprove_channel", userId: owner.id, channelId: channel.channelId }),
                          });
                          if (res.ok) {
                            setClients((prev) => prev.map((c) => {
                              if (c.id === owner.id) {
                                return {
                                  ...c,
                                  channels: c.channels.filter((ch) => ch !== channel.channelId),
                                  pendingChannels: [...(c.pendingChannels || []), channel.channelId],
                                };
                              }
                              return c;
                            }));
                          }
                        } catch { /* silent */ }
                        setActiveActionMenu(null);
                        setMenuPosition(null);
                      }}
                    >
                      <XCircle className="w-4 h-4" />
                      Unapprove Channel
                    </button>
                  );
                }
                return null;
              })()}
              {tokenStatuses[channel.channelId] === "valid" && (
                <button
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-amber-50 flex items-center gap-2 text-amber-600"
                  onClick={async () => {
                    if (!confirm(`Revoke Google access for ${channel.name} and delete its stored YouTube data?`)) return;
                    const response = await fetch(
                      `/api/channel-tokens?action=deleteToken&channelId=${encodeURIComponent(channel.channelId)}`,
                      { method: "DELETE" }
                    );
                    if (!response.ok) {
                      alert("Google access could not be revoked. Please retry.");
                      return;
                    }
                    setTokenStatuses((prev) => ({ ...prev, [channel.channelId]: "none" }));
                    setActiveActionMenu(null);
                    setMenuPosition(null);
                  }}
                >
                  <XCircle className="w-4 h-4" />
                  Revoke Access
                </button>
              )}
              <div className="border-t border-border my-1" />
              <button
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                onClick={() => {
                  setDeleteConfirm(channel.channelId);
                  setActiveActionMenu(null);
                  setMenuPosition(null);
                }}
              >
                <Trash2 className="w-4 h-4" />
                Delete Channel
              </button>
              <button
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-700 font-medium"
                onClick={async () => {
                  if (!confirm(`PERMANENT REMOVE: Are you sure you want to permanently remove ${channel.name} (${channel.channelId})?\n\nThis will:\n- Delete token\n- Remove all cached data\n- Remove from client's account\n\nThis action CANNOT be undone!`)) return;
                  try {
                    const res = await fetch(
                      `/api/channel-tokens?action=permanentRemoveChannel&channelId=${encodeURIComponent(channel.channelId)}`,
                      { method: "DELETE" }
                    );
                    if (res.ok) {
                      alert(`Channel ${channel.name} permanently removed.`);
                      window.location.reload();
                    } else {
                      alert("Failed to permanently remove channel");
                    }
                  } catch { alert("Error removing channel"); }
                  setActiveActionMenu(null);
                  setMenuPosition(null);
                }}
              >
                <Trash2 className="w-4 h-4" />
                Permanent Remove
              </button>
            </div>
          </>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (() => {
        const channel = allChannelRows.find((c) => c.channelId === deleteConfirm);
        if (!channel) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90] p-4" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-foreground mb-2">Delete Channel?</h3>
              <p className="text-sm text-muted mb-1">
                Are you sure you want to remove <strong>{channel.name}</strong> ({channel.channelId}) from <strong>{channel.clientName}</strong>?
              </p>
              <p className="text-xs text-red-500 mb-4">This will remove the channel from the client&apos;s account. The YouTube channel itself will not be affected.</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-slate-50"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteChannel(channel.channelId, channel.clientName)}
                  className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-1.5"
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
