"use client";

import { useState, useEffect } from "react";
import { Shield, Settings, Save, Users, Key, AlertTriangle, Wrench, Info, Trash2, Loader2, MessageSquare, Image as ImageIcon, X, ToggleLeft, ToggleRight, Eye, EyeOff, Copy, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface AdminWarning {
  id: string;
  message: string;
  type: "maintenance" | "warning" | "info";
  createdAt: string;
  createdBy: string;
}

interface SupportRequest {
  id: string;
  clientEmail: string;
  clientName: string;
  category?: string;
  message: string;
  screenshot?: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string;
  adminResponse?: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

export default function AdminSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  // Warning states
  const [globalWarning, setGlobalWarning] = useState<AdminWarning | null>(null);
  const [globalMessage, setGlobalMessage] = useState("");
  const [globalType, setGlobalType] = useState<"maintenance" | "warning" | "info">("maintenance");
  const [warningLoading, setWarningLoading] = useState(false);

  // Per-client warning
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientEmail, setSelectedClientEmail] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [clientWarningType, setClientWarningType] = useState<"maintenance" | "warning" | "info">("warning");
  const [clientWarningLoading, setClientWarningLoading] = useState(false);

  // Support requests
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [supportLoading, setSupportLoading] = useState(true);
  const [responseText, setResponseText] = useState("");
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [viewScreenshot, setViewScreenshot] = useState<string | null>(null);

  // Admin Settings
  const [requireUserApproval, setRequireUserApproval] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [revenueApiBaseUrl, setRevenueApiBaseUrl] = useState("");
  const [revenueApiMaskedKey, setRevenueApiMaskedKey] = useState("");
  const [revenueApiSecret, setRevenueApiSecret] = useState<string | null>(null);
  const [revenueApiConfigured, setRevenueApiConfigured] = useState(false);
  const [revenueApiKeyVisible, setRevenueApiKeyVisible] = useState(false);
  const [revenueApiLoading, setRevenueApiLoading] = useState(false);
  const [revenueApiCopied, setRevenueApiCopied] = useState<"url" | "key" | null>(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  // Fetch current warnings + clients + support requests
  useEffect(() => {
    if (status !== "authenticated" || session?.user?.role !== "admin") return;

    // Fetch global warning
    fetch("/api/client-data?action=getGlobalWarning")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setGlobalWarning(j.data);
          setGlobalMessage(j.data.message);
          setGlobalType(j.data.type);
        }
      })
      .catch(() => {});

    // Fetch clients for per-client warning
    fetch("/api/users")
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.length) {
          setClients(j.data.map((u: Client) => ({ id: u.id, name: u.name, email: u.email })));
        }
      })
      .catch(() => {});

    // Fetch support requests
    fetch("/api/client-data?action=getSupportRequests")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setSupportRequests(j.data);
      })
      .catch(() => {})
      .finally(() => setSupportLoading(false));

    // Fetch admin settings
    fetch("/api/client-data?action=getAdminSettings")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setRequireUserApproval(j.data.requireUserApproval ?? true);
        }
      })
      .catch(() => {});

    fetch("/api/admin-settings?setting=revenue-api", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setRevenueApiBaseUrl(j.data.baseUrl || "");
          setRevenueApiMaskedKey(j.data.maskedApiKey || "");
          setRevenueApiConfigured(Boolean(j.data.configured));
        }
      })
      .catch(() => {});
  }, [status, session]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSetGlobalWarning = async () => {
    if (!globalMessage.trim()) return;
    setWarningLoading(true);
    const warning: AdminWarning = {
      id: `gw-${Date.now()}`,
      message: globalMessage.trim(),
      type: globalType,
      createdAt: new Date().toISOString(),
      createdBy: session?.user?.email || "admin",
    };
    await fetch("/api/client-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setGlobalWarning", warning }),
    });
    setGlobalWarning(warning);
    setWarningLoading(false);
  };

  const handleClearGlobalWarning = async () => {
    setWarningLoading(true);
    await fetch("/api/client-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setGlobalWarning", warning: null }),
    });
    setGlobalWarning(null);
    setGlobalMessage("");
    setWarningLoading(false);
  };

  const handleSetClientWarning = async () => {
    if (!selectedClientEmail || !clientMessage.trim()) return;
    setClientWarningLoading(true);
    const warning: AdminWarning = {
      id: `cw-${Date.now()}`,
      message: clientMessage.trim(),
      type: clientWarningType,
      createdAt: new Date().toISOString(),
      createdBy: session?.user?.email || "admin",
    };
    await fetch("/api/client-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setClientWarning", userId: selectedClientEmail, warning }),
    });
    setClientMessage("");
    setSelectedClientEmail("");
    setClientWarningLoading(false);
    alert(`Warning sent to ${selectedClientEmail}`);
  };

  const handleClearClientWarning = async (email: string) => {
    await fetch("/api/client-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setClientWarning", userId: email, warning: null }),
    });
    alert(`Warning cleared for ${email}`);
  };

  const handleResolveSupportRequest = async (requestId: string) => {
    setRespondingTo(requestId);
    await fetch("/api/client-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolveSupportRequest", requestId, adminResponse: responseText }),
    });
    setSupportRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, status: "resolved" as const, resolvedAt: new Date().toISOString(), adminResponse: responseText } : r
      )
    );
    setResponseText("");
    setRespondingTo(null);
  };

  const fetchRevenueApiSecret = async (): Promise<string> => {
    setRevenueApiLoading(true);
    try {
      const response = await fetch(
        "/api/admin-settings?setting=revenue-api&reveal=true",
        { cache: "no-store" }
      );
      if (!response.ok) return "";
      const result = await response.json();
      return result.data?.apiKey || "";
    } finally {
      setRevenueApiLoading(false);
    }
  };

  const handleToggleRevenueApiKey = async () => {
    if (revenueApiKeyVisible) {
      setRevenueApiKeyVisible(false);
      setRevenueApiSecret(null);
      return;
    }
    const apiKey = await fetchRevenueApiSecret();
    if (!apiKey) return;
    setRevenueApiSecret(apiKey);
    setRevenueApiKeyVisible(true);
  };

  const handleCopyRevenueApiKey = async () => {
    const apiKey = await fetchRevenueApiSecret();
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setRevenueApiCopied("key");
    setTimeout(() => setRevenueApiCopied(null), 2000);
  };

  const handleCopyRevenueApiUrl = async () => {
    if (!revenueApiBaseUrl) return;
    await navigator.clipboard.writeText(revenueApiBaseUrl);
    setRevenueApiCopied("url");
    setTimeout(() => setRevenueApiCopied(null), 2000);
  };

  const typeIcons = {
    maintenance: <Wrench className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    info: <Info className="w-4 h-4" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Shield className="w-4 h-4 text-red-500" />
        <span className="text-red-500 font-medium">Admin</span>
        <span>›</span>
        <span className="text-foreground font-medium">Settings</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Settings</h1>
        <p className="text-sm text-muted mt-1">Configure warnings, view support requests, and manage admin accounts.</p>
      </div>

      {/* Global Warning / Maintenance Banner */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">Global Warning / Maintenance</h2>
          </div>
          <p className="text-sm text-muted mt-1">Set a warning message that all clients will see on their dashboard.</p>
        </div>
        <div className="p-5 space-y-4">
          {globalWarning && (
            <div className={`p-3 rounded-lg border flex items-center justify-between ${
              globalWarning.type === "maintenance" ? "bg-amber-50 border-amber-200 text-amber-800" :
              globalWarning.type === "warning" ? "bg-red-50 border-red-200 text-red-800" :
              "bg-blue-50 border-blue-200 text-blue-800"
            }`}>
              <div className="flex items-center gap-2">
                {typeIcons[globalWarning.type]}
                <span className="text-sm font-medium">{globalWarning.message}</span>
              </div>
              <button onClick={handleClearGlobalWarning} className="p-1 hover:opacity-70" disabled={warningLoading}>
                {warningLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <select
              value={globalType}
              onChange={(e) => setGlobalType(e.target.value as "maintenance" | "warning" | "info")}
              className="border border-border rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="maintenance">🔧 Maintenance</option>
              <option value="warning">⚠️ Warning</option>
              <option value="info">ℹ️ Info</option>
            </select>
            <input
              type="text"
              value={globalMessage}
              onChange={(e) => setGlobalMessage(e.target.value)}
              placeholder="Enter warning message for all clients..."
              className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={handleSetGlobalWarning}
              disabled={warningLoading || !globalMessage.trim()}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {warningLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
              Set Warning
            </button>
          </div>
        </div>
      </div>

      {/* Per-Client Warning */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-foreground">Send Warning to Client</h2>
          </div>
          <p className="text-sm text-muted mt-1">Send a specific warning/notification to a particular client.</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={selectedClientEmail}
              onChange={(e) => setSelectedClientEmail(e.target.value)}
              className="border border-border rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="">Select Client...</option>
              {clients.map((c) => (
                <option key={c.email} value={c.email}>{c.name} ({c.email})</option>
              ))}
            </select>
            <select
              value={clientWarningType}
              onChange={(e) => setClientWarningType(e.target.value as "maintenance" | "warning" | "info")}
              className="border border-border rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="warning">⚠️ Warning</option>
              <option value="maintenance">🔧 Maintenance</option>
              <option value="info">ℹ️ Info</option>
            </select>
            <button
              onClick={handleSetClientWarning}
              disabled={clientWarningLoading || !selectedClientEmail || !clientMessage.trim()}
              className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {clientWarningLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
              Send Warning
            </button>
          </div>
          <input
            type="text"
            value={clientMessage}
            onChange={(e) => setClientMessage(e.target.value)}
            placeholder="Enter warning message for this client..."
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {selectedClientEmail && (
            <button
              onClick={() => handleClearClientWarning(selectedClientEmail)}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              Clear existing warning for this client
            </button>
          )}
        </div>
      </div>

      {/* Support Requests from Clients */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Support Requests</h2>
          </div>
          <p className="text-sm text-muted mt-1">Client support requests — messages, screenshots, and problems reported.</p>
        </div>
        <div className="p-5">
          {supportLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : supportRequests.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No support requests yet.</p>
          ) : (
            <div className="space-y-4">
              {supportRequests.map((req) => (
                <div key={req.id} className={`p-4 rounded-lg border ${req.status === "resolved" ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{req.clientName} ({req.clientEmail})</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {req.category && <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{req.category}</span>}
                        <p className="text-xs text-muted">{new Date(req.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${req.status === "resolved" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {req.status === "resolved" ? "Resolved" : "Open"}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-2">{req.message}</p>
                  {req.screenshot && (
                    <button
                      onClick={() => setViewScreenshot(req.screenshot || null)}
                      className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      View Screenshot
                    </button>
                  )}
                  {req.adminResponse && (
                    <div className="mt-2 p-2 bg-white rounded border border-green-200">
                      <p className="text-xs text-muted">Admin Response:</p>
                      <p className="text-sm text-foreground">{req.adminResponse}</p>
                    </div>
                  )}
                  {req.status === "open" && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        placeholder="Response (optional)..."
                        value={respondingTo === req.id ? responseText : ""}
                        onChange={(e) => { setRespondingTo(req.id); setResponseText(e.target.value); }}
                        onFocus={() => setRespondingTo(req.id)}
                        className="flex-1 px-2 py-1.5 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <button
                        onClick={() => handleResolveSupportRequest(req.id)}
                        className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium transition-colors"
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Screenshot Modal */}
      {viewScreenshot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90] p-4" onClick={() => setViewScreenshot(null)}>
          <div className="bg-white rounded-xl max-w-3xl w-full p-4 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewScreenshot(null)} className="absolute top-2 right-2 p-1 hover:bg-slate-100 rounded">
              <X className="w-5 h-5" />
            </button>
            <img src={viewScreenshot} alt="Screenshot" className="w-full rounded-lg" />
          </div>
        </div>
      )}

      {/* User Approval Toggle */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-foreground">New User Registration</h2>
          </div>
          <p className="text-sm text-muted mt-1">Control whether new users need admin approval before they can access the dashboard.</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-foreground">Require Admin Approval for New Users</p>
              <p className="text-xs text-muted mt-0.5">
                {requireUserApproval
                  ? "ON — New users must wait for admin approval before accessing dashboard"
                  : "OFF — New users can login immediately after registration (channel approval still required)"}
              </p>
            </div>
            <button
              onClick={async () => {
                setSettingsLoading(true);
                const newValue = !requireUserApproval;
                await fetch("/api/client-data", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "setAdminSettings", settings: { requireUserApproval: newValue } }),
                });
                setRequireUserApproval(newValue);
                setSettingsLoading(false);
              }}
              disabled={settingsLoading}
              className="flex items-center gap-1 transition-colors"
            >
              {settingsLoading ? (
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              ) : requireUserApproval ? (
                <ToggleRight className="w-10 h-10 text-green-500" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-slate-400" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted">
            <strong>Note:</strong> Channel approval is always required regardless of this setting. Admin must approve channels before token can be validated.
          </p>
        </div>
      </div>

      {/* General Settings */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">General Settings</h2>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Company Name
              </label>
              <input
                type="text"
                defaultValue="InTubeMedia"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Support Email
              </label>
              <input
                type="email"
                defaultValue="contact@intubemedia.com"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Admin Users */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Admin Users</h2>
          </div>
          <p className="text-sm text-muted mt-1">
            Emails with admin access (configured in auth.ts)
          </p>
        </div>
        <div className="p-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs">B</div>
                <div>
                  <p className="text-sm font-medium text-foreground">contact@intubemedia.com</p>
                  <p className="text-xs text-muted">Super Admin</p>
                </div>
              </div>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Admin</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs">A</div>
                <div>
                  <p className="text-sm font-medium text-foreground">ajeetgurjarofficial@gmail.com</p>
                  <p className="text-xs text-muted">Admin</p>
                </div>
              </div>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Admin</span>
            </div>
          </div>
          <p className="text-xs text-muted mt-3">
            To add more admin users, update the ADMIN_EMAILS list in <code className="bg-slate-100 px-1 rounded">src/lib/auth.ts</code>
          </p>
        </div>
      </div>

      {/* API Configuration */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">API Configuration</h2>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <span className="text-sm text-green-700">YouTube Data API v3</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Enabled</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <span className="text-sm text-green-700">YouTube Analytics API</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Enabled</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <span className="text-sm text-green-700">YouTube Reporting API</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Enabled</span>
          </div>

          <div className="border-t border-border pt-5 mt-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Monthly Revenue Export API</h3>
                <p className="text-xs text-muted mt-1">
                  Read-only channel-wise monthly revenue access for trusted external systems.
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                revenueApiConfigured
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}>
                {revenueApiConfigured ? "Configured" : "Not configured"}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Base URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={revenueApiBaseUrl}
                  className="flex-1 min-w-0 px-3 py-2.5 bg-slate-50 border border-border rounded-lg text-sm font-mono text-foreground"
                />
                <button
                  type="button"
                  onClick={handleCopyRevenueApiUrl}
                  disabled={!revenueApiBaseUrl}
                  className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                  aria-label="Copy revenue API base URL"
                >
                  {revenueApiCopied === "url" ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {revenueApiCopied === "url" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Secret API Key</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={revenueApiKeyVisible ? revenueApiSecret || "" : revenueApiMaskedKey}
                  placeholder={revenueApiConfigured ? "Loading key..." : "API key is not configured"}
                  className="flex-1 min-w-0 px-3 py-2.5 bg-slate-50 border border-border rounded-lg text-sm font-mono text-foreground"
                />
                <button
                  type="button"
                  onClick={handleToggleRevenueApiKey}
                  disabled={!revenueApiConfigured || revenueApiLoading}
                  className="p-2.5 border border-border rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  aria-label={revenueApiKeyVisible ? "Hide revenue API key" : "Show revenue API key"}
                >
                  {revenueApiLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : revenueApiKeyVisible ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCopyRevenueApiKey}
                  disabled={!revenueApiConfigured || revenueApiLoading}
                  className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                  aria-label="Copy revenue API key"
                >
                  {revenueApiCopied === "key" ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {revenueApiCopied === "key" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-amber-700 mt-2">
                Anyone with this key can read all assigned channels&apos; monthly revenue. Share it only with trusted systems.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
