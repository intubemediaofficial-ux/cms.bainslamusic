"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  X,
  Loader2,
  Music,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  ImageIcon,
  Eye,
  MessageSquare,
  User,
  Download,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Distribution {
  id: string;
  userEmail: string;
  userName: string;
  songTitle: string;
  songFileLink: string;
  posterLink: string;
  singerName: string;
  artistName: string;
  writerName: string;
  composerName: string;
  lyricistName: string;
  genre: string;
  language: string;
  releaseDate: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "distributed";
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  approved: { label: "Approved", color: "bg-blue-100 text-blue-800", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
  distributed: { label: "Distributed", color: "bg-green-100 text-green-800", icon: Send },
};

export default function AdminDistributionPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewingItem, setViewingItem] = useState<Distribution | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (authStatus === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [authStatus, session, router]);

  const fetchDistributions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/music-distribution");
      if (res.ok) {
        const json = await res.json();
        setDistributions(json.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch distributions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated" && session?.user?.role === "admin") {
      fetchDistributions();
    }
  }, [authStatus, session, fetchDistributions]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/music-distribution", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminNote }),
      });
      if (res.ok) {
        fetchDistributions();
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

  const filtered = distributions.filter((d) => {
    const matchesSearch =
      !searchQuery ||
      d.songTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.singerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || d.status === statusFilter;
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
        <h1 className="text-2xl font-bold text-slate-900">Music Distribution (Admin)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review and manage song distribution submissions from clients.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", count: distributions.length, color: "bg-slate-50 border-slate-200" },
          { label: "Pending", count: distributions.filter((d) => d.status === "pending").length, color: "bg-yellow-50 border-yellow-200" },
          { label: "Approved", count: distributions.filter((d) => d.status === "approved").length, color: "bg-blue-50 border-blue-200" },
          { label: "Distributed", count: distributions.filter((d) => d.status === "distributed").length, color: "bg-green-50 border-green-200" },
          { label: "Rejected", count: distributions.filter((d) => d.status === "rejected").length, color: "bg-red-50 border-red-200" },
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
            placeholder="Search by song, singer, client name/email..."
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
          <option value="approved">Approved</option>
          <option value="distributed">Distributed</option>
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
          <Music className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No distribution submissions found</p>
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
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Singer</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Genre</th>
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
                      <td className="px-4 py-3 text-slate-600">{item.singerName}</td>
                      <td className="px-4 py-3 text-slate-600">{item.genre || "—"}</td>
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
                                onClick={() => updateStatus(item.id, "approved")}
                                className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Approve"
                              >
                                <CheckCircle2 className="w-4 h-4" />
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
                          {item.status === "approved" && (
                            <button
                              onClick={() => updateStatus(item.id, "distributed")}
                              className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Mark Distributed"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {item.songFileLink && (
                            <a
                              href={item.songFileLink}
                              download={`${item.songTitle || "audio"}-song`}
                              className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Download Song File"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          {item.posterLink && (
                            <a
                              href={item.posterLink}
                              download={`${item.songTitle || "poster"}-artwork`}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Download Poster"
                            >
                              <ImageIcon className="w-4 h-4" />
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Distribution Details</h2>
              <button onClick={() => setViewingItem(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Music className="w-6 h-6 text-primary" />
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

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Singer:</span> <span className="font-medium">{viewingItem.singerName}</span></div>
                <div><span className="text-slate-500">Artist:</span> <span className="font-medium">{viewingItem.artistName || "—"}</span></div>
                <div><span className="text-slate-500">Writer:</span> <span className="font-medium">{viewingItem.writerName || "—"}</span></div>
                <div><span className="text-slate-500">Composer:</span> <span className="font-medium">{viewingItem.composerName || "—"}</span></div>
                <div><span className="text-slate-500">Lyricist:</span> <span className="font-medium">{viewingItem.lyricistName || "—"}</span></div>
                <div><span className="text-slate-500">Genre:</span> <span className="font-medium">{viewingItem.genre || "—"}</span></div>
                <div><span className="text-slate-500">Language:</span> <span className="font-medium">{viewingItem.language || "—"}</span></div>
                <div><span className="text-slate-500">Release Date:</span> <span className="font-medium">{viewingItem.releaseDate || "—"}</span></div>
              </div>

              {viewingItem.description && (
                <div className="text-sm">
                  <span className="text-slate-500">Description:</span>
                  <p className="mt-1 text-slate-700">{viewingItem.description}</p>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Files</p>
                {viewingItem.songFileLink && (
                  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
                    <Music className="w-5 h-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">Audio / Song File</p>
                      <p className="text-xs text-slate-400 truncate max-w-xs">{viewingItem.songFileLink.startsWith("data:") ? "Uploaded file" : viewingItem.songFileLink}</p>
                    </div>
                    <a
                      href={viewingItem.songFileLink}
                      download={`${viewingItem.songTitle || "audio"}-song`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                    <a
                      href={viewingItem.songFileLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
                {viewingItem.posterLink && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <ImageIcon className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">Poster / Artwork</p>
                      {viewingItem.posterLink.startsWith("data:image") ? (
                        <img src={viewingItem.posterLink} alt="Poster" className="w-12 h-12 object-cover rounded mt-1" />
                      ) : (
                        <p className="text-xs text-slate-400 truncate max-w-xs">{viewingItem.posterLink}</p>
                      )}
                    </div>
                    <a
                      href={viewingItem.posterLink}
                      download={`${viewingItem.songTitle || "poster"}-artwork`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                    <a
                      href={viewingItem.posterLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
                {!viewingItem.songFileLink && !viewingItem.posterLink && (
                  <p className="text-sm text-slate-400 italic">No files uploaded by client</p>
                )}
              </div>

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
                      onClick={() => updateStatus(viewingItem.id, "approved")}
                      disabled={updating}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Approve
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
                {viewingItem.status === "approved" && (
                  <button
                    onClick={() => updateStatus(viewingItem.id, "distributed")}
                    disabled={updating}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Mark as Distributed
                  </button>
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
