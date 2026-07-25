"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Search,
  Shield,
  ClipboardList,
  UserPlus,
  UserMinus,
  UserCog,
  Key,
  Ban,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface AuditLogEntry {
  id: string;
  action: string;
  performedBy: string;
  performedByRole: "admin" | "company" | "client";
  targetUser?: string;
  targetEmail?: string;
  details: string;
  timestamp: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  user_created: { label: "User Created", icon: UserPlus, color: "text-green-600 bg-green-50" },
  user_updated: { label: "User Updated", icon: UserCog, color: "text-blue-600 bg-blue-50" },
  user_deleted: { label: "User Deleted", icon: UserMinus, color: "text-red-600 bg-red-50" },
  user_status_changed: { label: "Status Changed", icon: Ban, color: "text-amber-600 bg-amber-50" },
  user_password_changed: { label: "Password Changed", icon: Key, color: "text-purple-600 bg-purple-50" },
  channel_approve_channel: { label: "Channel Approved", icon: CheckCircle2, color: "text-green-600 bg-green-50" },
  channel_reject_channel: { label: "Channel Rejected", icon: XCircle, color: "text-red-600 bg-red-50" },
  channel_unapprove_channel: { label: "Channel Unapproved", icon: XCircle, color: "text-amber-600 bg-amber-50" },
  channel_transfer: { label: "Channel Transferred", icon: ArrowRightLeft, color: "text-indigo-600 bg-indigo-50" },
};

export default function AdminAuditLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterRole, setFilterRole] = useState("all");

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit-log?limit=500");
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "admin") fetchLogs();
  }, [status, session, fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    if (filterAction !== "all" && log.action !== filterAction) return false;
    if (filterRole !== "all" && log.performedByRole !== filterRole) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        log.performedBy.toLowerCase().includes(q) ||
        (log.targetUser || "").toLowerCase().includes(q) ||
        (log.targetEmail || "").toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted">Loading audit log...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Shield className="w-4 h-4 text-red-500" />
        <span className="text-red-500 font-medium">Admin Panel</span>
        <span>&rsaquo;</span>
        <span className="text-foreground font-medium">Audit Log</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Audit Log
          </h1>
          <p className="text-sm text-muted mt-1">Track all user and channel changes across the system.</p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-slate-50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by user, email, or details..."
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              />
            </div>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>{ACTION_CONFIG[a]?.label || a}</option>
              ))}
            </select>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="company">Company</option>
              <option value="client">Client</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">Action</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Performed By</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Target</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Details</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const config = ACTION_CONFIG[log.action] || { label: log.action, icon: ClipboardList, color: "text-slate-600 bg-slate-50" };
                const Icon = config.icon;
                return (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${config.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-xs">{config.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-xs">{log.performedBy}</p>
                        <p className="text-[10px] text-muted capitalize">{log.performedByRole}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {log.targetUser && (
                        <div>
                          <p className="font-medium text-xs">{log.targetUser}</p>
                          {log.targetEmail && <p className="text-[10px] text-muted">{log.targetEmail}</p>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted max-w-[300px] truncate">{log.details}</td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p>No audit log entries found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-border bg-slate-50 text-sm text-muted">
          Showing {filteredLogs.length} of {logs.length} entries
        </div>
      </div>
    </div>
  );
}
