"use client";

import { calculateChannelHealth, getHealthColor, getHealthEmoji } from "@/lib/channel-health";
import type { ChannelHealthScore } from "@/lib/channel-health";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

interface ChannelHealthCardProps {
  channelName: string;
  thumbnail?: string;
  currentRevenue: number;
  previousRevenue: number;
  currentViews: number;
  previousViews: number;
  subscribers: number;
  subscriberChange: number;
  videoCount: number;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted w-20">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            score >= 75 ? "bg-green-500" : score >= 55 ? "bg-blue-500" : score >= 35 ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[10px] font-medium w-6 text-right">{score}</span>
    </div>
  );
}

export default function ChannelHealthCard(props: ChannelHealthCardProps) {
  const health: ChannelHealthScore = calculateChannelHealth(props);

  const TrendIcon = health.overall >= 55 ? TrendingUp : health.overall >= 35 ? Minus : TrendingDown;

  return (
    <div className="bg-white rounded-lg border border-border/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {props.thumbnail && <img src={props.thumbnail} alt="" className="w-6 h-6 rounded-full" />}
          <span className="text-sm font-medium truncate max-w-[150px]">{props.channelName}</span>
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getHealthColor(health.level)}`}>
          <TrendIcon className="w-3 h-3" />
          {health.overall}/100
        </div>
      </div>
      <div className="space-y-1.5">
        <ScoreBar score={health.revenueScore} label="Revenue" />
        <ScoreBar score={health.growthScore} label="Growth" />
        <ScoreBar score={health.engagementScore} label="Engagement" />
      </div>
      <p className={`text-[10px] font-medium mt-1.5 ${getHealthColor(health.level).split(" ")[0]}`}>
        {getHealthEmoji(health.level)}
      </p>
    </div>
  );
}

export function ChannelHealthSummary({ channels }: {
  channels: Array<{
    channelName: string;
    thumbnail?: string;
    currentRevenue: number;
    previousRevenue: number;
    currentViews: number;
    previousViews: number;
    subscribers: number;
    subscriberChange: number;
    videoCount: number;
  }>;
}) {
  if (channels.length === 0) return null;

  const healthScores = channels.map((ch) => ({
    ...ch,
    health: calculateChannelHealth(ch),
  }));

  const avgScore = Math.round(healthScores.reduce((s, c) => s + c.health.overall, 0) / healthScores.length);
  const excellent = healthScores.filter((c) => c.health.level === "excellent").length;
  const good = healthScores.filter((c) => c.health.level === "good").length;
  const average = healthScores.filter((c) => c.health.level === "average").length;
  const poor = healthScores.filter((c) => c.health.level === "poor").length;

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Channel Health Scores
        </h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-600">{excellent} Excellent</span>
          <span className="text-blue-600">{good} Good</span>
          <span className="text-amber-600">{average} Average</span>
          <span className="text-red-600">{poor} Poor</span>
          <span className="font-medium">Avg: {avgScore}/100</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {healthScores.sort((a, b) => b.health.overall - a.health.overall).map((ch) => (
          <ChannelHealthCard key={ch.channelName} {...ch} />
        ))}
      </div>
    </div>
  );
}
