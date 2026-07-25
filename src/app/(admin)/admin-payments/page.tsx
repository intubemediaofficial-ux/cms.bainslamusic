"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  X,
  Loader2,
  Shield,
  CreditCard,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  DollarSign,
  Trash2,
  ArrowDownCircle,
  Wallet,
  Bell,
  Download,
  Zap,
  FileText,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Payment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  networkId: string;
  networkName: string;
  revenueSharePercent: number;
  month: string;
  fromDate: string;
  toDate: string;
  totalAmount: number;
  tdsPercent: number;
  tdsAmount: number;
  networkRevenue: number;
  netTotal: number;
  paidAmount: number;
  status: "pending" | "paid" | "partial";
  createdDate: string;
  paidDate: string;
  notes: string;
}

interface WithdrawRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  requestDate: string;
  processedDate: string;
  adminNote: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  networks?: { networkId: string; networkName: string; revenueSharePercent: number }[];
}

export default function AdminPaymentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"payments" | "withdrawals">("payments");

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedNetworkIdx, setSelectedNetworkIdx] = useState("");
  const [month, setMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [tdsPercent, setTdsPercent] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"payment" | "withdrawal">("payment");
  const [deleting, setDeleting] = useState(false);

  // Withdraw action
  const [withdrawAction, setWithdrawAction] = useState<{ id: string; action: string; note: string } | null>(null);
  const [processingWithdraw, setProcessingWithdraw] = useState(false);

  // Bulk payment
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMonth, setBulkMonth] = useState("");
  const [bulkFromDate, setBulkFromDate] = useState("");
  const [bulkToDate, setBulkToDate] = useState("");
  const [bulkTdsPercent, setBulkTdsPercent] = useState("0");
  const [bulkAmounts, setBulkAmounts] = useState<Record<string, string>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [pRes, uRes, wRes] = await Promise.all([
        fetch("/api/payments"),
        fetch("/api/users"),
        fetch("/api/payments?type=withdrawals"),
      ]);
      if (pRes.ok) {
        const pJson = await pRes.json();
        setPayments(pJson.data || []);
      }
      if (uRes.ok) {
        const uJson = await uRes.json();
        setUsers(uJson.data || []);
      }
      if (wRes.ok) {
        const wJson = await wRes.json();
        setWithdrawals(wJson.data || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "admin") {
      fetchData();
    }
  }, [status, session, fetchData]);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const selectedNetwork = selectedUser?.networks?.[Number(selectedNetworkIdx)] || null;

  const previewRevShare = selectedNetwork?.revenueSharePercent || 0;
  const previewTotal = Number(totalAmount) || 0;
  const previewNetworkRev = previewTotal * (previewRevShare / 100);
  const previewTds = Number(tdsPercent) || 0;
  const previewTdsAmount = (previewTotal - previewNetworkRev) * (previewTds / 100);
  const previewNet = previewTotal - previewNetworkRev - previewTdsAmount;

  const handleCreate = async () => {
    if (!selectedUserId || !fromDate || !toDate || !totalAmount) {
      setFormError("Please fill all required fields");
      return;
    }
    setSaving(true);
    setFormError("");

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          userName: selectedUser?.name || "",
          userEmail: selectedUser?.email || "",
          networkId: selectedNetwork?.networkId || "",
          networkName: selectedNetwork?.networkName || "",
          revenueSharePercent: previewRevShare,
          month,
          fromDate,
          toDate,
          totalAmount: previewTotal,
          tdsPercent: previewTds,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create payment");
        return;
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch {
      setFormError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedUserId("");
    setSelectedNetworkIdx("");
    setMonth("");
    setFromDate("");
    setToDate("");
    setTotalAmount("");
    setTdsPercent("0");
    setNotes("");
    setFormError("");
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await fetch("/api/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      fetchData();
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const typeParam = deleteType === "withdrawal" ? "&type=withdrawal" : "";
      const res = await fetch(`/api/payments?id=${id}${typeParam}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteId(null);
        fetchData();
      }
    } catch { /* silent */ }
    finally { setDeleting(false); }
  };

  const handleWithdrawAction = async () => {
    if (!withdrawAction) return;
    setProcessingWithdraw(true);
    try {
      await fetch("/api/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "withdrawal",
          id: withdrawAction.id,
          status: withdrawAction.action,
          adminNote: withdrawAction.note,
        }),
      });
      setWithdrawAction(null);
      fetchData();
    } catch { /* silent */ }
    finally { setProcessingWithdraw(false); }
  };

  const handleBulkCreate = async () => {
    if (!bulkFromDate || !bulkToDate) return;
    setBulkSaving(true);
    try {
      const items = users
        .filter((u) => bulkAmounts[u.id] && Number(bulkAmounts[u.id]) > 0)
        .map((u) => {
          const net = u.networks?.[0];
          return {
            userId: u.id,
            userName: u.name,
            userEmail: u.email,
            networkId: net?.networkId || "",
            networkName: net?.networkName || "",
            revenueSharePercent: net?.revenueSharePercent || 0,
            month: bulkMonth,
            fromDate: bulkFromDate,
            toDate: bulkToDate,
            totalAmount: Number(bulkAmounts[u.id]) || 0,
            tdsPercent: Number(bulkTdsPercent) || 0,
          };
        });

      if (items.length === 0) { setBulkSaving(false); return; }

      await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bulk", items }),
      });
      setShowBulkModal(false);
      setBulkAmounts({});
      setBulkMonth("");
      setBulkFromDate("");
      setBulkToDate("");
      setBulkTdsPercent("0");
      fetchData();
    } catch { /* silent */ }
    finally { setBulkSaving(false); }
  };

  const exportCSV = () => {
    const headers = ["Client", "Email", "Period", "Network", "Total", "Network Share", "TDS", "Net Payable", "Paid", "Pending", "Status"];
    const rows = filtered.map((p) => [
      p.userName, p.userEmail,
      `${p.fromDate} - ${p.toDate}`,
      p.networkName || "-",
      p.totalAmount.toFixed(2),
      `${p.networkRevenue.toFixed(2)} (${p.revenueSharePercent}%)`,
      `${p.tdsAmount.toFixed(2)} (${p.tdsPercent}%)`,
      p.netTotal.toFixed(2),
      p.paidAmount.toFixed(2),
      (p.netTotal - p.paidAmount).toFixed(2),
      p.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "paid":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" /> Paid</span>;
      case "partial":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Clock className="w-3 h-3" /> Partial</span>;
      case "approved":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
      case "rejected":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><X className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><AlertCircle className="w-3 h-3" /> Pending</span>;
    }
  };

  const filtered = payments.filter((p) => {
    const matchSearch = p.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.networkName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPaid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.paidAmount, 0);
  const totalPending = payments.reduce((s, p) => s + (p.netTotal - p.paidAmount), 0);
  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Shield className="w-4 h-4 text-red-500" />
        <span className="text-red-500 font-medium">Admin Panel</span>
        <span>&rsaquo;</span>
        <span className="text-foreground font-medium">Payments</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Management</h1>
          <p className="text-sm text-muted mt-1">Manage payments, TDS, and withdraw requests.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Bulk Create
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Payment
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted uppercase">Total Paid</p>
              <p className="text-xl font-bold text-foreground">${totalPaid.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-muted uppercase">Total Pending</p>
              <p className="text-xl font-bold text-foreground">${totalPending.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted uppercase">Total Payments</p>
              <p className="text-xl font-bold text-foreground">{payments.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted uppercase">Withdraw Requests</p>
              <p className="text-xl font-bold text-foreground">{pendingWithdrawals.length} pending</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("payments")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "payments" ? "bg-white shadow text-foreground" : "text-muted hover:text-foreground"}`}
        >
          <CreditCard className="w-4 h-4 inline mr-1" />
          Payments ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab("withdrawals")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "withdrawals" ? "bg-white shadow text-foreground" : "text-muted hover:text-foreground"}`}
        >
          <ArrowDownCircle className="w-4 h-4 inline mr-1" />
          Withdrawals ({withdrawals.length})
          {pendingWithdrawals.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{pendingWithdrawals.length}</span>
          )}
        </button>
      </div>

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-slate-50 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, network..."
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm bg-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-muted">No payments found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold">Client</th>
                    <th className="text-left px-4 py-3 font-semibold">Period</th>
                    <th className="text-left px-4 py-3 font-semibold">Network</th>
                    <th className="text-right px-4 py-3 font-semibold">Total</th>
                    <th className="text-right px-4 py-3 font-semibold">Share</th>
                    <th className="text-right px-4 py-3 font-semibold">TDS</th>
                    <th className="text-right px-4 py-3 font-semibold">Net</th>
                    <th className="text-right px-4 py-3 font-semibold">Paid</th>
                    <th className="text-right px-4 py-3 font-semibold">Pending</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                    <th className="text-center px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-border hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{p.userName}</p>
                          <p className="text-xs text-muted">{p.userEmail}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          {p.month && <div className="font-medium text-foreground">{p.month}</div>}
                          <div className="flex items-center gap-1 text-muted">
                            <Calendar className="w-3 h-3" />
                            {p.fromDate} <ArrowRight className="w-3 h-3" /> {p.toDate}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground text-xs">{p.networkName || "-"}</td>
                      <td className="px-4 py-3 text-right">${p.totalAmount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-muted text-xs">${p.networkRevenue.toFixed(2)} ({p.revenueSharePercent}%)</td>
                      <td className="px-4 py-3 text-right text-muted text-xs">${p.tdsAmount.toFixed(2)} ({p.tdsPercent}%)</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">${p.netTotal.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-green-500">${p.paidAmount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-orange-500">${(p.netTotal - p.paidAmount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={p.status}
                          onChange={(e) => handleStatusChange(p.id, e.target.value)}
                          className="text-xs border border-border rounded px-1 py-0.5"
                        >
                          <option value="pending">Pending</option>
                          <option value="partial">Partial</option>
                          <option value="paid">Paid</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => { setDeleteId(p.id); setDeleteType("payment"); }}
                          className="p-1 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Withdrawals Tab */}
      {activeTab === "withdrawals" && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-slate-50">
            <h3 className="text-sm font-semibold text-foreground">Client Withdraw Requests</h3>
            <p className="text-xs text-muted">Review and approve/reject client withdrawal requests.</p>
          </div>
          {withdrawals.length === 0 ? (
            <div className="py-16 text-center">
              <ArrowDownCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-muted">No withdraw requests yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold">Client</th>
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-right px-4 py-3 font-semibold">Amount</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Note</th>
                    <th className="text-center px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id} className={`border-b border-border hover:bg-slate-50 ${w.status === "pending" ? "bg-yellow-50/50" : ""}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{w.userName}</p>
                          <p className="text-xs text-muted">{w.userEmail}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{new Date(w.requestDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">${w.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">{getStatusBadge(w.status)}</td>
                      <td className="px-4 py-3 text-xs text-muted">{w.adminNote || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {w.status === "pending" && (
                            <>
                              <button
                                onClick={() => setWithdrawAction({ id: w.id, action: "paid", note: "" })}
                                className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200"
                              >
                                Pay
                              </button>
                              <button
                                onClick={() => setWithdrawAction({ id: w.id, action: "rejected", note: "" })}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => { setDeleteId(w.id); setDeleteType("withdrawal"); }}
                            className="p-1 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-foreground">Create Payment</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Client *</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => { setSelectedUserId(e.target.value); setSelectedNetworkIdx(""); }}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                >
                  <option value="">Select Client</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>

              {selectedUser && selectedUser.networks && selectedUser.networks.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Network</label>
                  <select
                    value={selectedNetworkIdx}
                    onChange={(e) => setSelectedNetworkIdx(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  >
                    <option value="">Select Network</option>
                    {selectedUser.networks.map((n, i) => (
                      <option key={n.networkId} value={String(i)}>{n.networkName} ({n.revenueSharePercent}% rev share)</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Month Label</label>
                <input
                  type="text"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="e.g. January 2026"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">From Date *</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">To Date *</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Total Revenue Amount *</label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="e.g. 1000"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">TDS %</label>
                  <input
                    type="number"
                    value={tdsPercent}
                    onChange={(e) => setTdsPercent(e.target.value)}
                    placeholder="e.g. 10"
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none"
                />
              </div>

              {previewTotal > 0 && (
                <div className="bg-slate-50 rounded-lg p-4 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Payment Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted">Total Revenue</span>
                      <span className="font-medium">${previewTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Network Share ({previewRevShare}%)</span>
                      <span className="text-red-500">- ${previewNetworkRev.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">After Share</span>
                      <span>${(previewTotal - previewNetworkRev).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">TDS ({previewTds}%)</span>
                      <span className="text-red-500">- ${previewTdsAmount.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between">
                      <span className="font-semibold text-foreground">Net Payable to Client</span>
                      <span className="font-bold text-green-600 text-lg">${previewNet.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-muted hover:bg-slate-100 rounded-lg">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Action Modal */}
      {withdrawAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-5">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {withdrawAction.action === "paid" ? "Mark as Paid" : "Reject Request"}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1">Admin Note</label>
              <textarea
                value={withdrawAction.note}
                onChange={(e) => setWithdrawAction({ ...withdrawAction, note: e.target.value })}
                placeholder="Optional note for client..."
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setWithdrawAction(null)} className="px-4 py-2 text-sm text-muted hover:bg-slate-100 rounded-lg">Cancel</button>
              <button
                onClick={handleWithdrawAction}
                disabled={processingWithdraw}
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${
                  withdrawAction.action === "paid" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {processingWithdraw && <Loader2 className="w-4 h-4 animate-spin" />}
                {withdrawAction.action === "paid" ? "Mark Paid" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-5">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete {deleteType === "withdrawal" ? "Withdrawal" : "Payment"}?</h3>
            <p className="text-sm text-muted mb-4">Are you sure? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-muted hover:bg-slate-100 rounded-lg">Cancel</button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Payment Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Bulk Create Payments
              </h2>
              <button onClick={() => setShowBulkModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Month Label</label>
                  <input type="text" value={bulkMonth} onChange={(e) => setBulkMonth(e.target.value)} placeholder="e.g. January 2026" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">From Date *</label>
                  <input type="date" value={bulkFromDate} onChange={(e) => setBulkFromDate(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">To Date *</label>
                  <input type="date" value={bulkToDate} onChange={(e) => setBulkToDate(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">TDS % (applied to all)</label>
                <input type="number" value={bulkTdsPercent} onChange={(e) => setBulkTdsPercent(e.target.value)} min="0" max="100" className="w-32 px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Client Amounts</h4>
                <p className="text-xs text-muted mb-3">Enter total revenue amount for each client. Leave empty to skip.</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-2 border border-border rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{u.name}</p>
                        <p className="text-xs text-muted">{u.email} {u.networks?.[0] ? `• ${u.networks[0].networkName} (${u.networks[0].revenueSharePercent}%)` : ""}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted">$</span>
                        <input
                          type="number"
                          value={bulkAmounts[u.id] || ""}
                          onChange={(e) => setBulkAmounts({ ...bulkAmounts, [u.id]: e.target.value })}
                          placeholder="0"
                          min="0"
                          className="w-28 px-2 py-1.5 border border-border rounded text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border sticky bottom-0 bg-white">
              <button onClick={() => setShowBulkModal(false)} className="px-4 py-2 text-sm text-muted hover:bg-slate-100 rounded-lg">Cancel</button>
              <button
                onClick={handleBulkCreate}
                disabled={bulkSaving || !bulkFromDate || !bulkToDate}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
              >
                {bulkSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Payments ({Object.values(bulkAmounts).filter((v) => Number(v) > 0).length} clients)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
