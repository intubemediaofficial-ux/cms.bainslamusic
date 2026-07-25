"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import {
  Plus,
  Search,
  X,
  Loader2,
  Users,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Radio,
  DollarSign,
  ExternalLink,
  Key,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { useExchangeRate } from "@/lib/hooks/useExchangeRate";

interface BankDetails {
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  upiId?: string;
  panNumber?: string;
}

interface PaymentRecord {
  id: string;
  month: string;
  totalAmount: number;
  netTotal: number;
  paidAmount: number;
  status: "pending" | "paid" | "partial";
  paidDate: string;
}

interface WithdrawRequest {
  id: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  requestDate: string;
}

interface ClientUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  channels: string[];
  pendingChannels?: string[];
  status: "active" | "inactive" | "pending";
  joinedDate: string;
  category: string;
  parentId?: string;
  revenueSharePercent?: number;
  customNetworks?: string[];
}

interface CachedChannelData {
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  subscribers: number;
  views: number;
  videoCount: number;
  estimatedRevenue: number;
  rpm: number;
}

interface CachedClientData {
  userId: string;
  email: string;
  channels: CachedChannelData[];
  totalRevenue: number;
  totalViews: number;
  totalSubscribers: number;
  lastUpdated: string;
}

export default function CompanyClientsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <CompanyClientsContent />
    </Suspense>
  );
}

function CompanyClientsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewClientId = searchParams.get("view");
  const { rate: INR_RATE } = useExchangeRate("USD");

  const [clients, setClients] = useState<ClientUser[]>([]);
  const [cachedData, setCachedData] = useState<CachedClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientUser | null>(null);
  const [passwordClient, setPasswordClient] = useState<ClientUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCategory, setFormCategory] = useState("Music");
  const [formRevenueShare, setFormRevenueShare] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "company") {
      router.push("/login");
    }
  }, [session, status, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [clientsRes, cachedRes] = await Promise.all([
        fetch("/api/users?action=myClients"),
        fetch("/api/client-data?action=getAllCachedData"),
      ]);
      if (clientsRes.ok) {
        const j = await clientsRes.json();
        setClients(j.data || []);
      }
      if (cachedRes.ok) {
        const j = await cachedRes.json();
        setCachedData(j.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.role === "company") fetchData();
  }, [session, fetchData]);

  const clientDataMap = new Map<string, CachedClientData>();
  for (const cd of cachedData) {
    const client = clients.find((c) => c.email.toLowerCase() === cd.email?.toLowerCase());
    if (client) clientDataMap.set(client.id, cd);
  }

  const openAddModal = () => {
    setEditingClient(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormPhone("");
    setFormCategory("Music");
    setFormRevenueShare(0);
    setError(null);
    setSuccess(null);
    setShowModal(true);
  };

  const openEditModal = (client: ClientUser) => {
    setEditingClient(client);
    setFormName(client.name);
    setFormEmail(client.email);
    setFormPassword("");
    setFormPhone(client.phone || "");
    setFormCategory(client.category || "Music");
    setFormRevenueShare(client.revenueSharePercent || 0);
    setError(null);
    setSuccess(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName || !formEmail) {
      setError("Name and email are required");
      return;
    }
    if (!editingClient && !formPassword) {
      setError("Password is required for new clients");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingClient) {
        // Update existing — use PUT (admin-level, but company should be able to update their own clients)
        const res = await fetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingClient.id,
            name: formName,
            email: formEmail,
            phone: formPhone,
            category: formCategory,
            revenueSharePercent: formRevenueShare,
            ...(formPassword ? { password: formPassword } : {}),
          }),
        });
        if (!res.ok) {
          const j = await res.json();
          setError(j.error || "Failed to update");
          return;
        }
      } else {
        // Create new client
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            password: formPassword,
            phone: formPhone,
            category: formCategory,
            revenueSharePercent: formRevenueShare,
          }),
        });
        if (!res.ok) {
          const j = await res.json();
          setError(j.error || "Failed to create client");
          return;
        }
      }
      setShowModal(false);
      setSuccess(editingClient ? "Client updated!" : "Client created successfully!");
      fetchData();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (client: ClientUser) => {
    if (!confirm(`Delete client "${client.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/users?id=${client.id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccess("Client deleted");
        fetchData();
      }
    } catch {
      setError("Failed to delete");
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!passwordClient) return;
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: passwordClient.id, password: newPassword }),
      });
      if (res.ok) {
        setShowPasswordModal(false);
        setSuccess("Password changed!");
        setNewPassword("");
      } else {
        setError("Failed to change password");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (client: ClientUser) => {
    const newStatus = client.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: client.id, status: newStatus }),
      });
      if (res.ok) {
        setSuccess(`Client ${newStatus === "active" ? "activated" : "blocked"}!`);
        fetchData();
      } else {
        setError("Failed to update status");
      }
    } catch {
      setError("Network error");
    }
  };

  // View specific client detail
  const viewClient = viewClientId ? clients.find((c) => c.id === viewClientId) : null;
  const viewClientData = viewClient ? clientDataMap.get(viewClient.id) : null;

  const [viewBankDetails, setViewBankDetails] = useState<BankDetails | null>(null);
  const [viewPayments, setViewPayments] = useState<PaymentRecord[]>([]);
  const [viewWithdrawals, setViewWithdrawals] = useState<WithdrawRequest[]>([]);

  useEffect(() => {
    if (!viewClient) { setViewBankDetails(null); setViewPayments([]); setViewWithdrawals([]); return; }
    fetch(`/api/client-data?action=getBankDetails&userId=${viewClient.email}`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j?.data) setViewBankDetails(j.data); })
      .catch(() => {});
    fetch(`/api/payments?userId=${viewClient.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j?.data) setViewPayments(j.data); })
      .catch(() => {});
    fetch(`/api/payments?type=withdrawals`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (j?.data) {
          const filtered = j.data.filter((w: WithdrawRequest & { userId?: string }) => w.userId === viewClient.id);
          setViewWithdrawals(filtered);
        }
      })
      .catch(() => {});
  }, [viewClient]);

  const filteredClients = clients.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Client detail view
  if (viewClient) {
    const channels = viewClientData?.channels || [];
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/company-clients")} className="p-2 hover:bg-slate-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{viewClient.name}</h1>
            <p className="text-sm text-muted">{viewClient.email} | {viewClient.phone || "No phone"} | Joined: {viewClient.joinedDate}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-sm text-muted">Channels</p>
            <p className="text-2xl font-bold">{viewClient.channels?.length || 0}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-sm text-muted">Revenue ($)</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(viewClientData?.totalRevenue || 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-sm text-muted">Revenue (INR)</p>
            <p className="text-2xl font-bold text-amber-600">
              {INR_RATE > 0 ? `₹${((viewClientData?.totalRevenue || 0) * INR_RATE).toFixed(0)}` : "—"}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-sm text-muted">Total Views</p>
            <p className="text-2xl font-bold">{formatNumber(viewClientData?.totalViews || 0)}</p>
          </div>
        </div>

        {/* Bank Details */}
        {viewBankDetails && (viewBankDetails.accountNumber || viewBankDetails.upiId || viewBankDetails.panNumber) && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-semibold mb-3">Bank Details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {viewBankDetails.accountName && (
                <div><p className="text-xs text-muted">Account Name</p><p className="font-medium">{viewBankDetails.accountName}</p></div>
              )}
              {viewBankDetails.accountNumber && (
                <div><p className="text-xs text-muted">Account Number</p><p className="font-medium">{viewBankDetails.accountNumber}</p></div>
              )}
              {viewBankDetails.bankName && (
                <div><p className="text-xs text-muted">Bank Name</p><p className="font-medium">{viewBankDetails.bankName}</p></div>
              )}
              {viewBankDetails.ifscCode && (
                <div><p className="text-xs text-muted">IFSC Code</p><p className="font-medium">{viewBankDetails.ifscCode}</p></div>
              )}
              {viewBankDetails.upiId && (
                <div><p className="text-xs text-muted">UPI ID</p><p className="font-medium">{viewBankDetails.upiId}</p></div>
              )}
              {viewBankDetails.panNumber && (
                <div><p className="text-xs text-muted">PAN Number</p><p className="font-medium">{viewBankDetails.panNumber}</p></div>
              )}
            </div>
          </div>
        )}

        {/* Payments */}
        {viewPayments.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-semibold mb-3">Payments</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted">Month</th>
                    <th className="text-right py-2 px-3 font-medium text-muted">Amount</th>
                    <th className="text-right py-2 px-3 font-medium text-muted">Net Total</th>
                    <th className="text-right py-2 px-3 font-medium text-muted">Paid</th>
                    <th className="text-center py-2 px-3 font-medium text-muted">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {viewPayments.map((p) => (
                    <tr key={p.id} className="border-b border-border/30">
                      <td className="py-2 px-3">{p.month || "—"}</td>
                      <td className="py-2 px-3 text-right">${p.totalAmount.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-medium">${p.netTotal.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-green-600">${p.paidAmount.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.status === "paid" ? "bg-green-100 text-green-700" :
                          p.status === "partial" ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Withdrawal Requests */}
        {viewWithdrawals.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-semibold mb-3">Withdrawal Requests</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-right py-2 px-3 font-medium text-muted">Amount</th>
                    <th className="text-center py-2 px-3 font-medium text-muted">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-muted">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {viewWithdrawals.map((w) => (
                    <tr key={w.id} className="border-b border-border/30">
                      <td className="py-2 px-3 text-right font-medium">${w.amount.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          w.status === "paid" ? "bg-green-100 text-green-700" :
                          w.status === "pending" ? "bg-amber-100 text-amber-700" :
                          w.status === "approved" ? "bg-blue-100 text-blue-700" :
                          "bg-red-100 text-red-700"
                        }`}>{w.status}</span>
                      </td>
                      <td className="py-2 px-3 text-muted text-xs">{new Date(w.requestDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {channels.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-semibold mb-4">Channels</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted">Channel</th>
                    <th className="text-right py-3 px-4 font-medium text-muted">Subscribers</th>
                    <th className="text-right py-3 px-4 font-medium text-muted">Views</th>
                    <th className="text-right py-3 px-4 font-medium text-muted">Videos</th>
                    <th className="text-right py-3 px-4 font-medium text-muted">Revenue ($)</th>
                    <th className="text-right py-3 px-4 font-medium text-muted">Revenue (INR)</th>
                    <th className="text-right py-3 px-4 font-medium text-muted">RPM</th>
                    <th className="text-center py-3 px-4 font-medium text-muted">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((ch) => (
                    <tr key={ch.channelId} className="border-b border-border/50 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {ch.thumbnail && <img src={ch.thumbnail} alt="" className="w-7 h-7 rounded-full" />}
                          <span className="font-medium">{ch.channelTitle || ch.channelId}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">{formatNumber(ch.subscribers)}</td>
                      <td className="py-3 px-4 text-right">{formatNumber(ch.views)}</td>
                      <td className="py-3 px-4 text-right">{ch.videoCount}</td>
                      <td className="py-3 px-4 text-right text-green-600">{formatCurrency(ch.estimatedRevenue)}</td>
                      <td className="py-3 px-4 text-right text-amber-600">
                        {INR_RATE > 0 ? `₹${(ch.estimatedRevenue * INR_RATE).toFixed(0)}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">${ch.rpm?.toFixed(2) || "0.00"}</td>
                      <td className="py-3 px-4 text-center">
                        <a href={`https://youtube.com/channel/${ch.channelId}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-dark">
                          <ExternalLink className="w-4 h-4 inline" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Clients</h1>
          <p className="text-sm text-muted mt-1">Manage your clients and their dashboard access.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-64"
            />
          </div>
          <p className="text-sm text-muted">{filteredClients.length} clients</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No clients yet. Click &quot;Add Client&quot; to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-muted">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-muted">Phone</th>
                  <th className="text-center py-3 px-4 font-medium text-muted">Channels</th>
                  <th className="text-right py-3 px-4 font-medium text-muted">Revenue</th>
                  <th className="text-center py-3 px-4 font-medium text-muted">Share %</th>
                  <th className="text-center py-3 px-4 font-medium text-muted">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted">Joined</th>
                  <th className="text-center py-3 px-4 font-medium text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const cd = clientDataMap.get(client.id);
                  return (
                    <tr key={client.id} className="border-b border-border/50 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{client.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted">{client.email}</td>
                      <td className="py-3 px-4 text-muted">{client.phone || "—"}</td>
                      <td className="py-3 px-4 text-center">{client.channels?.length || 0}</td>
                      <td className="py-3 px-4 text-right text-green-600 font-medium">
                        {formatCurrency(cd?.totalRevenue || 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {client.revenueSharePercent ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            {client.revenueSharePercent}%
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          client.status === "active" ? "bg-green-100 text-green-700" :
                          client.status === "pending" ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted text-xs">{client.joinedDate}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => router.push(`/company-clients?view=${client.id}`)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="View Details">
                            <Radio className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEditModal(client)} className="p-1.5 hover:bg-slate-100 rounded text-muted" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setPasswordClient(client); setNewPassword(""); setError(null); setShowPasswordModal(true); }} className="p-1.5 hover:bg-slate-100 rounded text-muted" title="Change Password">
                            <Key className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(client)}
                            className={`p-1.5 rounded ${client.status === "active" ? "hover:bg-amber-50 text-amber-600" : "hover:bg-green-50 text-green-600"}`}
                            title={client.status === "active" ? "Block Client" : "Activate Client"}
                          >
                            {client.status === "active" ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>
                          <button onClick={() => handleDelete(client)} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Client Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingClient ? "Edit Client" : "Add New Client"}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-muted" /></button>
            </div>

            {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{error}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" placeholder="Client name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email *</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" placeholder="client@email.com" disabled={!!editingClient} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Password {editingClient ? "(leave blank to keep)" : "*"}
                </label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none pr-10" placeholder="Min 6 characters" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                <input type="text" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" placeholder="+91 ..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none">
                  <option>Music</option>
                  <option>Entertainment</option>
                  <option>Education</option>
                  <option>Gaming</option>
                  <option>Devotional</option>
                  <option>News</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Revenue Share %</label>
                <input type="number" min={0} max={100} value={formRevenueShare} onChange={(e) => setFormRevenueShare(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" placeholder="0" />
                <p className="text-xs text-muted mt-0.5">Your share: {formRevenueShare}% — Client gets: {100 - formRevenueShare}%</p>
              </div>
            </div>

            <p className="text-xs text-muted">
              After creating the client, share their login credentials. They can log in at{" "}
              <span className="font-medium">cms.intubemedia.com/login</span> and add their YouTube channels.
              All their channel data will automatically appear in your company dashboard.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingClient ? "Save Changes" : "Create Client"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && passwordClient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Change Password</h2>
              <button onClick={() => setShowPasswordModal(false)}><X className="w-5 h-5 text-muted" /></button>
            </div>
            <p className="text-sm text-muted">Change password for <span className="font-medium">{passwordClient.name}</span></p>
            {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium mb-1">New Password</label>
              <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="Min 6 characters" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPasswordModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleChangePassword} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
                {saving ? "Saving..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
