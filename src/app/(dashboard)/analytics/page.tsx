"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { signIn, useSession } from "next-auth/react";
import ViewsChart from "@/components/charts/ViewsChart";
import SubscriberChart from "@/components/charts/SubscriberChart";
import { formatNumber } from "@/lib/utils";
import { Globe, MonitorPlay, Smartphone, Loader2, WifiOff } from "lucide-react";
import { useYouTubeData } from "@/lib/hooks/useYouTubeData";

const COLORS = ["#f59e0b", "#3b82f6", "#22c55e", "#ef4444", "#8b5cf6", "#ec4899"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface AnalyticsResponse {
  columnHeaders?: Array<{ name?: string | null }>;
  rows?: Array<Array<string | number>>;
}

function transformTrafficSources(data: AnalyticsResponse | null) {
  if (!data?.rows?.length || !data.columnHeaders) return [];
  const headers = data.columnHeaders.map((h) => h.name || "");
  const sourceIdx = headers.indexOf("insightTrafficSourceType");
  const viewsIdx = headers.indexOf("views");
  if (sourceIdx === -1 || viewsIdx === -1) return [];

  const totalViews = data.rows.reduce((sum, row) => sum + (Number(row[viewsIdx]) || 0), 0);
  return data.rows.map((row) => {
    const views = Number(row[viewsIdx]) || 0;
    return {
      source: String(row[sourceIdx]).replace(/_/g, " "),
      views,
      percentage: totalViews > 0 ? Math.round((views / totalViews) * 100) : 0,
    };
  });
}

function transformDemographics(data: AnalyticsResponse | null) {
  if (!data?.rows?.length || !data.columnHeaders) return [];
  const headers = data.columnHeaders.map((h) => h.name || "");
  const ageIdx = headers.indexOf("ageGroup");
  const genderIdx = headers.indexOf("gender");
  const percentIdx = headers.indexOf("viewerPercentage");
  if (ageIdx === -1 || genderIdx === -1 || percentIdx === -1) return [];

  const ageMap: Record<string, { male: number; female: number }> = {};
  for (const row of data.rows) {
    const age = String(row[ageIdx]).replace("age", "");
    const gender = String(row[genderIdx]).toLowerCase();
    const pct = Number(row[percentIdx]) || 0;
    if (!ageMap[age]) ageMap[age] = { male: 0, female: 0 };
    if (gender === "male") ageMap[age].male = Math.round(pct * 10) / 10;
    else if (gender === "female") ageMap[age].female = Math.round(pct * 10) / 10;
  }
  return Object.entries(ageMap).map(([age, data]) => ({ age, ...data }));
}

function transformCountryData(data: AnalyticsResponse | null) {
  if (!data?.rows?.length || !data.columnHeaders) return [];
  const headers = data.columnHeaders.map((h) => h.name || "");
  const countryIdx = headers.indexOf("country");
  const viewsIdx = headers.indexOf("views");
  if (countryIdx === -1 || viewsIdx === -1) return [];

  const totalViews = data.rows.reduce((sum, row) => sum + (Number(row[viewsIdx]) || 0), 0);
  return data.rows.map((row) => {
    const views = Number(row[viewsIdx]) || 0;
    return {
      country: String(row[countryIdx]),
      views,
      percentage: totalViews > 0 ? Math.round((views / totalViews) * 100) : 0,
    };
  });
}

function transformDeviceData(data: AnalyticsResponse | null) {
  if (!data?.rows?.length || !data.columnHeaders) return [];
  const headers = data.columnHeaders.map((h) => h.name || "");
  const deviceIdx = headers.indexOf("deviceType");
  const viewsIdx = headers.indexOf("views");
  if (deviceIdx === -1 || viewsIdx === -1) return [];

  const totalViews = data.rows.reduce((sum, row) => sum + (Number(row[viewsIdx]) || 0), 0);
  return data.rows.map((row) => {
    const views = Number(row[viewsIdx]) || 0;
    return {
      device: String(row[deviceIdx]),
      views,
      percentage: totalViews > 0 ? Math.round((views / totalViews) * 100) : 0,
    };
  });
}

function transformAnalyticsToViewsData(analytics: AnalyticsResponse | null) {
  if (!analytics?.rows?.length || !analytics.columnHeaders) return [];
  const headers = analytics.columnHeaders.map((h) => h.name || "");
  const dayIdx = headers.indexOf("day");
  const viewsIdx = headers.indexOf("views");
  if (dayIdx === -1 || viewsIdx === -1) return [];

  const monthMap: Record<string, number> = {};
  for (const row of analytics.rows) {
    const dateStr = String(row[dayIdx]);
    const monthNum = parseInt(dateStr.split("-")[1] || "0", 10);
    const key = MONTHS[monthNum - 1] || dateStr;
    monthMap[key] = (monthMap[key] || 0) + (Number(row[viewsIdx]) || 0);
  }
  return Object.entries(monthMap).map(([date, views]) => ({ date, views }));
}

function transformAnalyticsToSubscriberData(analytics: AnalyticsResponse | null) {
  if (!analytics?.rows?.length || !analytics.columnHeaders) return [];
  const headers = analytics.columnHeaders.map((h) => h.name || "");
  const dayIdx = headers.indexOf("day");
  const gainedIdx = headers.indexOf("subscribersGained");
  const lostIdx = headers.indexOf("subscribersLost");
  if (dayIdx === -1 || gainedIdx === -1) return [];

  const monthMap: Record<string, number> = {};
  for (const row of analytics.rows) {
    const dateStr = String(row[dayIdx]);
    const monthNum = parseInt(dateStr.split("-")[1] || "0", 10);
    const key = MONTHS[monthNum - 1] || dateStr;
    const gained = Number(row[gainedIdx]) || 0;
    const lost = lostIdx !== -1 ? Number(row[lostIdx]) || 0 : 0;
    monthMap[key] = (monthMap[key] || 0) + (gained - lost);
  }

  let cumulative = 0;
  return Object.entries(monthMap).map(([date, net]) => {
    cumulative += net;
    return { date, subscribers: cumulative };
  });
}

const DEVICE_ICONS: Record<string, { icon: typeof MonitorPlay; color: string; bg: string }> = {
  DESKTOP: { icon: MonitorPlay, color: "text-blue-600", bg: "bg-blue-100" },
  MOBILE: { icon: Smartphone, color: "text-green-600", bg: "bg-green-100" },
  TABLET: { icon: MonitorPlay, color: "text-purple-600", bg: "bg-purple-100" },
  TV: { icon: MonitorPlay, color: "text-amber-600", bg: "bg-amber-100" },
  GAME_CONSOLE: { icon: MonitorPlay, color: "text-red-600", bg: "bg-red-100" },
};

const DEVICE_BAR_COLORS: Record<string, string> = {
  DESKTOP: "bg-blue-500",
  MOBILE: "bg-green-500",
  TABLET: "bg-purple-500",
  TV: "bg-amber-500",
  GAME_CONSOLE: "bg-red-500",
};

export default function AnalyticsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated" && !!session?.user?.email;

  const { data: analyticsData, isReal: analyticsReal, loading: analyticsLoading } = useYouTubeData<AnalyticsResponse | null>(
    "analytics",
    {},
    null
  );
  const { data: trafficData, isReal: trafficReal, loading: trafficLoading } = useYouTubeData<AnalyticsResponse | null>(
    "traffic",
    {},
    null
  );
  const { data: demographicsData, isReal: demoReal, loading: demoLoading } = useYouTubeData<AnalyticsResponse | null>(
    "demographics",
    {},
    null
  );
  const { data: countryApiData, isReal: countryReal, loading: countryLoading } = useYouTubeData<AnalyticsResponse | null>(
    "countries",
    {},
    null
  );
  const { data: deviceApiData, isReal: deviceReal, loading: deviceLoading } = useYouTubeData<AnalyticsResponse | null>(
    "devices",
    {},
    null
  );

  const isLoading = analyticsLoading || trafficLoading || demoLoading || countryLoading || deviceLoading;
  const hasData = analyticsReal || trafficReal || demoReal || countryReal || deviceReal;

  const trafficSources = transformTrafficSources(trafficData);
  const demographics = transformDemographics(demographicsData);
  const countryData = transformCountryData(countryApiData);
  const deviceData = transformDeviceData(deviceApiData);
  const viewsChartData = analyticsReal ? transformAnalyticsToViewsData(analyticsData) : undefined;
  const subscriberChartData = analyticsReal ? transformAnalyticsToSubscriberData(analyticsData) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted mt-1">
          Detailed analytics and insights for your channels.
        </p>
      </div>

      {!isAuthenticated && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted">Loading analytics...</p>
          </div>
        </div>
      )}

      {isAuthenticated && isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted">Loading analytics data...</p>
          </div>
        </div>
      )}

      {isAuthenticated && !isLoading && !hasData && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <WifiOff className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Could Not Load Analytics</h3>
            <p className="text-sm text-muted mb-4">Please try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {isAuthenticated && !isLoading && hasData && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ViewsChart data={viewsChartData} />
            <SubscriberChart data={subscriberChartData} />
          </div>

          {trafficSources.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-border p-5">
                <h3 className="font-semibold text-foreground mb-4">Traffic Sources</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={trafficSources}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="percentage"
                        nameKey="source"
                        label={(props) => `${props.name ?? ""}: ${props.value}%`}
                        labelLine={true}
                      >
                        {trafficSources.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value}%`, "Share"]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {demographics.length > 0 && (
                <div className="bg-white rounded-xl border border-border p-5">
                  <h3 className="font-semibold text-foreground mb-4">
                    Audience Demographics
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={demographics} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          type="number"
                          tick={{ fill: "#64748b", fontSize: 12 }}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis
                          dataKey="age"
                          type="category"
                          tick={{ fill: "#64748b", fontSize: 12 }}
                          width={50}
                        />
                        <Tooltip
                          formatter={(value) => [`${value}%`, undefined]}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="male" name="Male" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="female" name="Female" fill="#ec4899" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {countryData.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-muted" />
                <h3 className="font-semibold text-foreground">
                  Top Countries by Views
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                        Country
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                        Views
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                        Share
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                        Distribution
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {countryData.map((item) => (
                      <tr
                        key={item.country}
                        className="border-b border-border/50 hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm font-medium text-foreground">
                          {item.country}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground text-right">
                          {formatNumber(item.views)}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground text-right">
                          {item.percentage}%
                        </td>
                        <td className="py-3 px-4">
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div
                              className="bg-primary rounded-full h-2 transition-all"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {deviceData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {deviceData.map((item) => {
                const config = DEVICE_ICONS[item.device] || DEVICE_ICONS.DESKTOP;
                const barColor = DEVICE_BAR_COLORS[item.device] || "bg-blue-500";
                const IconComponent = config.icon;
                return (
                  <div key={item.device} className="bg-white rounded-xl border border-border p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 ${config.bg} rounded-lg flex items-center justify-center`}>
                        <IconComponent className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div>
                        <p className="text-sm text-muted">{item.device}</p>
                        <p className="text-lg font-bold text-foreground">{item.percentage}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className={`${barColor} rounded-full h-1.5`} style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
