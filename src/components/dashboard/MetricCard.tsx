"use client";

import { useState, useRef, useEffect } from "react";
import { Info, TrendingUp, TrendingDown, Download } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: number | null;
  tooltip?: string;
  color?: string;
  onDownload?: () => void;
}

export default function MetricCard({
  title,
  value,
  change,
  tooltip,
  color = "#f59e0b",
  onDownload,
}: MetricCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    }
    if (showTooltip) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTooltip]);

  const hasChange = change !== null && change !== undefined && !isNaN(change);
  const isPositive = hasChange && change >= 0;

  return (
    <div className="relative bg-white rounded-xl border border-border p-4 hover:shadow-sm transition-shadow">
      {tooltip && (
        <button
          onClick={() => setShowTooltip(!showTooltip)}
          className="absolute top-2 right-2 p-1 text-muted hover:text-foreground transition-colors"
          title="Info"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      )}
      {onDownload && (
        <button
          onClick={onDownload}
          className="absolute top-2 right-8 p-1 text-muted hover:text-foreground transition-colors"
          title="Download Report"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      )}
      {showTooltip && tooltip && (
        <div
          ref={tooltipRef}
          className="absolute top-8 right-2 z-50 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 max-w-[200px] shadow-lg"
        >
          {tooltip}
        </div>
      )}
      <div className="border-t-2 rounded-t-xl -mx-4 -mt-4 mb-3" style={{ borderColor: color }} />
      <p className="text-xs text-muted font-medium">{title}</p>
      <div className="flex items-end gap-2 mt-1">
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
      {hasChange && (
        <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${isPositive ? "text-green-600" : "text-red-500"}`}>
          {isPositive ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {isPositive ? "+" : ""}{change.toFixed(1)}%
        </div>
      )}
    </div>
  );
}
