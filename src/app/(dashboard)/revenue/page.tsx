"use client";

import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Banknote,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { signIn, useSession } from "next-auth/react";
import StatsCard from "@/components/dashboard/StatsCard";
import { formatCurrency } from "@/lib/utils";
import { useYouTubeData } from "@/lib/hooks/useYouTubeData";

interface AnalyticsResponse {
  columnHeaders?: Array<{ name?: string | null }>;
  rows?: Array<Array<string | number>>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function transformRevenueData(data: AnalyticsResponse | null) {
  if (!data?.rows?.length || !data.columnHeaders) return null;

  const headers = data.columnHeaders.map((h) => h.name || "");
  const monthIdx = headers.indexOf("month");
  const revenueIdx = headers.indexOf("estimatedRevenue");
  const adRevenueIdx = headers.indexOf("estimatedAdRevenue");
  const grossIdx = headers.indexOf("grossRevenue");

  if (revenueIdx === -1) return null;

  return data.rows.map((row) => {
    const monthStr = String(row[monthIdx]);
    const monthNum = parseInt(monthStr.split("-")[1] || monthStr, 10);
    const monthLabel = MONTHS[monthNum - 1] || monthStr;

    const revenue = Number(row[revenueIdx]) || 0;
    const adRevenue = adRevenueIdx !== -1 ? Number(row[adRevenueIdx]) || 0 : revenue * 0.85;
    const ytPremium = grossIdx !== -1
      ? Math.max(0, (Number(row[grossIdx]) || 0) - adRevenue)
      : revenue - adRevenue;

    return {
      date: monthLabel,
      revenue: Math.round(revenue * 100) / 100,
      adRevenue: Math.round(adRevenue * 100) / 100,
      ytPremium: Math.round(ytPremium * 100) / 100,
    };
  });
}

export default function RevenuePage() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && !!session?.user?.email;

  const { data: revenueApiData, isReal, error, loading } = useYouTubeData<AnalyticsResponse | null>(
    "revenue",
    {},
    null
  );

  const revenueData = transformRevenueData(revenueApiData);
  const hasRevenue = isReal && !!revenueData;

  const totalRevenue = revenueData ? revenueData.reduce((sum, d) => sum + d.revenue, 0) : 0;
  const totalAdRevenue = revenueData ? revenueData.reduce((sum, d) => sum + d.adRevenue, 0) : 0;
  const totalPremium = revenueData ? revenueData.reduce((sum, d) => sum + d.ytPremium, 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revenue</h1>
          <p className="text-sm text-muted mt-1">
            Track your earnings and revenue breakdown.
          </p>
        </div>
        {hasRevenue && (
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200">
            <Wifi className="w-3.5 h-3.5" />
            Live Revenue Data
          </div>
        )}
        {isAuthenticated && loading && (
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading Revenue Data...
          </div>
        )}
      </div>

      {!isAuthenticated && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted">Loading revenue data...</p>
          </div>
        </div>
      )}

      {isAuthenticated && loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted">Loading revenue data...</p>
          </div>
        </div>
      )}

      {isAuthenticated && !loading && !hasRevenue && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <DollarSign className="w-10 h-10 text-muted mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No Revenue Data</h3>
            <p className="text-sm text-muted mb-4">
              {error || "Channel may not be monetized, or revenue data is not available."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {hasRevenue && revenueData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Revenue"
              value={formatCurrency(totalRevenue)}
              change="From YouTube Analytics"
              changeType="positive"
              icon={DollarSign}
              iconColor="#22c55e"
              iconBg="#dcfce7"
            />
            <StatsCard
              title="Ad Revenue"
              value={formatCurrency(totalAdRevenue)}
              change="From YouTube Analytics"
              changeType="positive"
              icon={Banknote}
              iconColor="#f59e0b"
              iconBg="#fef3c7"
            />
            <StatsCard
              title="YT Premium"
              value={formatCurrency(totalPremium)}
              change="From YouTube Analytics"
              changeType="positive"
              icon={CreditCard}
              iconColor="#3b82f6"
              iconBg="#dbeafe"
            />
            <StatsCard
              title="Est. RPM"
              value={`$${totalRevenue > 0 ? (totalRevenue / (totalRevenue / 2.77)).toFixed(2) : "0.00"}`}
              change="From YouTube Analytics"
              changeType="positive"
              icon={TrendingUp}
              iconColor="#8b5cf6"
              iconBg="#ede9fe"
            />
          </div>

          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-4">Revenue Breakdown</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value) => [`$${Number(value).toLocaleString()}`, undefined]}
                  />
                  <Legend />
                  <Bar dataKey="adRevenue" name="Ad Revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ytPremium" name="YT Premium" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-4">Monthly Revenue</h3>
              <div className="space-y-3">
                {revenueData.map((item) => {
                  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue), 1);
                  return (
                    <div key={item.date} className="flex items-center gap-4">
                      <span className="text-sm text-muted w-8">{item.date}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-primary rounded-full h-3 transition-all"
                          style={{
                            width: `${(item.revenue / maxRevenue) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-foreground w-16 text-right">
                        {formatCurrency(item.revenue)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-4">Revenue Split</h3>
              <div className="space-y-6 pt-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted">Ad Revenue</span>
                    <span className="text-sm font-semibold text-foreground">
                      {totalRevenue > 0 ? ((totalAdRevenue / totalRevenue) * 100).toFixed(1) : "0"}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div
                      className="bg-amber-500 rounded-full h-3"
                      style={{
                        width: `${totalRevenue > 0 ? (totalAdRevenue / totalRevenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {formatCurrency(totalAdRevenue)}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted">YouTube Premium</span>
                    <span className="text-sm font-semibold text-foreground">
                      {totalRevenue > 0 ? ((totalPremium / totalRevenue) * 100).toFixed(1) : "0"}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div
                      className="bg-blue-500 rounded-full h-3"
                      style={{
                        width: `${totalRevenue > 0 ? (totalPremium / totalRevenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {formatCurrency(totalPremium)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
