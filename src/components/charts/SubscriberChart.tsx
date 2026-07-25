"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SubscriberDataPoint {
  date: string;
  subscribers: number;
}

interface SubscriberChartProps {
  data?: SubscriberDataPoint[];
}

export default function SubscriberChart({ data }: SubscriberChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground mb-4">Subscriber Growth</h3>
        <div className="h-[280px] flex items-center justify-center text-sm text-muted">
          Sign in with Google to see subscriber data
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Subscriber Growth</h3>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 12 }}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 12 }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickFormatter={(v) =>
                v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`
              }
            />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              formatter={(value) => [Number(value).toLocaleString(), "Subscribers"]}
            />
            <Line
              type="monotone"
              dataKey="subscribers"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
