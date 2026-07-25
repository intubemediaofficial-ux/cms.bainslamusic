"use client";

import { useState } from "react";
import { Save, Loader2, Globe, Percent } from "lucide-react";

interface NetworkSettingsProps {
  userId: string;
  currentNetworkName?: string;
  currentRevenueShare?: number;
  role: "admin" | "company" | "client";
  onSave?: () => void;
}

export default function NetworkSettings({ userId, currentNetworkName, currentRevenueShare, role, onSave }: NetworkSettingsProps) {
  const [networkName, setNetworkName] = useState(currentNetworkName || "");
  const [revenueShare, setRevenueShare] = useState(currentRevenueShare || 0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          customNetworks: networkName.trim() ? [networkName.trim()] : [],
          revenueSharePercent: revenueShare,
        }),
      });
      if (res.ok) {
        setSaved(true);
        onSave?.();
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-5 h-5 text-indigo-500" />
        <h3 className="text-sm font-semibold text-foreground">Network Settings</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Network Name
          </label>
          <input
            type="text"
            value={networkName}
            onChange={(e) => setNetworkName(e.target.value)}
            placeholder="Enter your network name"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-[11px] text-muted mt-1">Your company/network name shown in reports</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1 flex items-center gap-1">
            <Percent className="w-3 h-3" />
            Revenue Share %
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={revenueShare}
            onChange={(e) => setRevenueShare(Number(e.target.value))}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-[11px] text-muted mt-1">
            {role === "company" 
              ? `Your share: ${revenueShare}% — Client gets: ${100 - revenueShare}%`
              : `Network keeps: ${revenueShare}% — You get: ${100 - revenueShare}%`
            }
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Settings
        </button>
        {saved && <span className="text-xs text-green-600 font-medium">Saved!</span>}
      </div>
    </div>
  );
}
