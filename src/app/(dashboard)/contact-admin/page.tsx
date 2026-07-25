"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Send, Loader2, CheckCircle2, Image as ImageIcon, AlertTriangle, X } from "lucide-react";
import { useSession } from "next-auth/react";

interface SupportRequest {
  id: string;
  clientEmail: string;
  clientName: string;
  message: string;
  screenshot?: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string;
  adminResponse?: string;
}

export default function ContactAdminPage() {
  const { data: session } = useSession();
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [myRequests, setMyRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/client-data?action=getMySupportRequests")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setMyRequests(j.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/client-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submitSupportRequest",
          category: category || "General",
          message: message.trim(),
          screenshot: screenshot.trim() || undefined,
          clientName: session?.user?.name || "Unknown",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSent(true);
        if (json.data) {
          setMyRequests((prev) => [json.data, ...prev]);
        }
        setMessage("");
        setScreenshot("");
        setTimeout(() => setSent(false), 3000);
      }
    } catch { /* silent */ }
    setSending(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshot(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contact Admin</h1>
        <p className="text-sm text-muted mt-1">Report issues, ask questions, or request help from the admin team.</p>
      </div>

      {/* Submit New Request */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">New Support Request</h2>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Issue Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            >
              <option value="">Select category...</option>
              <option value="Dashboard">Dashboard</option>
              <option value="Videos">Videos Section</option>
              <option value="Channels">Channels</option>
              <option value="Claim Release">Claim Release</option>
              <option value="Music Distribution">Music Distribution</option>
              <option value="Payments">Payments</option>
              <option value="Token/Login">Token / Login Issue</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Describe your issue / problem
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your problem here... (e.g., channel token not working, revenue not showing, etc.)"
              rows={4}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Attach Screenshot (optional)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <ImageIcon className="w-4 h-4 text-muted" />
                <span className="text-sm text-muted">Choose File</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
              {screenshot && (
                <div className="relative">
                  <img src={screenshot} alt="Preview" className="w-16 h-16 object-cover rounded-lg border" />
                  <button
                    onClick={() => setScreenshot("")}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={sending || !message.trim()}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Request
            </button>
            {sent && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Request sent! Admin will review it soon.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* My Previous Requests */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">My Requests</h2>
          </div>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : myRequests.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No previous requests.</p>
          ) : (
            <div className="space-y-4">
              {myRequests.map((req) => (
                <div key={req.id} className={`p-4 rounded-lg border ${req.status === "resolved" ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                  <div className="flex items-start justify-between">
                    <p className="text-xs text-muted">{new Date(req.createdAt).toLocaleString()}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${req.status === "resolved" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {req.status === "resolved" ? "Resolved" : "Open"}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1">{req.message}</p>
                  {req.screenshot && (
                    <img src={req.screenshot} alt="Screenshot" className="mt-2 max-w-xs rounded-lg border" />
                  )}
                  {req.adminResponse && (
                    <div className="mt-2 p-2 bg-white rounded border border-green-200">
                      <p className="text-xs text-muted">Admin Response:</p>
                      <p className="text-sm text-foreground">{req.adminResponse}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
