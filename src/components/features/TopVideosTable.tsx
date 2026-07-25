"use client";

import { Trophy, ExternalLink } from "lucide-react";
import { formatNumber, formatCurrency } from "@/lib/utils";

interface TopVideo {
  videoId: string;
  title: string;
  thumbnail?: string;
  channelTitle?: string;
  views: number;
  estimatedRevenue: number;
  likes?: number;
  comments?: number;
}

interface TopVideosTableProps {
  videos: TopVideo[];
  inrRate?: number;
  limit?: number;
}

export default function TopVideosTable({ videos, inrRate = 0, limit = 10 }: TopVideosTableProps) {
  if (videos.length === 0) return null;

  const sorted = [...videos]
    .sort((a, b) => b.estimatedRevenue - a.estimatedRevenue)
    .slice(0, limit);

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Top Performing Videos
        </h2>
        <span className="text-xs text-muted">By Revenue</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-medium text-muted">#</th>
              <th className="text-left py-2 px-3 font-medium text-muted">Video</th>
              <th className="text-left py-2 px-3 font-medium text-muted">Channel</th>
              <th className="text-right py-2 px-3 font-medium text-muted">Views</th>
              <th className="text-right py-2 px-3 font-medium text-muted">Revenue ($)</th>
              {inrRate > 0 && <th className="text-right py-2 px-3 font-medium text-muted">Revenue (INR)</th>}
              <th className="text-center py-2 px-3 font-medium text-muted">Link</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v, i) => (
              <tr key={v.videoId} className="border-b border-border/30 hover:bg-slate-50">
                <td className="py-2 px-3 font-medium text-muted">{i + 1}</td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2 max-w-[250px]">
                    {v.thumbnail && <img src={v.thumbnail} alt="" className="w-10 h-6 rounded object-cover" />}
                    <span className="truncate font-medium text-xs">{v.title}</span>
                  </div>
                </td>
                <td className="py-2 px-3 text-xs text-muted truncate max-w-[120px]">{v.channelTitle || "—"}</td>
                <td className="py-2 px-3 text-right">{formatNumber(v.views)}</td>
                <td className="py-2 px-3 text-right text-green-600 font-medium">{formatCurrency(v.estimatedRevenue)}</td>
                {inrRate > 0 && (
                  <td className="py-2 px-3 text-right text-amber-600">
                    ₹{Math.round(v.estimatedRevenue * inrRate).toLocaleString()}
                  </td>
                )}
                <td className="py-2 px-3 text-center">
                  <a
                    href={`https://youtube.com/watch?v=${v.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary-dark"
                  >
                    <ExternalLink className="w-3.5 h-3.5 inline" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
