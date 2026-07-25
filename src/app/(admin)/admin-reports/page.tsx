"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Shield,
  BarChart3,
  DollarSign,
  FileText,
  Download,
  Loader2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/utils";
import { useExchangeRate } from "@/lib/hooks/useExchangeRate";

interface Client {
  id: string;
  name: string;
  channels: string[];
  status: "active" | "inactive";
  category: string;
}

function getMonthOptions() {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    months.push({ value: val, label });
  }
  return months;
}

function getDateRangeForFilter(filter: string): { startDate: string; endDate: string } {
  if (filter.match(/^\d{4}-\d{2}$/)) {
    const [year, month] = filter.split("-").map(Number);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    const endDay = isCurrentMonth ? now.getDate() : lastDay;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    return { startDate, endDate };
  }
  const numDays = parseInt(filter.replace("d", "")) || 28;
  const endD = new Date();
  const endDate = `${endD.getFullYear()}-${String(endD.getMonth()+1).padStart(2,"0")}-${String(endD.getDate()).padStart(2,"0")}`;
  const startD = new Date();
  startD.setDate(startD.getDate() - numDays);
  const startDate = `${startD.getFullYear()}-${String(startD.getMonth()+1).padStart(2,"0")}-${String(startD.getDate()).padStart(2,"0")}`;
  return { startDate, endDate };
}

export default function AdminReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [dateRange, setDateRange] = useState("28d");
  const [clientRevenueData, setClientRevenueData] = useState<Record<string, number>>({});
  const [revenueLoading, setRevenueLoading] = useState(false);
  const { rate: INR_RATE } = useExchangeRate("USD");

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch("/api/users?action=list");
        if (res.ok) {
          const json = await res.json();
          setClients(json.data || []);
        }
      } catch { /* silent */ }
    };
    if (status === "authenticated") fetchClients();
  }, [status]);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const fetchRevenue = useCallback(async () => {
    const allChannelIds = clients.flatMap((c) => c.channels).filter(Boolean);
    if (allChannelIds.length === 0) return;
    setRevenueLoading(true);
    try {
      const { startDate, endDate } = getDateRangeForFilter(dateRange);
      const res = await fetch(`/api/youtube?action=dashboardFull&channelIds=${encodeURIComponent(allChannelIds.join(","))}&startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const json = await res.json();
        const crMap = json.data?.channelRevenueMap || {};
        // Map channel revenue to client
        const clientRevMap: Record<string, number> = {};
        for (const client of clients) {
          let total = 0;
          for (const chId of client.channels) {
            const chRev = crMap[chId] as { revenue: number } | undefined;
            total += chRev?.revenue || 0;
          }
          clientRevMap[client.id] = total;
        }
        setClientRevenueData(clientRevMap);
      }
    } catch { /* silent */ }
    setRevenueLoading(false);
  }, [clients, dateRange]);

  useEffect(() => {
    if (clients.length > 0) fetchRevenue();
  }, [fetchRevenue, clients.length]);

  const totalRevenue = Object.values(clientRevenueData).reduce((s, r) => s + r, 0);
  const totalChannels = clients.reduce((sum, c) => sum + c.channels.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Shield className="w-4 h-4 text-red-500" />
        <span className="text-red-500 font-medium">Admin</span>
        <span>›</span>
        <span className="text-foreground font-medium">Reports</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revenue Reports</h1>
          <p className="text-sm text-muted mt-1">
            Overview of revenue and performance across all clients.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="28d">Last 28 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">Last 365 days</option>
            <optgroup label="By Month">
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </optgroup>
          </select>
          {revenueLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted">Total Revenue</p>
              <p className="text-xl font-bold text-foreground">${totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-muted">₹{formatNumber(Math.round(totalRevenue * INR_RATE))}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted">Revenue Channels</p>
              <p className="text-xl font-bold text-foreground">{totalChannels}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted">Active Clients</p>
              <p className="text-xl font-bold text-foreground">
                {clients.filter((c) => c.status === "active").length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted">Avg Revenue/Channel</p>
              <p className="text-xl font-bold text-foreground">${totalChannels > 0 ? (totalRevenue / totalChannels).toFixed(2) : "0.00"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Client Revenue Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Client Revenue Summary</h2>
          <button className="flex items-center gap-2 text-sm text-primary hover:text-primary-dark font-medium">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Channels</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Revenue ($)</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Revenue (INR)</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-border hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                        {client.name[0]}
                      </div>
                      <span className="font-medium text-foreground">{client.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{client.category}</td>
                  <td className="px-4 py-3 text-foreground">{client.channels.length}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        client.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {client.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">${(clientRevenueData[client.id] || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-700">₹{formatNumber(Math.round((clientRevenueData[client.id] || 0) * INR_RATE))}</td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    No clients found. Add clients first to see revenue data.
                  </td>
                </tr>
              )}
            </tbody>
            {clients.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-semibold border-t-2 border-border">
                  <td className="px-4 py-3 text-foreground">Total</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-foreground">{totalChannels}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right text-green-700">${totalRevenue.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-amber-700">₹{formatNumber(Math.round(totalRevenue * INR_RATE))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
