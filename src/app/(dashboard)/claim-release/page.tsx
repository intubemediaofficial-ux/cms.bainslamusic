"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  X,
  Loader2,
  ExternalLink,
  Edit2,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Link2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { usePendingGuard } from "@/components/ReadOnlyBanner";

interface ClaimRelease {
  id: string;
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

interface Distribution {
  id: string;
  songTitle: string;
  status: string;
}

const CLAIM_TYPES = [
  "Content ID",
  "Copyright Claim",
  "Manual Claim",
  "Sound Recording",
  "Composition",
  "Other",
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-800", icon: AlertTriangle },
  released: { label: "Released", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
};

export default function ClaimReleasePage() {
  const { status: authStatus } = useSession();
  const guardPending = usePendingGuard();

  const [claims, setClaims] = useState<ClaimRelease[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ClaimRelease | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<ClaimRelease | null>(null);

  const [formData, setFormData] = useState({
    distributionId: "",
    songTitle: "",
    videoLink: "",
    originalUPC: "",
    claimType: "Content ID",
    description: "",
  });
  const [batchLinks, setBatchLinks] = useState<string[]>([""]);

  const fetchClaims = useCallback(async () => {
    try {
      setLoading(true);
      const [claimsRes, distRes] = await Promise.all([
        fetch("/api/claim-release"),
        fetch("/api/music-distribution"),
      ]);
      if (claimsRes.ok) {
        const json = await claimsRes.json();
        setClaims(json.data || []);
      }
      if (distRes.ok) {
        const json = await distRes.json();
        setDistributions(
          (json.data || []).filter((d: Distribution) => d.status === "distributed")
        );
      }
    } catch (error) {
      console.error("Failed to fetch claims:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchClaims();
    }
  }, [authStatus, fetchClaims]);

  const resetForm = () => {
    setFormData({
      distributionId: "",
      songTitle: "",
      videoLink: "",
      originalUPC: "",
      claimType: "Content ID",
      description: "",
    });
    setBatchLinks([""]);
    setFormError(null);
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (item: ClaimRelease) => {
    setEditingItem(item);
    setFormData({
      distributionId: item.distributionId,
      songTitle: item.songTitle,
      videoLink: item.videoLink,
      originalUPC: item.originalUPC,
      claimType: item.claimType,
      description: item.description,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (guardPending()) return;
    if (!formData.songTitle.trim()) {
      setFormError("Song Title is required");
      return;
    }

    // For editing, use single videoLink; for new, use batch links
    const links = editingItem
      ? [formData.videoLink.trim()]
      : batchLinks.map((l) => l.trim()).filter(Boolean);

    if (links.length === 0) {
      setFormError("At least one video link is required");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (editingItem) {
        const res = await fetch("/api/claim-release", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingItem.id, ...formData }),
        });
        if (!res.ok) {
          const json = await res.json();
          setFormError(json.error || "Failed to save");
          return;
        }
      } else {
        // Submit one request per link (batch)
        for (const link of links) {
          const res = await fetch("/api/claim-release", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...formData, videoLink: link }),
          });
          if (!res.ok) {
            const json = await res.json();
            setFormError(json.error || `Failed to save link: ${link}`);
            return;
          }
        }
      }

      setShowModal(false);
      resetForm();
      fetchClaims();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (guardPending()) return;
    if (!confirm("Are you sure you want to delete this claim request?")) return;

    try {
      const res = await fetch(`/api/claim-release?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchClaims();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const filtered = claims.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.songTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.videoLink.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.originalUPC.toLowerCase().includes(searchQuery.toLowerCase());
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Claim Release</h1>
          <p className="text-sm text-slate-500 mt-1">
            Submit claim release requests for your distributed songs.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          New Claim Request
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by song title, link, UPC..."
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", count: claims.length, color: "bg-slate-100 text-slate-800" },
          { label: "Pending", count: claims.filter((c) => c.status === "pending").length, color: "bg-yellow-100 text-yellow-800" },
          { label: "Processing", count: claims.filter((c) => c.status === "processing").length, color: "bg-blue-100 text-blue-800" },
          { label: "Released", count: claims.filter((c) => c.status === "released").length, color: "bg-green-100 text-green-800" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No claim release requests yet</p>
          <button
            onClick={openAddModal}
            className="mt-3 text-primary hover:text-primary-dark text-sm font-medium"
          >
            Submit your first claim release request
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">#</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Song Title</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Claim Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">UPC</th>
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
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => setViewingItem(item)}
                    >
                      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.songTitle}</td>
                      <td className="px-4 py-3 text-slate-600">{item.claimType}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{item.originalUPC || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {item.status === "pending" && (
                            <>
                              <button
                                onClick={() => openEditModal(item)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {item.videoLink && (
                            <a
                              href={item.videoLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Open Video Link"
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

      {/* Detail View Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Claim Details</h2>
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

              {viewingItem.adminNote && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm">
                  <span className="font-medium text-slate-700">Admin Note:</span>
                  <p className="text-slate-600 mt-1">{viewingItem.adminNote}</p>
                </div>
              )}

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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {editingItem ? "Edit Claim Request" : "New Claim Release Request"}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              {distributions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Linked Song (from Distribution)
                  </label>
                  <select
                    value={formData.distributionId}
                    onChange={(e) => {
                      const dist = distributions.find((d) => d.id === e.target.value);
                      setFormData({
                        ...formData,
                        distributionId: e.target.value,
                        songTitle: dist ? dist.songTitle : formData.songTitle,
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select a distributed song (optional)</option>
                    {distributions.map((d) => (
                      <option key={d.id} value={d.id}>{d.songTitle}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Song Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.songTitle}
                  onChange={(e) => setFormData({ ...formData, songTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Enter song title"
                />
              </div>

              {editingItem ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Video / Claim Link <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={formData.videoLink}
                    onChange={(e) => setFormData({ ...formData, videoLink: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="YouTube video link or claim link"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Video / Claim Links <span className="text-red-500">*</span>
                    <span className="text-xs text-slate-400 ml-2">(Add up to 10 links)</span>
                  </label>
                  <div className="space-y-2">
                    {batchLinks.map((link, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-5 text-right">{idx + 1}.</span>
                        <input
                          type="url"
                          value={link}
                          onChange={(e) => {
                            const updated = [...batchLinks];
                            updated[idx] = e.target.value;
                            setBatchLinks(updated);
                          }}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="YouTube video link or claim link"
                        />
                        {batchLinks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setBatchLinks(batchLinks.filter((_, i) => i !== idx))}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {batchLinks.length < 10 && (
                      <button
                        type="button"
                        onClick={() => setBatchLinks([...batchLinks, ""])}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                      >
                        <Plus className="w-3 h-3" /> Add another link
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Claim Type
                </label>
                <select
                  value={formData.claimType}
                  onChange={(e) => setFormData({ ...formData, claimType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {CLAIM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  placeholder="Describe the claim issue..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingItem ? "Update Request" : "Submit Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
