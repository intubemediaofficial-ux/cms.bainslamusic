"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  X,
  Loader2,
  Music,
  ExternalLink,
  Edit2,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  ImageIcon,
  Upload,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { usePendingGuard } from "@/components/ReadOnlyBanner";

interface Distribution {
  id: string;
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

const GENRES = [
  "Bollywood", "Pop", "Rock", "Classical", "Devotional", "Folk",
  "Hip-Hop", "EDM", "Sufi", "Ghazal", "Bhajan", "Punjabi", "Haryanvi", "Rajasthani", "Other",
];

const LANGUAGES = [
  "Hindi", "English", "Punjabi", "Haryanvi", "Rajasthani", "Bhojpuri",
  "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Gujarati", "Marathi", "Other",
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  approved: { label: "Approved", color: "bg-blue-100 text-blue-800", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
  distributed: { label: "Distributed", color: "bg-green-100 text-green-800", icon: Send },
};

export default function MusicDistributionPage() {
  const { status: authStatus } = useSession();
  const guardPending = usePendingGuard();

  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Distribution | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<Distribution | null>(null);

  const [formData, setFormData] = useState({
    songTitle: "",
    songFileLink: "",
    posterLink: "",
    singerName: "",
    artistName: "",
    writerName: "",
    composerName: "",
    lyricistName: "",
    genre: "",
    language: "",
    releaseDate: "",
    description: "",
  });

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
    if (authStatus === "authenticated") {
      fetchDistributions();
    }
  }, [authStatus, fetchDistributions]);

  const resetForm = () => {
    setFormData({
      songTitle: "",
      songFileLink: "",
      posterLink: "",
      singerName: "",
      artistName: "",
      writerName: "",
      composerName: "",
      lyricistName: "",
      genre: "",
      language: "",
      releaseDate: "",
      description: "",
    });
    setFormError(null);
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (item: Distribution) => {
    setEditingItem(item);
    setFormData({
      songTitle: item.songTitle,
      songFileLink: item.songFileLink,
      posterLink: item.posterLink,
      singerName: item.singerName,
      artistName: item.artistName,
      writerName: item.writerName,
      composerName: item.composerName,
      lyricistName: item.lyricistName,
      genre: item.genre,
      language: item.language,
      releaseDate: item.releaseDate,
      description: item.description,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (guardPending()) return;
    if (!formData.songTitle.trim() || !formData.songFileLink.trim() || !formData.singerName.trim()) {
      setFormError("Song Title, Song File Link, and Singer Name are required");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const method = editingItem ? "PUT" : "POST";
      const payload = editingItem
        ? { id: editingItem.id, ...formData }
        : formData;

      const res = await fetch("/api/music-distribution", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        setFormError(json.error || "Failed to save");
        return;
      }

      setShowModal(false);
      resetForm();
      fetchDistributions();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (guardPending()) return;
    if (!confirm("Are you sure you want to delete this submission?")) return;

    try {
      const res = await fetch(`/api/music-distribution?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchDistributions();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const filtered = distributions.filter((d) => {
    const matchesSearch =
      !searchQuery ||
      d.songTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.singerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.artistName.toLowerCase().includes(searchQuery.toLowerCase());
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Music Distribution</h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload your songs for distribution. Add all details and track status.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          New Song
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by song title, singer, artist..."
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", count: distributions.length, color: "bg-slate-100 text-slate-800" },
          { label: "Pending", count: distributions.filter((d) => d.status === "pending").length, color: "bg-yellow-100 text-yellow-800" },
          { label: "Approved", count: distributions.filter((d) => d.status === "approved").length, color: "bg-blue-100 text-blue-800" },
          { label: "Distributed", count: distributions.filter((d) => d.status === "distributed").length, color: "bg-green-100 text-green-800" },
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
          <Music className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No songs submitted yet</p>
          <button
            onClick={openAddModal}
            className="mt-3 text-primary hover:text-primary-dark text-sm font-medium"
          >
            Submit your first song
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
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Singer</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Genre</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Language</th>
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
                      <td className="px-4 py-3 text-slate-600">{item.singerName}</td>
                      <td className="px-4 py-3 text-slate-600">{item.genre || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{item.language || "—"}</td>
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
                          {item.songFileLink && (
                            <a
                              href={item.songFileLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Open Song Link"
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Song Details</h2>
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

              <div className="flex flex-wrap gap-3 pt-2">
                {viewingItem.songFileLink && (
                  <a
                    href={viewingItem.songFileLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
                  >
                    <Music className="w-4 h-4" />
                    Song File
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {viewingItem.posterLink && (
                  <a
                    href={viewingItem.posterLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Poster/Artwork
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

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
                {editingItem ? "Edit Song" : "Submit New Song"}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
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

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Audio File <span className="text-red-500">*</span>
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                      formData.songFileLink ? "border-green-300 bg-green-50" : "border-slate-200 hover:border-primary/40"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                      const file = e.dataTransfer.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setFormData({ ...formData, songFileLink: reader.result as string });
                        reader.readAsDataURL(file);
                      }
                    }}
                  >
                    {formData.songFileLink ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-700 text-sm">
                          <Music className="w-4 h-4" />
                          <span>{formData.songFileLink.startsWith("data:") ? "Audio file attached" : "Link added"}</span>
                        </div>
                        <button type="button" onClick={() => setFormData({ ...formData, songFileLink: "" })} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                        <p className="text-sm text-slate-500">Drag & drop audio file here or <span className="text-primary font-medium">click to browse</span></p>
                        <p className="text-xs text-slate-400 mt-1">Or paste a Google Drive / Dropbox link below</p>
                        <input type="file" accept="audio/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => setFormData({ ...formData, songFileLink: reader.result as string });
                            reader.readAsDataURL(file);
                          }
                        }} />
                      </label>
                    )}
                  </div>
                  {!formData.songFileLink && (
                    <input
                      type="url"
                      value={formData.songFileLink}
                      onChange={(e) => setFormData({ ...formData, songFileLink: e.target.value })}
                      className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="Or paste link: Google Drive / Dropbox"
                    />
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Poster / Artwork
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                      formData.posterLink ? "border-green-300 bg-green-50" : "border-slate-200 hover:border-primary/40"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                      const file = e.dataTransfer.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setFormData({ ...formData, posterLink: reader.result as string });
                        reader.readAsDataURL(file);
                      }
                    }}
                  >
                    {formData.posterLink ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-700 text-sm">
                          <ImageIcon className="w-4 h-4" />
                          {formData.posterLink.startsWith("data:image") ? (
                            <img src={formData.posterLink} alt="Poster" className="w-10 h-10 object-cover rounded" />
                          ) : (
                            <span>Link added</span>
                          )}
                        </div>
                        <button type="button" onClick={() => setFormData({ ...formData, posterLink: "" })} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <ImageIcon className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                        <p className="text-sm text-slate-500">Drag & drop poster/artwork here or <span className="text-primary font-medium">click to browse</span></p>
                        <p className="text-xs text-slate-400 mt-1">Or paste a Google Drive / Dropbox link below</p>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => setFormData({ ...formData, posterLink: reader.result as string });
                            reader.readAsDataURL(file);
                          }
                        }} />
                      </label>
                    )}
                  </div>
                  {!formData.posterLink && (
                    <input
                      type="url"
                      value={formData.posterLink}
                      onChange={(e) => setFormData({ ...formData, posterLink: e.target.value })}
                      className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="Or paste link: Google Drive / Dropbox"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Singer <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.singerName}
                    onChange={(e) => setFormData({ ...formData, singerName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Singer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Artist</label>
                  <input
                    type="text"
                    value={formData.artistName}
                    onChange={(e) => setFormData({ ...formData, artistName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Artist name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Writer</label>
                  <input
                    type="text"
                    value={formData.writerName}
                    onChange={(e) => setFormData({ ...formData, writerName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Writer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Composer</label>
                  <input
                    type="text"
                    value={formData.composerName}
                    onChange={(e) => setFormData({ ...formData, composerName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Composer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lyricist</label>
                  <input
                    type="text"
                    value={formData.lyricistName}
                    onChange={(e) => setFormData({ ...formData, lyricistName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Lyricist name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Genre</label>
                  <select
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select Genre</option>
                    {GENRES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select Language</option>
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Release Date</label>
                  <input
                    type="date"
                    value={formData.releaseDate}
                    onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    placeholder="Any additional details about the song..."
                  />
                </div>
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
                  {editingItem ? "Update Song" : "Submit Song"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
