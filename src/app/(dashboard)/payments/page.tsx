"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CreditCard,
  Loader2,
  DollarSign,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Wallet,
  ArrowDownCircle,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { usePendingGuard } from "@/components/ReadOnlyBanner";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { useYouTubeData } from "@/lib/hooks/useYouTubeData";

interface NetworkAssignment {
  networkId: string;
  networkName: string;
  revenueSharePercent: number;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  networks?: NetworkAssignment[];
}

interface Payment {
  id: string;
  month: string;
  fromDate: string;
  toDate: string;
  totalAmount: number;
  networkRevenue: number;
  revenueSharePercent: number;
  tdsPercent: number;
  tdsAmount: number;
  netTotal: number;
  paidAmount: number;
  status: "pending" | "paid" | "partial";
  paidDate: string;
  networkName: string;
}

interface WithdrawRequest {
  id: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  requestDate: string;
  processedDate: string;
  adminNote: string;
}

interface ChannelRevenueInfo {
  revenue: number;
  views: number;
  rpm: number;
}

interface YouTubeChannel {
  id?: string | null;
  snippet?: {
    title?: string | null;
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

interface DashboardData {
  channels?: YouTubeChannel[];
  channelRevenueMap?: Record<string, ChannelRevenueInfo>;
}

function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const startDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const endDate = `${endD.getFullYear()}-${String(endD.getMonth()+1).padStart(2,"0")}-${String(endD.getDate()).padStart(2,"0")}`;
    options.push({ label, startDate, endDate });
  }
  return options;
}

export default function PaymentsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const guardPending = usePendingGuard();
  const [activeChannelIds, setActiveChannelIds] = useState<string[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Withdraw modal
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const currentMonth = monthOptions[selectedMonth];

  const fromDate = currentMonth?.startDate || "";
  const toDate = currentMonth?.endDate || "";

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    fetch("/api/users?action=channelScope", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => setActiveChannelIds(json.data?.channelIds || []))
      .catch(() => setActiveChannelIds([]));
  }, [sessionStatus, session?.user?.email]);

  const fetchUserInfo = useCallback(async () => {
    if (!session?.user?.email) return;
    try {
      const res = await fetch("/api/users?action=me", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setUserInfo(json.data as UserInfo);
      }
    } catch { /* silent */ }
  }, [session?.user?.email]);

  const fetchPayments = useCallback(async () => {
    try {
      const [pRes, wRes] = await Promise.all([
        fetch("/api/payments"),
        fetch("/api/payments?type=withdrawals"),
      ]);
      if (pRes.ok) {
        const pJson = await pRes.json();
        setPayments(pJson.data || []);
      }
      if (wRes.ok) {
        const wJson = await wRes.json();
        setWithdrawals(wJson.data || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      queueMicrotask(() => {
        fetchUserInfo();
        fetchPayments();
      });
    }
  }, [sessionStatus, fetchUserInfo, fetchPayments]);

  // YouTube data for current month
  const apiParams = useMemo(() => ({
    startDate: fromDate,
    endDate: toDate,
    prevStartDate: fromDate,
    prevEndDate: toDate,
    ...(activeChannelIds.length > 0 ? { channelIds: activeChannelIds.join(",") } : {}),
  }), [fromDate, toDate, activeChannelIds]);

  const { data: dashData, isReal, loading: ytLoading } = useYouTubeData<DashboardData>("dashboardFull", apiParams, {});

  const channels = dashData?.channels || [];
  const channelRevenueMap = dashData?.channelRevenueMap || {};

  const primaryNetwork = userInfo?.networks?.[0];
  const revenueSharePercent = primaryNetwork?.revenueSharePercent || 0;

  // Calculate current month revenue from YouTube
  const totalRevenue = Object.values(channelRevenueMap).reduce((s, r) => s + r.revenue, 0);
  const partnerShare = totalRevenue * (revenueSharePercent / 100);
  const afterPartnerShare = totalRevenue - partnerShare;

  // TDS from admin-set payments
  const myPayments = payments;
  const totalTds = myPayments.reduce((s, p) => s + p.tdsAmount, 0);
  const totalNetPayable = myPayments.reduce((s, p) => s + p.netTotal, 0);
  const totalPaid = myPayments.filter((p) => p.status === "paid").reduce((s, p) => s + p.paidAmount, 0);
  const pendingBalance = totalNetPayable > 0 ? totalNetPayable - totalPaid : afterPartnerShare - totalTds;

  // Per-channel breakdown
  const channelBreakdown = channels.map((ch) => {
    const revInfo = channelRevenueMap[ch.id || ""];
    const revenue = revInfo?.revenue || 0;
    const share = revenue * (revenueSharePercent / 100);
    return {
      id: ch.id || "",
      name: ch.snippet?.title || "Unknown",
      thumbnail: ch.snippet?.thumbnails?.default?.url || ch.snippet?.thumbnails?.medium?.url || "",
      views: revInfo?.views || 0,
      rpm: revInfo?.rpm || 0,
      revenue,
      partnerShare: share,
      afterShare: revenue - share,
    };
  });

  const handleWithdraw = async () => {
    if (guardPending()) return;
    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0) {
      setWithdrawError("Valid amount enter karo");
      return;
    }
    if (amt > pendingBalance) {
      setWithdrawError(`Maximum ${formatCurrency(pendingBalance)} withdraw kar sakte ho`);
      return;
    }
    setWithdrawing(true);
    setWithdrawError("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "withdraw",
          userId: userInfo?.id || "",
          userName: userInfo?.name || session?.user?.name || "",
          userEmail: userInfo?.email || session?.user?.email || "",
          amount: amt,
        }),
      });
      if (res.ok) {
        setShowWithdraw(false);
        setWithdrawAmount("");
        fetchPayments();
      }
    } catch { /* silent */ }
    finally { setWithdrawing(false); }
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

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments</h1>
          <p className="text-sm text-muted mt-1">Your revenue breakdown and payment history.</p>
        </div>
        <button
          onClick={() => { setShowWithdraw(true); setWithdrawError(""); setWithdrawAmount(""); }}
          disabled={pendingBalance <= 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            pendingBalance > 0
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          <ArrowDownCircle className="w-4 h-4" />
          Withdraw Payment
        </button>
      </div>

      {/* Top 3 Cards: Total Payment, Partner Share, TDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Total Payment</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-muted">Channel revenue ({currentMonth?.label})</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Partner Share ({revenueSharePercent}%)</p>
              <p className="text-xl font-bold text-red-500">- {formatCurrency(partnerShare)}</p>
              <p className="text-xs text-muted">{primaryNetwork?.networkName || "No network"}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">TDS</p>
              <p className="text-xl font-bold text-red-500">- {formatCurrency(totalTds)}</p>
              <p className="text-xs text-muted">Tax deducted at source</p>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-green-700 font-medium">Available Balance</p>
            <p className="text-3xl font-bold text-green-700">{formatCurrency(pendingBalance > 0 ? pendingBalance : afterPartnerShare)}</p>
            <p className="text-xs text-green-600 mt-1">
              {totalPaid > 0 ? `${formatCurrency(totalPaid)} already paid` : "After partner share deduction"}
            </p>
          </div>
          <button
            onClick={() => { setShowWithdraw(true); setWithdrawError(""); setWithdrawAmount(""); }}
            disabled={pendingBalance <= 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium ${
              pendingBalance > 0
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" />
            Withdraw
          </button>
        </div>
      </div>

      {/* Month Selection */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex items-center gap-4">
          <Calendar className="w-4 h-4 text-muted" />
          <select
            value={String(selectedMonth)}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="border border-border rounded-lg px-3 py-2 text-sm min-w-[200px]"
          >
            {monthOptions.map((m, i) => (
              <option key={i} value={String(i)}>{m.label}</option>
            ))}
          </select>
          <span className="text-xs text-muted">{fromDate} <ArrowRight className="w-3 h-3 inline" /> {toDate}</span>
          {ytLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
      </div>

      {/* Per-Channel Revenue Breakdown */}
      {isReal && channelBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-slate-50">
            <h2 className="text-sm font-semibold text-foreground">Per-Channel Revenue Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold">Channel</th>
                  <th className="text-right px-4 py-3 font-semibold">Views</th>
                  <th className="text-right px-4 py-3 font-semibold">RPM</th>
                  <th className="text-right px-4 py-3 font-semibold">Revenue</th>
                  <th className="text-right px-4 py-3 font-semibold">Partner Share ({revenueSharePercent}%)</th>
                  <th className="text-right px-4 py-3 font-semibold">After Share</th>
                </tr>
              </thead>
              <tbody>
                {channelBreakdown.map((ch) => (
                  <tr key={ch.id} className="border-b border-border hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {ch.thumbnail && (
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 shrink-0">
                            <img src={ch.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        <span className="font-medium">{ch.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{formatNumber(ch.views)}</td>
                    <td className="px-4 py-3 text-right">${ch.rpm.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(ch.revenue)}</td>
                    <td className="px-4 py-3 text-right text-red-500">-{formatCurrency(ch.partnerShare)}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(ch.afterShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-slate-50">
          <h2 className="text-sm font-semibold text-foreground">Payment History</h2>
        </div>
        {myPayments.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No payment records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold">Period</th>
                  <th className="text-right px-4 py-3 font-semibold">Total</th>
                  <th className="text-right px-4 py-3 font-semibold">Partner Share</th>
                  <th className="text-right px-4 py-3 font-semibold">TDS</th>
                  <th className="text-right px-4 py-3 font-semibold">Net Payable</th>
                  <th className="text-right px-4 py-3 font-semibold">Paid</th>
                  <th className="text-right px-4 py-3 font-semibold">Pending</th>
                  <th className="text-center px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {myPayments.map((p) => (
                  <tr key={p.id} className="border-b border-border hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="text-foreground font-medium">{p.month || `${p.fromDate} - ${p.toDate}`}</div>
                      <div className="text-xs text-muted">{p.networkName}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-muted">-{formatCurrency(p.networkRevenue)} ({p.revenueSharePercent}%)</td>
                    <td className="px-4 py-3 text-right text-muted">-{formatCurrency(p.tdsAmount)} ({p.tdsPercent}%)</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(p.netTotal)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(p.paidAmount)}</td>
                    <td className="px-4 py-3 text-right text-orange-500">{formatCurrency(p.netTotal - p.paidAmount)}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(p.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Withdraw Requests */}
      {withdrawals.length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-slate-50">
            <h2 className="text-sm font-semibold text-foreground">Withdraw Requests</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-right px-4 py-3 font-semibold">Amount</th>
                  <th className="text-center px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-border hover:bg-slate-50">
                    <td className="px-4 py-3">{new Date(w.requestDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(w.amount)}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(w.status)}</td>
                    <td className="px-4 py-3 text-muted">{w.adminNote || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-5">
            <h3 className="text-lg font-semibold text-foreground mb-1">Withdraw Payment</h3>
            <p className="text-sm text-muted mb-4">Available balance: <span className="font-bold text-green-600">{formatCurrency(pendingBalance)}</span></p>
            {withdrawError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 mb-3">{withdrawError}</div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1">Amount</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount"
                min={1}
                max={pendingBalance}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowWithdraw(false)} className="px-4 py-2 text-sm text-muted hover:bg-slate-100 rounded-lg">Cancel</button>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {withdrawing && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
