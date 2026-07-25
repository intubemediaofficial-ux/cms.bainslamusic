"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Palette, Save, Trash2, Upload } from "lucide-react";

interface BrandingSettingsProps {
  userId: string;
  currentBranding?: {
    brandName?: string;
    brandColor?: string;
    brandLogo?: string;
  };
  onSave?: () => void;
}

const COLOR_PRESETS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Green", value: "#22c55e" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Slate", value: "#475569" },
];

async function prepareLogo(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Please upload a PNG, JPG, or WebP image.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Logo file must be smaller than 5 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = document.createElement("img");
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to read this image."));
    });

    const maxDimension = 512;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to process this image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/webp", 0.85);
    if (dataUrl.length > 700000) {
      throw new Error("Logo is still too large. Please use a simpler image.");
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function BrandingSettings({ userId, currentBranding, onSave }: BrandingSettingsProps) {
  const [brandName, setBrandName] = useState(currentBranding?.brandName || "");
  const [brandColor, setBrandColor] = useState(currentBranding?.brandColor || "#6366f1");
  const [brandLogo, setBrandLogo] = useState(currentBranding?.brandLogo || "");
  const [saving, setSaving] = useState(false);
  const [processingLogo, setProcessingLogo] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleLogoUpload = async (file?: File) => {
    if (!file) return;
    setProcessingLogo(true);
    setError("");
    try {
      setBrandLogo(await prepareLogo(file));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Logo upload failed.");
    } finally {
      setProcessingLogo(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    const branding = {
      brandName: brandName.trim() || undefined,
      brandColor: brandColor || undefined,
      brandLogo: brandLogo.trim() || undefined,
    };
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, branding }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Branding could not be saved.");
        return;
      }
      setSaved(true);
      window.dispatchEvent(new CustomEvent("branding-updated", { detail: branding }));
      setTimeout(() => setSaved(false), 2000);
      onSave?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
        <Palette className="w-5 h-5 text-purple-500" />
        White-Label Branding
      </h2>
      <p className="text-xs text-muted mb-4">Customize how your dashboard appears to your clients.</p>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">Brand Name</label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="e.g. Star Music India"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-[10px] text-muted mt-1">Your clients will see this name instead of InTubeMedia.</p>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground block mb-1">Brand Color</label>
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.value}
                onClick={() => setBrandColor(c.value)}
                className={`w-7 h-7 rounded-lg border-2 transition-all ${brandColor === c.value ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground block mb-1">Company Logo</label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-slate-50">
              {processingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {processingLogo ? "Processing..." : "Upload Logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={processingLogo}
                onChange={(e) => handleLogoUpload(e.target.files?.[0])}
              />
            </label>
            {brandLogo && (
              <button
                type="button"
                onClick={() => setBrandLogo("")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted">PNG, JPG, or WebP. The logo is resized automatically.</p>
          <div className="mt-3">
            <label className="text-[10px] text-muted block mb-1">Or paste a public logo URL</label>
            <input
              type="url"
              value={brandLogo.startsWith("data:") ? "" : brandLogo}
              onChange={(e) => setBrandLogo(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {brandLogo && (
            <div className="mt-2 flex items-center gap-2">
              <img src={brandLogo} alt="Logo preview" className="w-12 h-12 rounded object-contain border border-border bg-white" />
              <span className="text-[10px] text-muted">Logo preview</span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border">
          <div className="text-xs text-muted mb-3">Preview:</div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-slate-50">
            {brandLogo && <img src={brandLogo} alt="" className="w-6 h-6 rounded object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
            <span className="font-semibold text-sm" style={{ color: brandColor }}>{brandName || "Your Brand Name"}</span>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || processingLogo}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: brandColor }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved! Dashboard updated" : "Save Branding"}
        </button>
      </div>
    </div>
  );
}
