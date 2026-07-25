"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  X,
  Loader2,
  RotateCcw,
  Users,
  Shield,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Radio,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
  XCircle,
  DollarSign,
  BarChart3,
  TrendingUp,
  ArrowRightLeft,
  Landmark,
  FileText,
  Upload,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ChannelDetail {
  id: string;
  name: string;
  subscribers: number;
  views: number;
  videos: number;
  thumbnail: string;
  tokenStatus: string;
  revenue?: number;
}

interface ClientRevenueData {
  totalRevenue: number;
  totalViews: number;
  totalSubscribers: number;
  cpm: number;
  rpm: number;
}

interface NetworkAssignment {
  networkId: string;
  networkName: string;
  revenueSharePercent: number;
}

interface ChannelNetworkAssignment {
  channelId: string;
  networkId: string;
  networkName: string;
  revenueSharePercent: number;
}

interface NetworkOption {
  id: string;
  name: string;
  revenueSharePercent: number;
}

interface VendorOption {
  id: string;
  name: string;
}

interface VendorAssignment {
  channelId: string;
  vendorId: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  channels: string[];
  status: "active" | "inactive" | "pending";
  joinedDate: string;
  category: string;
  role?: "client" | "company";
  parentId?: string;
  networks?: NetworkAssignment[];
  channelNetworks?: ChannelNetworkAssignment[];
  whiteLabelEnabled?: boolean;
  revenueSharePercent?: number;
}

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function AdminClientsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [passwordClient, setPasswordClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCategory, setFormCategory] = useState("Music");
  const [formRole, setFormRole] = useState<"client" | "company">("client");
  const [formChannels, setFormChannels] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [managementError, setManagementError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formNetworks, setFormNetworks] = useState<NetworkAssignment[]>([]);
  const [formChannelNetworks, setFormChannelNetworks] = useState<ChannelNetworkAssignment[]>([]);
  const [availableNetworks, setAvailableNetworks] = useState<NetworkOption[]>([]);
  const [availableVendors, setAvailableVendors] = useState<VendorOption[]>([]);
  const [vendorAssignments, setVendorAssignments] = useState<VendorAssignment[]>([]);
  const [formChannelVendors, setFormChannelVendors] = useState<Record<string, string>>({});
  const [channelNames, setChannelNames] = useState<Record<string, string>>({});
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [formWhiteLabel, setFormWhiteLabel] = useState(false);
  const [formRevenueShare, setFormRevenueShare] = useState<number>(0);

  // Channel transfer
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferChannelId, setTransferChannelId] = useState("");
  const [transferFromUserId, setTransferFromUserId] = useState("");
  const [transferToUserId, setTransferToUserId] = useState("");
  const [transferring, setTransferring] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Client detail view state
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [clientChannels, setClientChannels] = useState<ChannelDetail[]>([]);
  const [clientChannelsLoading, setClientChannelsLoading] = useState(false);
  const [clientRevenue, setClientRevenue] = useState<ClientRevenueData | null>(null);
  const [clientDetailTab, setClientDetailTab] = useState<"channels" | "bank" | "agreements">("channels");
  const [revenueDays, setRevenueDays] = useState<number | string>(28);
  const [revenueLoading, setRevenueLoading] = useState(false);

  // Bank details for viewed client
  interface BankDetails {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branchName: string;
    upiId: string;
    panNumber: string;
  }
  const [clientBankDetails, setClientBankDetails] = useState<BankDetails | null>(null);
  const [bankLoading, setBankLoading] = useState(false);

  // Agreements for viewed client
  interface Agreement {
    id: string;
    fileName: string;
    fileUrl: string;
    uploadedAt: string;
    uploadedBy: string;
    notes: string;
  }
  const [clientAgreements, setClientAgreements] = useState<Agreement[]>([]);
  const [agreementLoading, setAgreementLoading] = useState(false);
  const [newAgreementName, setNewAgreementName] = useState("");
  const [newAgreementUrl, setNewAgreementUrl] = useState("");
  const [newAgreementNotes, setNewAgreementNotes] = useState("");

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      if (res.ok) {
        const json = await res.json();
        setClients(json.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNetworks = useCallback(async () => {
    try {
      const res = await fetch("/api/networks");
      if (res.ok) {
        const json = await res.json();
        setAvailableNetworks(json.data || []);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchChannelNames = useCallback(async () => {
    try {
      const response = await fetch("/api/client-data?action=getAllCachedData", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error("Failed to load channel names");
      const names: Record<string, string> = {};
      for (const client of json.data || []) {
        for (const channel of client.channels || []) {
          if (channel.channelId) names[channel.channelId] = channel.channelTitle || channel.channelId;
        }
      }
      setChannelNames(names);
    } catch {
      setChannelNames({});
    }
  }, []);

  const fetchVendors = useCallback(async () => {
    try {
      const response = await fetch("/api/vendors?action=list", { cache: "no-store" });
      if (response.ok) {
        const json = await response.json();
        setAvailableVendors(json.data?.vendors || []);
        setVendorAssignments(json.data?.assignments || []);
      }
    } catch {
      setAvailableVendors([]);
      setVendorAssignments([]);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "admin") {
      queueMicrotask(() => {
        fetchClients();
        fetchNetworks();
        fetchVendors();
        fetchChannelNames();
      });
    }
  }, [status, session, fetchClients, fetchNetworks, fetchVendors, fetchChannelNames]);

  const resetForm = () => {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormPhone("");
    setFormCategory("Music");
    setFormRole("client");
    setFormChannels("");
    setFormNetworks([]);
    setFormChannelNetworks([]);
    setFormChannelVendors({});
    setAssignmentSearch("");
    setFormWhiteLabel(false);
    setFormRevenueShare(0);
    setFormError(null);
    setEditingClient(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = useCallback((client: Client) => {
    setEditingClient(client);
    setFormName(client.name);
    setFormEmail(client.email);
    setFormPassword("");
    setFormPhone(client.phone || "");
    setFormCategory(client.category);
    setFormRole(client.role || "client");
    setFormChannels(client.channels.join(", "));
    setFormNetworks(client.networks || []);
    setFormChannelNetworks(client.channelNetworks || []);
    setFormChannelVendors(
      Object.fromEntries(
        vendorAssignments
          .filter((assignment) => client.channels.includes(assignment.channelId))
          .map((assignment) => [assignment.channelId, assignment.vendorId])
      )
    );
    setFormWhiteLabel(client.whiteLabelEnabled || false);
    setFormRevenueShare(client.revenueSharePercent || 0);
    setAssignmentSearch("");
    setFormError(null);
    setShowModal(true);
  }, [vendorAssignments]);

  useEffect(() => {
    if (clients.length === 0 || typeof window === "undefined") return;
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (!editId) return;
    const client = clients.find((item) => item.id === editId);
    if (!client) return;
    queueMicrotask(() => openEditModal(client));
    window.history.replaceState({}, "", window.location.pathname);
  }, [clients, openEditModal]);

  const openPasswordModal = (client: Client) => {
    setPasswordClient(client);
    setNewPassword("");
    setShowNewPassword(false);
    setPasswordSuccess(false);
    setShowPasswordModal(true);
  };

  const handleSaveClient = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      setFormError("Name and Email are required");
      return;
    }
    if (!editingClient && !formPassword.trim()) {
      setFormError("Password is required for new users");
      return;
    }
    if (!editingClient && formPassword.length < 6) {
      setFormError("Password must be at least 6 characters");
      return;
    }

    const channelIds = formChannels
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    setSaving(true);
    setFormError(null);

    try {
      if (editingClient) {
        const body: Record<string, unknown> = {
          id: editingClient.id,
          name: formName.trim(),
          email: formEmail.trim(),
          phone: (formPhone || "").trim(),
          category: formCategory,
          role: formRole,
          channels: channelIds,
          networks: formNetworks,
          channelNetworks: formChannelNetworks,
          whiteLabelEnabled: formWhiteLabel,
          revenueSharePercent: formRevenueShare,
        };
        if (formPassword.trim()) {
          body.password = formPassword.trim();
        }

        const res = await fetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || "Failed to update client");
          return;
        }
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            email: formEmail.trim(),
            password: formPassword.trim(),
            phone: (formPhone || "").trim(),
            category: formCategory,
            role: formRole,
            channels: channelIds,
            networks: formNetworks,
            channelNetworks: formChannelNetworks,
            whiteLabelEnabled: formWhiteLabel,
            revenueSharePercent: formRevenueShare,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || "Failed to create client");
          return;
        }
      }

      const vendorResponse = await fetch("/api/vendors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assignMany",
          assignments: channelIds.map((channelId) => ({
            channelId,
            vendorId: formChannelVendors[channelId] || "",
          })),
        }),
      });
      if (!vendorResponse.ok) {
        const vendorJson = await vendorResponse.json();
        setFormError(vendorJson.error || "User saved, but vendor assignment failed");
        return;
      }

      setShowModal(false);
      resetForm();
      fetchClients();
      fetchVendors();
    } catch (err) {
      setFormError(`Failed to save client: ${err instanceof Error ? err.message : "Network error. Please try again."}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTransferChannel = async () => {
    if (!transferFromUserId || !transferToUserId || !transferChannelId) return;
    setTransferring(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "transfer_channel",
          fromUserId: transferFromUserId,
          toUserId: transferToUserId,
          channelId: transferChannelId,
        }),
      });
      if (res.ok) {
        setShowTransferModal(false);
        setTransferChannelId("");
        setTransferFromUserId("");
        setTransferToUserId("");
        fetchClients();
        if (viewingClient) {
          setViewingClient(null);
        }
      }
    } catch { /* silent */ }
    finally { setTransferring(false); }
  };

  const handleUpdatePassword = async () => {
    if (!passwordClient || !newPassword.trim()) return;
    if (newPassword.length < 6) return;

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: passwordClient.id,
          password: newPassword.trim(),
        }),
      });
      if (res.ok) {
        setPasswordSuccess(true);
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordClient(null);
        }, 1500);
      }
    } catch {
      // silent
    } finally {
      setPasswordSaving(false);
    }
  };

  const openClientView = useCallback(async (client: Client) => {
    setViewingClient(client);
    setClientChannels([]);
    setClientRevenue(null);
    setClientChannelsLoading(true);
    setClientDetailTab("channels");
    setClientBankDetails(null);
    setClientAgreements([]);
    setRevenueDays(28);

    // Fetch bank details and agreements in background
    setBankLoading(true);
    setAgreementLoading(true);
    fetch(`/api/client-data?action=getBankDetails&userId=${encodeURIComponent(client.email)}`)
      .then(r => r.json()).then(j => { if (j.data) setClientBankDetails(j.data); })
      .catch(() => {}).finally(() => setBankLoading(false));
    fetch(`/api/client-data?action=getAgreements&userId=${encodeURIComponent(client.email)}`)
      .then(r => r.json()).then(j => { if (j.data) setClientAgreements(j.data); })
      .catch(() => {}).finally(() => setAgreementLoading(false));

    try {
      const channelDetails: ChannelDetail[] = [];
      const channelIds = client.channels;

      if (channelIds.length > 0) {
        // Fetch token statuses
        const tokenRes = await fetch(`/api/channel-tokens?action=bulkTokenStatus&channelIds=${encodeURIComponent(channelIds.join(","))}`);
        const tokenJson = await tokenRes.json();
        const tokenStatuses = tokenJson.data?.statuses || {};

        // Fetch cached channel data
        const cachedChannelMap: Record<string, { title: string; thumbnail: string; subscribers: number; views: number; videoCount: number; revenue: number }> = {};
        try {
          const cachedRes = await fetch(`/api/client-data?action=getCachedData&userId=${encodeURIComponent(client.email)}`);
          if (cachedRes.ok) {
            const cachedJson = await cachedRes.json();
            for (const ch of (cachedJson.data?.channels || [])) {
              cachedChannelMap[ch.channelId] = {
                title: ch.channelTitle || ch.channelId,
                thumbnail: ch.thumbnail || "",
                subscribers: ch.subscribers || 0,
                views: ch.views || 0,
                videoCount: ch.videoCount || 0,
                revenue: ch.estimatedRevenue || 0,
              };
            }
          }
        } catch { /* silent */ }

        // Fetch channel info — use cached data first, then YouTube API fallback
        for (const chId of channelIds) {
          const tokenInfo = tokenStatuses[chId] as { status?: string } | undefined;
          const cachedCh = cachedChannelMap[chId];

          if (cachedCh) {
            channelDetails.push({
              id: chId,
              name: cachedCh.title,
              subscribers: cachedCh.subscribers,
              views: cachedCh.views,
              videos: cachedCh.videoCount,
              thumbnail: cachedCh.thumbnail,
              tokenStatus: tokenInfo?.status === "valid" ? "Valid" : "Invalid",
              revenue: cachedCh.revenue,
            });
            continue;
          }

          try {
            const chRes = await fetch(`/api/youtube?action=lookupChannel&query=${encodeURIComponent(chId)}&storedChannelIds=${encodeURIComponent(channelIds.join(","))}`);
            const chJson = await chRes.json();
            if (chRes.ok && chJson.data?.length) {
              const ch = chJson.data[0];
              channelDetails.push({
                id: chId,
                name: ch.snippet?.title || chId,
                subscribers: Number(ch.statistics?.subscriberCount || 0),
                views: Number(ch.statistics?.viewCount || 0),
                videos: Number(ch.statistics?.videoCount || 0),
                thumbnail: ch.snippet?.thumbnails?.default?.url || "",
                tokenStatus: tokenInfo?.status === "valid" ? "Valid" : "Invalid",
              });
            } else {
              channelDetails.push({
                id: chId, name: chId, subscribers: 0, views: 0, videos: 0, thumbnail: "",
                tokenStatus: tokenInfo?.status === "valid" ? "Valid" : "Invalid",
              });
            }
          } catch {
            channelDetails.push({
              id: chId, name: chId, subscribers: 0, views: 0, videos: 0, thumbnail: "", tokenStatus: "Invalid",
            });
          }
        }
      }

      setClientChannels(channelDetails);
    } catch {
      // silent
    } finally {
      setClientChannelsLoading(false);
    }
  }, []);

  // Fetch revenue data for given days range
  const fetchClientRevenue = useCallback(async (client: Client, days: number | string) => {
    setRevenueLoading(true);
    try {
      let startDate: string;
      let endDate: string;
      if (typeof days === "string" && days.match(/^\d{4}-\d{2}$/)) {
        // Month filter like "2026-05"
        const [year, month] = days.split("-").map(Number);
        startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const now = new Date();
        const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
        const endDay = isCurrentMonth ? now.getDate() : lastDay;
        endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
      } else {
        const numDays = typeof days === "number" ? days : 28;
        const endD = new Date();
        endDate = `${endD.getFullYear()}-${String(endD.getMonth()+1).padStart(2,"0")}-${String(endD.getDate()).padStart(2,"0")}`;
        const startDateObj = new Date();
        startDateObj.setDate(startDateObj.getDate() - numDays);
        startDate = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth()+1).padStart(2,"0")}-${String(startDateObj.getDate()).padStart(2,"0")}`;
      }
      const channelIds = client.channels;
      if (channelIds.length === 0) return;

      const revenueRes = await fetch(
        `/api/youtube?action=dashboardFull&channelIds=${encodeURIComponent(channelIds.join(","))}&startDate=${startDate}&endDate=${endDate}`
      );
      if (!revenueRes.ok) return;
      const revJson = await revenueRes.json();
      const revData = revJson.data;
      if (!revData) return;

      let totalRevenue = 0;
      let totalAnalyticsViews = 0;
      let totalSubs = 0;

      // Sum from per-channel analytics
      if (revData.perChannelAnalytics) {
        for (const pca of Object.values(revData.perChannelAnalytics) as Array<{ revenue?: { columnHeaders?: Array<{ name?: string | null }>; rows?: Array<Array<string | number>> } | null; revenueViews?: { columnHeaders?: Array<{ name?: string | null }>; rows?: Array<Array<string | number>> } | null }>) {
          if (pca.revenueViews?.rows?.length && pca.revenueViews?.columnHeaders) {
            const headers = pca.revenueViews.columnHeaders.map((h) => h.name || "");
            const revIdx = headers.indexOf("estimatedRevenue");
            const viewIdx = headers.indexOf("views");
            if (revIdx !== -1) {
              totalRevenue += pca.revenueViews.rows.reduce((s: number, r) => s + (Number(r[revIdx]) || 0), 0);
            }
            if (viewIdx !== -1) {
              totalAnalyticsViews += pca.revenueViews.rows.reduce((s: number, r) => s + (Number(r[viewIdx]) || 0), 0);
            }
          } else if (pca.revenue?.rows?.length && pca.revenue?.columnHeaders) {
            const headers = pca.revenue.columnHeaders.map((h) => h.name || "");
            const revIdx = headers.indexOf("estimatedRevenue");
            if (revIdx !== -1) {
              totalRevenue += pca.revenue.rows.reduce((s: number, r) => s + (Number(r[revIdx]) || 0), 0);
            }
          }
        }
      }
      // Subscribers from channel data
      if (revData.channels) {
        totalSubs = (revData.channels as Array<{ statistics?: { subscriberCount?: string | null } }>).reduce(
          (s: number, ch) => s + Number(ch?.statistics?.subscriberCount || 0), 0
        );
      }

      const cpm = totalAnalyticsViews > 0 ? (totalRevenue / totalAnalyticsViews) * 1000 : 0;
      const rpm = cpm;
      setClientRevenue({ totalRevenue, totalViews: totalAnalyticsViews, totalSubscribers: totalSubs, cpm, rpm });
    } catch { /* silent */ } finally {
      setRevenueLoading(false);
    }
  }, []);

  // Re-fetch revenue when days filter changes
  useEffect(() => {
    if (viewingClient) {
      queueMicrotask(() => fetchClientRevenue(viewingClient, revenueDays));
    }
  }, [revenueDays, viewingClient, fetchClientRevenue]);

  const handleToggleStatus = async (client: Client) => {
    const newStatus = client.status === "active" ? "inactive" : "active";
    setManagementError(null);
    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: client.id, status: newStatus }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to update user status");
      fetchClients();
    } catch (error) {
      setManagementError(error instanceof Error ? error.message : "Failed to update user status");
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    setManagementError(null);
    try {
      const response = await fetch(`/api/users?id=${encodeURIComponent(clientId)}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to delete user");
      fetchClients();
    } catch (error) {
      setManagementError(error instanceof Error ? error.message : "Failed to delete user");
    }
  };

  const filteredClients = useMemo(() => {
    let result = clients;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(q)
      );
    }
    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }
    return result;
  }, [clients, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredClients.length / perPage);
  const pageClients = filteredClients.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );
  const formChannelIds = formChannels.split(",").map((channel) => channel.trim()).filter(Boolean);
  const filteredAssignmentChannelIds = formChannelIds.filter((channelId) => {
    const query = assignmentSearch.trim().toLowerCase();
    return !query ||
      channelId.toLowerCase().includes(query) ||
      (channelNames[channelId] || "").toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Shield className="w-4 h-4 text-red-500" />
        <span className="text-red-500 font-medium">Admin</span>
        <span>›</span>
        <span className="text-foreground font-medium">User Management</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted mt-1">
            Create, edit, and manage client accounts. Clients can login with their email and password.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">Total Users</p>
            <p className="text-2xl font-bold text-blue-900">{clients.length}</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-green-600 font-medium">Active Users</p>
            <p className="text-2xl font-bold text-green-900">
              {clients.filter((c) => c.status === "active").length}
            </p>
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-purple-600 font-medium">Total Channels</p>
            <p className="text-2xl font-bold text-purple-900">
              {clients.reduce((sum, c) => sum + c.channels.length, 0)}
            </p>
          </div>
        </div>
      </div>

      {managementError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {managementError}
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, email..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="pending">Pending Approval</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border border-border rounded-lg px-3 py-2 text-sm"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("");
              setCurrentPage(1);
            }}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground px-3 py-2 border border-border rounded-lg"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <p className="text-sm text-muted">
            Total: <span className="font-semibold text-primary">{filteredClients.length}</span> users
          </p>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create User
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted">Loading users...</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-foreground">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Channels</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Joined</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageClients.map((client) => (
                  <tr key={client.id} className="border-b border-border hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openClientView(client)}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
                        title="Click to view client panel"
                      >
                        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                          {client.name[0]}
                        </div>
                        <span className="font-medium text-foreground underline decoration-dotted underline-offset-2">{client.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted">{client.email}</td>
                    <td className="px-4 py-3 text-muted">{client.phone || "-"}</td>
                    <td className="px-4 py-3 text-foreground">{client.category}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          client.role === "company" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {client.role === "company" ? "Company" : "Client"}
                        </span>
                        {client.whiteLabelEnabled && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">WL</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-foreground">
                        <Radio className="w-3.5 h-3.5 text-purple-500" />
                        {client.channels.length}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {client.status === "pending" ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            Pending
                          </span>
                          <button
                            onClick={() => handleToggleStatus(client)}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await fetch("/api/users", {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: client.id, status: "inactive" }),
                                });
                                fetchClients();
                              } catch { /* silent */ }
                            }}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      ) : client.status === "active" ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Approved
                          </span>
                          <button
                            onClick={() => handleToggleStatus(client)}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
                          >
                            Deactivate
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Inactive
                          </span>
                          <button
                            onClick={() => handleToggleStatus(client)}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors"
                          >
                            Activate
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{client.joinedDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openClientView(client)}
                          className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                          title="View Client Panel"
                        >
                          <Eye className="w-4 h-4 text-green-500" />
                        </button>
                        <button
                          onClick={() => openEditModal(client)}
                          className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="w-4 h-4 text-blue-500" />
                        </button>
                        <button
                          onClick={() => openPasswordModal(client)}
                          className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Change Password"
                        >
                          <Key className="w-4 h-4 text-amber-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pageClients.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted">
                      No users found. Click &quot;Create User&quot; to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50">
            <p className="text-sm text-muted">
              Showing {(currentPage - 1) * perPage + 1} to{" "}
              {Math.min(currentPage * perPage, filteredClients.length)} of{" "}
              {filteredClients.length}
            </p>
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border disabled:opacity-50 hover:bg-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium ${
                      currentPage === pageNum
                        ? "bg-primary text-white"
                        : "hover:bg-white border border-border"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
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

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[calc(100vh-2rem)] shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground">
                {editingClient ? "Edit User" : "Create New User"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-scroll flex-1 [scrollbar-gutter:stable]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Om Worldwide Entertainment"
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="client@email.com"
                    disabled={!!editingClient}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-slate-50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Password {!editingClient && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingClient ? "Leave blank to keep current" : "Min 6 characters"}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="Music">Music</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Devotional">Devotional</option>
                  <option value="Education">Education</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  User Role
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as "client" | "company")}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="client">Client</option>
                  <option value="company">Company</option>
                </select>
                <p className="text-xs text-muted mt-1">
                  {formRole === "company"
                    ? "Company users can create and manage their own clients"
                    : "Client users can add channels and view their dashboard"}
                </p>
              </div>
              {formRole === "company" && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-foreground">White-Label Access</label>
                      <p className="text-xs text-muted">Enable custom branding for this company</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormWhiteLabel(!formWhiteLabel)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formWhiteLabel ? "bg-emerald-500" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formWhiteLabel ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Revenue Share %</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formRevenueShare}
                        onChange={(e) => setFormRevenueShare(Number(e.target.value))}
                        className="w-24 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <span className="text-sm text-muted">% (company keeps this, client gets rest)</span>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  YouTube Channel IDs
                </label>
                <textarea
                  value={formChannels}
                  onChange={(e) => setFormChannels(e.target.value)}
                  placeholder="UC..., UC... (comma separated channel IDs)"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
                <p className="text-xs text-muted mt-1">
                  Enter YouTube channel IDs separated by commas
                </p>
              </div>
              {formChannels.trim() && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Find Channel for Vendor or Network Assignment
                    </label>
                    <input
                      value={assignmentSearch}
                      onChange={(event) => setAssignmentSearch(event.target.value)}
                      placeholder="Search channel name or full channel ID"
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Per-Channel Vendor & Network
                  </label>
                  <p className="text-xs text-muted mb-2">Assign or correct each channel&apos;s vendor and network in one place.</p>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {filteredAssignmentChannelIds.map((channelId) => {
                      const assignedNetwork = formChannelNetworks.find((assignment) => assignment.channelId === channelId);
                      return (
                        <div key={channelId} className="p-2 border border-border rounded-lg bg-slate-50 space-y-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{channelNames[channelId] || "Channel name unavailable"}</p>
                            <p className="text-xs font-mono text-muted break-all">{channelId}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs text-muted">
                              Vendor
                              <select
                                value={formChannelVendors[channelId] || ""}
                                onChange={(e) => setFormChannelVendors((current) => ({
                                  ...current,
                                  [channelId]: e.target.value,
                                }))}
                                className="mt-1 w-full px-2 py-1.5 border border-border rounded text-xs bg-white"
                              >
                                <option value="">No vendor</option>
                                {availableVendors.map((vendor) => (
                                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                                ))}
                              </select>
                            </label>
                            <label className="text-xs text-muted">
                              Network
                              <select
                                value={assignedNetwork?.networkId || ""}
                                onChange={(e) => {
                                  const networkId = e.target.value;
                                  if (!networkId) {
                                    setFormChannelNetworks(formChannelNetworks.filter((assignment) => assignment.channelId !== channelId));
                                    return;
                                  }
                                  const network = availableNetworks.find((item) => item.id === networkId);
                                  if (!network) return;
                                  setFormChannelNetworks([
                                    ...formChannelNetworks.filter((assignment) => assignment.channelId !== channelId),
                                    {
                                      channelId,
                                      networkId: network.id,
                                      networkName: network.name,
                                      revenueSharePercent: assignedNetwork?.revenueSharePercent ?? network.revenueSharePercent,
                                    },
                                  ]);
                                }}
                                className="mt-1 w-full px-2 py-1.5 border border-border rounded text-xs bg-white"
                              >
                                <option value="">No network</option>
                                {availableNetworks.map((network) => (
                                  <option key={network.id} value={network.id}>{network.name}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          {assignedNetwork && (
                            <label className="flex items-center justify-end gap-2 text-xs text-muted">
                              Revenue share
                              <input
                                type="number"
                                value={assignedNetwork.revenueSharePercent}
                                onChange={(e) => setFormChannelNetworks(formChannelNetworks.map((assignment) =>
                                  assignment.channelId === channelId
                                    ? { ...assignment, revenueSharePercent: Number(e.target.value) || 0 }
                                    : assignment
                                ))}
                                min="0"
                                max="100"
                                className="w-16 px-2 py-1 border border-border rounded text-xs text-center bg-white"
                              />
                              %
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </div>
                </div>
              )}
              {/* Network Assignment */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Assign Networks
                </label>
                {availableNetworks.length === 0 ? (
                  <p className="text-xs text-muted">No networks created yet. Go to Network Management to create one.</p>
                ) : (
                  <div className="space-y-2">
                    {availableNetworks.map((net) => {
                      const assigned = formNetworks.find((fn) => fn.networkId === net.id);
                      return (
                        <div key={net.id} className="flex items-center gap-3 p-2 border border-border rounded-lg">
                          <input
                            type="checkbox"
                            checked={!!assigned}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormNetworks([...formNetworks, {
                                  networkId: net.id,
                                  networkName: net.name,
                                  revenueSharePercent: net.revenueSharePercent,
                                }]);
                              } else {
                                setFormNetworks(formNetworks.filter((fn) => fn.networkId !== net.id));
                              }
                            }}
                            className="w-4 h-4 text-primary rounded"
                          />
                          <span className="text-sm font-medium text-foreground flex-1">{net.name}</span>
                          {assigned && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={assigned.revenueSharePercent}
                                onChange={(e) => {
                                  setFormNetworks(formNetworks.map((fn) =>
                                    fn.networkId === net.id
                                      ? { ...fn, revenueSharePercent: Number(e.target.value) || 0 }
                                      : fn
                                  ));
                                }}
                                min="0"
                                max="100"
                                className="w-16 px-2 py-1 border border-border rounded text-sm text-center"
                              />
                              <span className="text-xs text-muted">% rev share</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {formError && (
                <p className="text-sm text-red-500">{formError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border shrink-0">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground border border-border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveClient}
                disabled={saving}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {editingClient ? "Save Changes" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Detail View Modal */}
      {viewingClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl shadow-xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  {viewingClient.name[0]}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{viewingClient.name}</h2>
                  <p className="text-sm text-muted">{viewingClient.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  viewingClient.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {viewingClient.status === "active" ? "Active" : "Inactive"}
                </span>
                <button
                  onClick={() => openEditModal(viewingClient)}
                  className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit User"
                >
                  <Edit2 className="w-4 h-4 text-blue-500" />
                </button>
                <button
                  onClick={() => openPasswordModal(viewingClient)}
                  className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                  title="Change Password"
                >
                  <Key className="w-4 h-4 text-amber-500" />
                </button>
                <button
                  onClick={() => {
                    handleDeleteClient(viewingClient.id);
                    setViewingClient(null);
                  }}
                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete User"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
                <button
                  onClick={() => setViewingClient(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg ml-2"
                >
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {/* Client Info Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs text-blue-600 font-medium">Category</p>
                  <p className="text-lg font-bold text-blue-900">{viewingClient.category}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-purple-500" />
                    <p className="text-xs text-purple-600 font-medium">Channels</p>
                  </div>
                  <p className="text-lg font-bold text-purple-900">{viewingClient.channels.length}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    <p className="text-xs text-green-600 font-medium">Valid Tokens</p>
                  </div>
                  <p className="text-lg font-bold text-green-900">
                    {clientChannels.filter((c) => c.tokenStatus === "Valid").length}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-600 font-medium">Joined</p>
                  <p className="text-lg font-bold text-slate-900">{viewingClient.joinedDate}</p>
                </div>
              </div>

              {/* Revenue Days Filter */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs font-medium text-muted">Revenue Period:</span>
                {[7, 28, 90, 365].map((d) => (
                  <button
                    key={d}
                    onClick={() => setRevenueDays(d)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      revenueDays === d
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-muted hover:bg-slate-200"
                    }`}
                  >
                    {d === 365 ? "1 Year" : `${d} Days`}
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
                      onClick={() => setRevenueDays(m.value)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        revenueDays === m.value
                          ? "bg-primary text-white"
                          : "bg-slate-100 text-muted hover:bg-slate-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ));
                })()}
                {revenueLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary ml-2" />}
              </div>

              {/* Revenue & Analytics Cards */}
              {clientRevenue && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-green-500" />
                      <p className="text-xs text-green-600 font-medium">Revenue ({typeof revenueDays === "string" ? new Date(revenueDays + "-01").toLocaleString("en-US", { month: "short", year: "numeric" }) : revenueDays === 365 ? "1yr" : `${revenueDays}d`})</p>
                    </div>
                    <p className="text-lg font-bold text-green-900">${clientRevenue.totalRevenue.toFixed(2)}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                      <p className="text-xs text-blue-600 font-medium">Views ({typeof revenueDays === "string" ? new Date(revenueDays + "-01").toLocaleString("en-US", { month: "short", year: "numeric" }) : revenueDays === 365 ? "1yr" : `${revenueDays}d`})</p>
                    </div>
                    <p className="text-lg font-bold text-blue-900">{clientRevenue.totalViews.toLocaleString()}</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
                      <p className="text-xs text-purple-600 font-medium">Subscribers</p>
                    </div>
                    <p className="text-lg font-bold text-purple-900">{clientRevenue.totalSubscribers.toLocaleString()}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs text-amber-600 font-medium">CPM</p>
                    <p className="text-lg font-bold text-amber-900">${clientRevenue.cpm.toFixed(2)}</p>
                  </div>
                  <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                    <p className="text-xs text-cyan-600 font-medium">RPM</p>
                    <p className="text-lg font-bold text-cyan-900">${clientRevenue.rpm.toFixed(2)}</p>
                  </div>
                </div>
              )}

              {viewingClient.phone && (
                <div className="mb-4 text-sm text-muted">
                  Phone: <span className="font-medium text-foreground">{viewingClient.phone}</span>
                </div>
              )}

              {/* Tabs: Channels / Bank Details / Agreements */}
              <div className="flex gap-1 mb-4 border-b border-border">
                {[
                  { id: "channels" as const, label: `Channels (${viewingClient.channels.length})`, icon: Radio },
                  { id: "bank" as const, label: "Bank Details", icon: Landmark },
                  { id: "agreements" as const, label: "Agreements", icon: FileText },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setClientDetailTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      clientDetailTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Channels Tab */}
              {clientDetailTab === "channels" && (
              <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-500" />
                  Channels ({viewingClient.channels.length})
                </h3>
                {clientChannels.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Are you sure you want to expire/revoke tokens for ALL ${clientChannels.length} channels connected to ${viewingClient.name}?\n\nThe user will need to reconnect their YouTube account/channels.`)) return;
                      try {
                        const channelIds = clientChannels.map((ch) => ch.id).join(",");
                        const res = await fetch(
                          `/api/channel-tokens?action=bulkExpireTokens&clientId=${viewingClient.id}&channelIds=${channelIds}`,
                          { method: "DELETE" }
                        );
                        const json = await res.json();
                        const results = json.data?.results || [];
                        const failedCount = results.filter((result: { success: boolean }) => !result.success).length;
                        if (!res.ok || failedCount > 0) {
                          alert(`${results.length - failedCount} channel authorizations revoked; ${failedCount} failed. Retry the failed channels.`);
                          return;
                        }
                        alert(`Access revoked for ${results.length} channels. The client will need to authorize them again.`);
                        setViewingClient({ ...viewingClient });
                      } catch (err) {
                        console.error("Bulk expire error:", err);
                        alert("Failed to expire tokens");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 border border-red-200"
                  >
                    <Key className="w-3.5 h-3.5" />
                    Expire All Channel Tokens
                  </button>
                )}
              </div>

              {clientChannelsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted">Loading channel data...</span>
                </div>
              ) : clientChannels.length === 0 ? (
                <div className="text-center py-8 text-muted text-sm">
                  No channels assigned to this client.
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-border">
                        <th className="text-left px-4 py-2.5 font-semibold text-foreground">Channel</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-foreground">Subscribers</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-foreground">Views</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-foreground">Videos</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-foreground">Token</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientChannels.map((ch) => (
                        <tr key={ch.id} className="border-b border-border hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {ch.thumbnail ? (
                                <img src={ch.thumbnail} alt="" className="w-8 h-8 rounded-full" />
                              ) : (
                                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                                  <Radio className="w-4 h-4 text-slate-400" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-foreground">{ch.name}</p>
                                <p className="text-xs text-muted">{ch.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {ch.subscribers.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {ch.views.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {ch.videos.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              ch.tokenStatus === "Valid"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}>
                              {ch.tokenStatus === "Valid" ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              {ch.tokenStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                setTransferChannelId(ch.id);
                                setTransferFromUserId(viewingClient!.id);
                                setTransferToUserId("");
                                setShowTransferModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium hover:bg-blue-100"
                              title="Transfer to another client"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              Transfer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold">
                        <td className="px-4 py-2.5 text-foreground">Total</td>
                        <td className="px-4 py-2.5 text-foreground">
                          {clientChannels.reduce((sum, c) => sum + c.subscribers, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {clientChannels.reduce((sum, c) => sum + c.views, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {clientChannels.reduce((sum, c) => sum + c.videos, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-green-600">
                            {clientChannels.filter((c) => c.tokenStatus === "Valid").length}/{clientChannels.length} Valid
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              </>
              )}

              {/* Bank Details Tab */}
              {clientDetailTab === "bank" && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-blue-500" />
                    Bank Details
                  </h3>
                  {bankLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : clientBankDetails ? (
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Account Holder", value: clientBankDetails.accountHolderName },
                        { label: "Bank Name", value: clientBankDetails.bankName },
                        { label: "Account Number", value: clientBankDetails.accountNumber },
                        { label: "IFSC Code", value: clientBankDetails.ifscCode },
                        { label: "Branch", value: clientBankDetails.branchName },
                        { label: "UPI ID", value: clientBankDetails.upiId },
                        { label: "PAN Number", value: clientBankDetails.panNumber },
                      ].map((item) => (
                        <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-muted mb-0.5">{item.label}</p>
                          <p className="text-sm font-medium text-foreground">{item.value || "Not provided"}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Landmark className="w-10 h-10 text-muted mx-auto mb-2" />
                      <p className="text-sm text-muted">Client has not added bank details yet.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Agreements Tab */}
              {clientDetailTab === "agreements" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-500" />
                      Agreements
                    </h3>
                  </div>

                  {/* Add Agreement Form */}
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">Upload New Agreement</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={newAgreementName}
                        onChange={(e) => setNewAgreementName(e.target.value)}
                        placeholder="Document name (e.g. Service Agreement)"
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <input
                        type="url"
                        value={newAgreementUrl}
                        onChange={(e) => setNewAgreementUrl(e.target.value)}
                        placeholder="Document URL (Google Drive, Dropbox, etc.)"
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <input
                      type="text"
                      value={newAgreementNotes}
                      onChange={(e) => setNewAgreementNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      onClick={async () => {
                        if (!newAgreementName || !newAgreementUrl || !viewingClient) return;
                        const newAg: Agreement = {
                          id: Date.now().toString(),
                          fileName: newAgreementName,
                          fileUrl: newAgreementUrl,
                          uploadedAt: new Date().toISOString(),
                          uploadedBy: session?.user?.email || "admin",
                          notes: newAgreementNotes,
                        };
                        const updated = [...clientAgreements, newAg];
                        try {
                          await fetch("/api/client-data", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "saveAgreements",
                              userId: viewingClient.email,
                              agreements: updated,
                            }),
                          });
                          setClientAgreements(updated);
                          setNewAgreementName("");
                          setNewAgreementUrl("");
                          setNewAgreementNotes("");
                        } catch { /* silent */ }
                      }}
                      disabled={!newAgreementName || !newAgreementUrl}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload className="w-4 h-4" />
                      Add Agreement
                    </button>
                  </div>

                  {/* Existing Agreements */}
                  {agreementLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : clientAgreements.length === 0 ? (
                    <div className="text-center py-6">
                      <FileText className="w-10 h-10 text-muted mx-auto mb-2" />
                      <p className="text-sm text-muted">No agreements uploaded yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientAgreements.map((ag) => (
                        <div key={ag.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-6 h-6 text-blue-500" />
                            <div>
                              <p className="text-sm font-medium text-foreground">{ag.fileName}</p>
                              <p className="text-xs text-muted">
                                {new Date(ag.uploadedAt).toLocaleDateString("en-IN")}
                                {ag.notes && ` — ${ag.notes}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={ag.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-accent hover:underline"
                            >
                              View
                            </a>
                            <button
                              onClick={async () => {
                                const updated = clientAgreements.filter((a) => a.id !== ag.id);
                                try {
                                  await fetch("/api/client-data", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      action: "saveAgreements",
                                      userId: viewingClient!.email,
                                      agreements: updated,
                                    }),
                                  });
                                  setClientAgreements(updated);
                                } catch { /* silent */ }
                              }}
                              className="text-xs font-medium text-red-500 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && passwordClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-muted">User</p>
                <p className="font-medium text-foreground">{passwordClient.name}</p>
                <p className="text-xs text-muted">{passwordClient.email}</p>
              </div>
              {passwordSuccess ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 text-center">
                  Password updated successfully!
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {!passwordSuccess && (
              <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground border border-border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdatePassword}
                  disabled={passwordSaving || newPassword.length < 6}
                  className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                >
                  {passwordSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  Update Password
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Channel Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                Transfer Channel
              </h2>
              <button onClick={() => setShowTransferModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-muted">Channel ID</p>
                <p className="font-mono text-sm text-foreground break-all">{transferChannelId}</p>
              </div>
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-xs text-orange-600">From Client</p>
                <p className="font-medium text-foreground">{clients.find((c) => c.id === transferFromUserId)?.name || "-"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Transfer To</label>
                <select
                  value={transferToUserId}
                  onChange={(e) => setTransferToUserId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm"
                >
                  <option value="">Select Client</option>
                  {clients.filter((c) => c.id !== transferFromUserId).map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setShowTransferModal(false)} className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground border border-border rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleTransferChannel}
                disabled={transferring || !transferToUserId}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
