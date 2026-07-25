"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  X,
  Loader2,
  Shield,
  Edit2,
  Trash2,
  Globe,
  Percent,
  UserPlus,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ClientOption {
  id: string;
  name: string;
  email: string;
}

interface Network {
  id: string;
  name: string;
  revenueSharePercent: number;
  createdDate: string;
}

interface CustomNetwork {
  id: string;
  name: string;
  createdBy: string;
  createdByEmail: string;
}

export default function AdminNetworksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [customNetworks, setCustomNetworks] = useState<CustomNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState<Network | null>(null);
  const [formName, setFormName] = useState("");
  const [formRevShare, setFormRevShare] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Assign to user
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignNetworkId, setAssignNetworkId] = useState<string | null>(null);
  const [assignNetworkName, setAssignNetworkName] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState("");

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const fetchNetworks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/networks?include_custom=true");
      if (res.ok) {
        const json = await res.json();
        setNetworks(json.data || []);
        setCustomNetworks(json.customNetworks || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const json = await res.json();
        setClients((json.data || []).map((u: { id: string; name: string; email: string }) => ({ id: u.id, name: u.name, email: u.email })));
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "admin") {
      queueMicrotask(() => {
        void fetchNetworks();
        void fetchClients();
      });
    }
  }, [status, session, fetchNetworks, fetchClients]);

  const openAssign = (network: Network) => {
    setAssignNetworkId(network.id);
    setAssignNetworkName(network.name);
    setSelectedClients([]);
    setAssignSuccess("");
    setShowAssignModal(true);
  };

  const handleAssign = async () => {
    if (selectedClients.length === 0) return;
    setAssigning(true);
    setAssignSuccess("");
    let successCount = 0;
    for (const clientId of selectedClients) {
      try {
        // Get current client data
        const getRes = await fetch("/api/users");
        const getJson = await getRes.json();
        const client = (getJson.data || []).find((u: { id: string }) => u.id === clientId);
        if (!client) continue;

        const currentNetworks = client.networks || [];
        const alreadyAssigned = currentNetworks.some((n: { networkId: string }) => n.networkId === assignNetworkId);
        if (alreadyAssigned) { successCount++; continue; }

        const network = networks.find((n) => n.id === assignNetworkId);
        const updatedNetworks = [...currentNetworks, {
          networkId: assignNetworkId,
          networkName: assignNetworkName,
          revenueSharePercent: network?.revenueSharePercent || 0,
        }];

        const putRes = await fetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: clientId, networks: updatedNetworks }),
        });
        if (putRes.ok) successCount++;
      } catch {
        // skip failed
      }
    }
    setAssigning(false);
    setAssignSuccess(`Assigned "${assignNetworkName}" to ${successCount} user(s) successfully!`);
  };

  const openCreate = () => {
    setEditingNetwork(null);
    setFormName("");
    setFormRevShare("");
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (network: Network) => {
    setEditingNetwork(network);
    setFormName(network.name);
    setFormRevShare(String(network.revenueSharePercent));
    setFormError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setFormError("Network name is required");
      return;
    }
    setSaving(true);
    setFormError("");

    try {
      const payload = {
        ...(editingNetwork ? { id: editingNetwork.id } : {}),
        name: formName.trim(),
        revenueSharePercent: Number(formRevShare) || 0,
      };

      const res = await fetch("/api/networks", {
        method: editingNetwork ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || "Failed to save");
        return;
      }

      setShowModal(false);
      fetchNetworks();
    } catch {
      setFormError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/networks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete network");
      setDeleteId(null);
      await fetchNetworks();
      const affected = Number(json.data?.affectedChannels || 0);
      window.alert(
        affected > 0
          ? `Network deleted. ${affected} channel(s) are now Not Validated and must be authorized again.`
          : "Network deleted. No channel authorization was affected."
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to delete network");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = networks.filter((n) =>
    n.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted">Loading networks...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Shield className="w-4 h-4 text-red-500" />
        <span className="text-red-500 font-medium">Admin Panel</span>
        <span>&rsaquo;</span>
        <span className="text-foreground font-medium">Network Management</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Network Management</h1>
          <p className="text-sm text-muted mt-1">Create and manage networks with revenue share settings.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Network
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search networks..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">#</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Network Name</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Revenue Share %</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Created</th>
                <th className="text-center px-4 py-3 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((network, idx) => (
                <tr key={network.id} className="border-b border-border hover:bg-slate-50">
                  <td className="px-4 py-3 text-muted">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-purple-500" />
                      <span className="font-medium text-foreground">{network.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      <Percent className="w-3 h-3" />
                      {network.revenueSharePercent}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{network.createdDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openAssign(network)}
                        className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                        title="Assign to Users"
                      >
                        <UserPlus className="w-4 h-4 text-green-600" />
                      </button>
                      <button
                        onClick={() => openEdit(network)}
                        className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        onClick={() => setDeleteId(network.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">
                    <Globe className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p>No networks found. Create one to get started.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-border bg-slate-50 text-sm text-muted">
          {filtered.length} network{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* User-Created Custom Networks */}
      {customNetworks.length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-purple-50">
            <h2 className="text-lg font-semibold text-foreground">User-Created Networks</h2>
            <p className="text-xs text-muted mt-1">Networks added by clients (visible to admin only)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-foreground">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Network Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Created By</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Email</th>
                  <th className="text-center px-4 py-3 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customNetworks
                  .filter((cn) => cn.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((cn, idx) => (
                  <tr key={`${cn.name}-${cn.createdByEmail}-${idx}`} className="border-b border-border hover:bg-slate-50">
                    <td className="px-4 py-3 text-muted">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-indigo-500" />
                        <span className="font-medium text-foreground">{cn.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground">{cn.createdBy}</td>
                    <td className="px-4 py-3 text-muted text-xs">{cn.createdByEmail}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setDeleteId(cn.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete user-created network"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-slate-50 text-sm text-muted">
            {customNetworks.length} user-created network{customNetworks.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {editingNetwork ? "Edit Network" : "Create Network"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Network Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Network Name"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Default Revenue Share %</label>
                <input
                  type="number"
                  value={formRevShare}
                  onChange={(e) => setFormRevShare(e.target.value)}
                  placeholder="e.g. 70"
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-xs text-muted mt-1">Network ka default revenue share percentage (per-user override possible)</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-muted hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingNetwork ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-5">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Network?</h3>
            <p className="text-sm text-muted mb-4">
              This removes the network and its channel relationships. Affected channels will become Not Validated, their stored YouTube data will be cleared, and fresh authorization will be required before data can sync again.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-muted hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign to Users Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                Assign &quot;{assignNetworkName}&quot; to Users
              </h2>
              <button onClick={() => setShowAssignModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-80 overflow-y-auto">
              {assignSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  {assignSuccess}
                </div>
              )}
              {clients.length === 0 ? (
                <p className="text-sm text-muted">No users found.</p>
              ) : (
                clients.map((client) => (
                  <div key={client.id} className="flex items-center gap-3 p-2 border border-border rounded-lg hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedClients.includes(client.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedClients([...selectedClients, client.id]);
                        } else {
                          setSelectedClients(selectedClients.filter((id) => id !== client.id));
                        }
                      }}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-foreground">{client.name}</span>
                      <span className="text-xs text-muted ml-2">{client.email}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-sm text-muted hover:bg-slate-100 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleAssign}
                disabled={assigning || selectedClients.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {assigning && <Loader2 className="w-4 h-4 animate-spin" />}
                Assign to {selectedClients.length} User(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
