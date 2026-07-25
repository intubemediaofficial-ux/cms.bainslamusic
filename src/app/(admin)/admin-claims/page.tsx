"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  X,
  Loader2,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Eye,
  MessageSquare,
  User,
  Link2,
  ArrowRight,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ClaimRelease {
  id: string;
  userEmail: string;
  userName: string;
  distributionId: string;
  songTitle: string;
  videoLink: string;
  originalUPC: string;
  claimType: string;
  description: string;
  status: "pending" | "processing" | "released" | "rejected";
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-800", icon: AlertTriangle },
  released: { label: "Released", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
};

export default function AdminClaimsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [claims, setClaims] = useState<ClaimRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewingItem, setViewingItem] = useState<ClaimRelease | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (authStatus === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [authStatus, session, router]);

  const fetchClaims = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/claim-release");
      if (res.ok) {
        const json = await res.json();
        setClaims(json.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch claims:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated" && session?.user?.role === "admin") {
      fetchClaims();
    }
  }, [authStatus, session, fetchClaims]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/claim-release", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminNote }),
      });
      if (res.ok) {
        fetchClaims();
        if (viewingItem?.id === id) {
          const json = await res.json();
          setViewingItem(json.data);
        }
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdating(false);
    }
  };

  const filtered = claims.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.songTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (authStatus === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Claim Release (Admin)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review and process claim release requests from clients.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", count: claims.length, color: "bg-slate-50 border-slate-200" },
          { label: "Pending", count: claims.filter((c) => c.status === "pending").length, color: "bg-yellow-50 border-yellow-200" },
          { label: "Processing", count: claims.filter((c) => c.status === "processing").length, color: "bg-blue-50 border-blue-200" },
          { label: "Released", count: claims.filter((c) => c.status === "released").length, color: "bg-green-50 border-green-200" },
          { label: "Rejected", count: claims.filter((c) => c.status === "rejected").length, color: "bg-red-50 border-red-200" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.color}`}>
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by song, client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="released">Released</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No claim release requests found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">#</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Song Title</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Claim Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const statusInfo = STATUS_CONFIG[item.status];
                  const StatusIcon = statusInfo.icon;
                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 text-xs">{item.userName || "—"}</p>
                            <p className="text-[11px] text-slate-400">{item.userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.songTitle}</td>
                      <td className="px-4 py-3 text-slate-600">{item.claimType}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(item.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setViewingItem(item); setAdminNote(item.adminNote); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {item.status === "pending" && (
                            <>
                              <button
                                onClick={() => updateStatus(item.id, "processing")}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Start Processing"
                              >
                                <ArrowRight className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => updateStatus(item.id, "rejected")}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Reject"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {item.status === "processing" && (
                            <button
                              onClick={() => updateStatus(item.id, "released")}
                              className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Mark Released"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          {item.videoLink && (
                            <a
                              href={item.videoLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Video Link"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Claim Release Details</h2>
              <button onClick={() => setViewingItem(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{viewingItem.songTitle}</h3>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[viewingItem.status].color}`}>
                    {STATUS_CONFIG[viewingItem.status].label}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">{viewingItem.userName}</span>
                  <span className="text-slate-400">({viewingItem.userEmail})</span>
                </div>
              </div>

              <div className="text-sm">
                <span className="text-slate-500">Claim Type:</span> <span className="font-medium">{viewingItem.claimType}</span>
              </div>

              {viewingItem.videoLink && (
                <a
                  href={viewingItem.videoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                >
                  <Link2 className="w-4 h-4" />
                  Video / Claim Link
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {viewingItem.description && (
                <div className="text-sm">
                  <span className="text-slate-500">Description:</span>
                  <p className="mt-1 text-slate-700">{viewingItem.description}</p>
                </div>
              )}

              {/* Admin Note */}
              <div className="border-t border-slate-200 pt-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                  <MessageSquare className="w-4 h-4" />
                  Admin Note
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  placeholder="Add a note for the client..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                {viewingItem.status === "pending" && (
                  <>
                    <button
                      onClick={() => updateStatus(viewingItem.id, "processing")}
                      disabled={updating}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      Start Processing
                    </button>
                    <button
                      onClick={() => updateStatus(viewingItem.id, "rejected")}
                      disabled={updating}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </button>
                  </>
                )}
                {viewingItem.status === "processing" && (
                  <>
                    <button
                      onClick={() => updateStatus(viewingItem.id, "released")}
                      disabled={updating}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Mark Released
                    </button>
                    <button
                      onClick={() => updateStatus(viewingItem.id, "rejected")}
                      disabled={updating}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </button>
                  </>
                )}
              </div>

              <div className="text-xs text-slate-400 pt-2">
                Submitted: {new Date(viewingItem.createdAt).toLocaleString("en-IN")}
                {viewingItem.updatedAt !== viewingItem.createdAt && (
                  <> | Updated: {new Date(viewingItem.updatedAt).toLocaleString("en-IN")}</>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
