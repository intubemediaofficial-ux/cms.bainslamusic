"use client";

import { useMemo } from "react";
import { RotateCcw } from "lucide-react";

export interface DateRange {
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
  label: string;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function subtractDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - days);
  return r;
}

function getYTEndDate(): Date {
  return subtractDays(new Date(), 3);
}

function computeRange(preset: string): DateRange {
  const end = getYTEndDate();
  const endStr = formatDate(end);

  switch (preset) {
    case "7d": {
      const start = subtractDays(end, 6);
      const prevEnd = subtractDays(start, 1);
      const prevStart = subtractDays(prevEnd, 6);
      return { startDate: formatDate(start), endDate: endStr, prevStartDate: formatDate(prevStart), prevEndDate: formatDate(prevEnd), label: "7 days" };
    }
    case "28d": {
      const start = subtractDays(end, 27);
      const prevEnd = subtractDays(start, 1);
      const prevStart = subtractDays(prevEnd, 27);
      return { startDate: formatDate(start), endDate: endStr, prevStartDate: formatDate(prevStart), prevEndDate: formatDate(prevEnd), label: "Last 28 days" };
    }
    case "90d": {
      const start = subtractDays(end, 89);
      const prevEnd = subtractDays(start, 1);
      const prevStart = subtractDays(prevEnd, 89);
      return { startDate: formatDate(start), endDate: endStr, prevStartDate: formatDate(prevStart), prevEndDate: formatDate(prevEnd), label: "Last 90 days" };
    }
    case "3m": {
      const start = new Date(end);
      start.setMonth(start.getMonth() - 3);
      const days = Math.floor((end.getTime() - start.getTime()) / 86400000);
      const prevEnd = subtractDays(start, 1);
      const prevStart = subtractDays(prevEnd, days);
      return { startDate: formatDate(start), endDate: endStr, prevStartDate: formatDate(prevStart), prevEndDate: formatDate(prevEnd), label: "Last 3 months" };
    }
    case "365d": {
      const start = subtractDays(end, 364);
      const prevEnd = subtractDays(start, 1);
      const prevStart = subtractDays(prevEnd, 364);
      return { startDate: formatDate(start), endDate: endStr, prevStartDate: formatDate(prevStart), prevEndDate: formatDate(prevEnd), label: "Last 365 days" };
    }
    case "lifetime": {
      const start = new Date("2005-01-01");
      return { startDate: formatDate(start), endDate: endStr, prevStartDate: formatDate(start), prevEndDate: endStr, label: "Lifetime" };
    }
    default: {
      if (/^\d{4}$/.test(preset)) {
        const year = parseInt(preset, 10);
        const start = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        const actualEnd = yearEnd < end ? yearEnd : end;
        const prevYear = year - 1;
        const prevStart = new Date(prevYear, 0, 1);
        const prevEnd = new Date(prevYear, 11, 31);
        return { startDate: formatDate(start), endDate: formatDate(actualEnd), prevStartDate: formatDate(prevStart), prevEndDate: formatDate(prevEnd), label: String(year) };
      }
      if (/^\d{4}-\d{2}$/.test(preset)) {
        const [y, m] = preset.split("-").map(Number);
        const start = new Date(y, m - 1, 1);
        const monthEnd = new Date(y, m, 0);
        const yesterday = subtractDays(new Date(), 1);
        const actualEnd = monthEnd < yesterday ? monthEnd : yesterday;
        const prevStart = new Date(y, m - 2, 1);
        const prevEnd = new Date(y, m - 1, 0);
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return { startDate: formatDate(start), endDate: formatDate(actualEnd), prevStartDate: formatDate(prevStart), prevEndDate: formatDate(prevEnd), label: monthNames[m - 1] };
      }
      const start28 = subtractDays(end, 27);
      const prev28End = subtractDays(start28, 1);
      const prev28Start = subtractDays(prev28End, 27);
      return { startDate: formatDate(start28), endDate: endStr, prevStartDate: formatDate(prev28Start), prevEndDate: formatDate(prev28End), label: "Last 28 days" };
    }
  }
}

function getRecentMonths(): { value: string; label: string }[] {
  const now = new Date();
  const months: { value: string; label: string }[] = [];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  for (let i = 0; i <= 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: monthNames[d.getMonth()],
    });
  }
  return months;
}

function getRecentYears(): string[] {
  const cur = new Date().getFullYear();
  return [String(cur - 1), String(cur - 2)];
}

interface DateRangeFilterProps {
  value: string;
  onChange: (preset: string, range: DateRange) => void;
}

export default function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const recentMonths = useMemo(() => getRecentMonths(), []);
  const recentYears = useMemo(() => getRecentYears(), []);

  const range = useMemo(() => computeRange(value), [value]);

  const handleChange = (preset: string) => {
    onChange(preset, computeRange(preset));
  };

  const displayStart = range.startDate.split("-").reverse().join("-");
  const displayEnd = range.endDate.split("-").reverse().join("-");

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white rounded-xl border border-border p-4">
      <div className="flex items-center gap-3">
        <div>
          <label className="text-xs font-medium text-muted block mb-1">Date Range</label>
          <select
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="7d">7 days</option>
            <option value="28d">Last 28 days</option>
            <option value="90d">Last 90 days</option>
            <option value="3m">Last 3 months</option>
            <option value="365d">Last 365 days</option>
            <option value="lifetime">Lifetime</option>
            <optgroup label="Years">
              {recentYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </optgroup>
            <optgroup label="Months">
              {recentMonths.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <button
          onClick={() => handleChange("28d")}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mt-4"
          title="Reset Filters"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Filters
        </button>
      </div>
      <div className="text-sm text-muted">
        Selected date range: <span className="font-semibold text-foreground">{displayStart} – {displayEnd}</span>
      </div>
    </div>
  );
}

export { computeRange };
