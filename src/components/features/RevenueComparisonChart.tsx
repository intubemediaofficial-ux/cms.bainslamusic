"use client";

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
import { BarChart3 } from "lucide-react";

interface RevenueComparisonProps {
  channels: Array<{
    channelName: string;
    currentRevenue: number;
    previousRevenue: number;
  }>;
  currentLabel?: string;
  previousLabel?: string;
}

export default function RevenueComparisonChart({
  channels,
  currentLabel = "Current Period",
  previousLabel = "Previous Period",
}: RevenueComparisonProps) {
  if (channels.length === 0) return null;

  const chartData = channels
    .filter((ch) => ch.currentRevenue > 0 || ch.previousRevenue > 0)
    .sort((a, b) => b.currentRevenue - a.currentRevenue)
    .slice(0, 15)
    .map((ch) => ({
      name: ch.channelName.length > 18 ? ch.channelName.slice(0, 16) + "..." : ch.channelName,
      current: Math.round(ch.currentRevenue * 100) / 100,
      previous: Math.round(ch.previousRevenue * 100) / 100,
      change: ch.previousRevenue > 0
        ? Math.round(((ch.currentRevenue - ch.previousRevenue) / ch.previousRevenue) * 100)
        : ch.currentRevenue > 0 ? 100 : 0,
    }));

  if (chartData.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          Revenue Comparison — Channel wise
        </h2>
      </div>
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              formatter={(value, name) => [`$${Number(value).toFixed(2)}`, String(name)]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="previous" name={previousLabel} fill="#94a3b8" radius={[2, 2, 0, 0]} />
            <Bar dataKey="current" name={currentLabel} fill="#6366f1" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
