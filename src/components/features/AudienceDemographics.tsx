"use client";

import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Users, Globe, Loader2 } from "lucide-react";

interface DemographicsData {
  ageGender?: { rows?: unknown[][]; columnHeaders?: Array<{ name?: string | null }> };
  country?: { rows?: unknown[][]; columnHeaders?: Array<{ name?: string | null }> };
}

const AGE_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#f97316"];
const COUNTRY_COLORS = ["#0ea5e9", "#14b8a6", "#22c55e", "#84cc16", "#eab308", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AudienceDemographics({ channelId }: { channelId?: string }) {
  const [data, setData] = useState<DemographicsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"age" | "country">("age");

  const fetchData = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    try {
      const end = new Date().toISOString().split("T")[0];
      const start = new Date(Date.now() - 28 * 86400000).toISOString().split("T")[0];
      const [ageRes, countryRes] = await Promise.all([
        fetch(`/api/youtube?action=demographics&channelId=${channelId}&startDate=${start}&endDate=${end}`),
        fetch(`/api/youtube?action=demographics&channelId=${channelId}&startDate=${start}&endDate=${end}&dimension=country`),
      ]);
      const ageJson = ageRes.ok ? await ageRes.json() : {};
      const countryJson = countryRes.ok ? await countryRes.json() : {};
      setData({ ageGender: ageJson.data, country: countryJson.data });
    } catch { /* silent */ }
    setLoading(false);
  }, [channelId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!channelId) return null;
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-border p-5 flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted">Loading demographics...</span>
      </div>
    );
  }

  const ageData = parseAgeGenderData(data?.ageGender);
  const countryData = parseCountryData(data?.country);

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-500" />
          Audience Demographics
        </h2>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setTab("age")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${tab === "age" ? "bg-white shadow-sm text-foreground" : "text-muted"}`}
          >
            Age & Gender
          </button>
          <button
            onClick={() => setTab("country")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${tab === "country" ? "bg-white shadow-sm text-foreground" : "text-muted"}`}
          >
            <Globe className="w-3 h-3 inline mr-1" />
            Countries
          </button>
        </div>
      </div>

      {tab === "age" && ageData.length > 0 && (
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ageData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                dataKey="value"
                nameKey="name"
              >
                {ageData.map((_, i) => (
                  <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === "country" && countryData.length > 0 && (
        <div className="space-y-2">
          {countryData.slice(0, 10).map((c, i) => (
            <div key={c.name} className="flex items-center gap-2">
              <span className="text-xs w-6 text-muted">{i + 1}.</span>
              <span className="text-sm font-medium w-8">{c.name}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${c.value}%`, backgroundColor: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }}
                />
              </div>
              <span className="text-xs font-medium w-12 text-right">{c.value.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}

      {((tab === "age" && ageData.length === 0) || (tab === "country" && countryData.length === 0)) && (
        <p className="text-sm text-muted text-center py-8">No demographic data available for this channel.</p>
      )}
    </div>
  );
}

function parseAgeGenderData(data: DemographicsData["ageGender"]): Array<{ name: string; value: number }> {
  if (!data?.rows?.length || !data.columnHeaders) return [];
  const headers = data.columnHeaders.map((h) => h.name || "");
  const ageIdx = headers.indexOf("ageGroup");
  const viewsIdx = headers.indexOf("viewerPercentage");
  if (ageIdx === -1 || viewsIdx === -1) return [];
  const grouped: Record<string, number> = {};
  for (const row of data.rows) {
    const age = String(row[ageIdx]);
    grouped[age] = (grouped[age] || 0) + (Number(row[viewsIdx]) || 0);
  }
  return Object.entries(grouped).map(([name, value]) => ({ name, value }));
}

function parseCountryData(data: DemographicsData["country"]): Array<{ name: string; value: number }> {
  if (!data?.rows?.length || !data.columnHeaders) return [];
  const headers = data.columnHeaders.map((h) => h.name || "");
  const countryIdx = headers.indexOf("country");
  const viewsIdx = headers.indexOf("views");
  if (countryIdx === -1 || viewsIdx === -1) return [];
  const total = data.rows.reduce((s, r) => s + (Number(r[viewsIdx]) || 0), 0);
  if (total === 0) return [];
  return data.rows
    .map((row) => ({
      name: String(row[countryIdx]),
      value: ((Number(row[viewsIdx]) || 0) / total) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}
