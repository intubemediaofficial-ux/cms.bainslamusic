"use client";

import { useState } from "react";
import { Plus, Search, Shield, Edit3, Trash2, MoreVertical, Clock, Globe, Music, Film, Copy } from "lucide-react";

type PolicyAction = "monetize" | "track" | "block";
type PolicyType = "upload" | "match";

interface Policy {
  id: string;
  name: string;
  type: PolicyType;
  action: PolicyAction;
  conditions: string[];
  assetsUsing: number;
  scheduledDate: string | null;
  createdDate: string;
  status: "active" | "scheduled" | "inactive";
}

const mockPolicies: Policy[] = [
  { id: "P1", name: "Monetize All Worldwide", type: "match", action: "monetize", conditions: ["All match types", "All territories"], assetsUsing: 450, scheduledDate: null, createdDate: "2024-01-15", status: "active" },
  { id: "P2", name: "Block in India", type: "match", action: "block", conditions: ["Audiovisual match", "Viewer: India"], assetsUsing: 25, scheduledDate: null, createdDate: "2024-03-20", status: "active" },
  { id: "P3", name: "Track Only - Short Matches", type: "match", action: "track", conditions: ["Match < 30 seconds"], assetsUsing: 80, scheduledDate: null, createdDate: "2024-05-10", status: "active" },
  { id: "P4", name: "Upload - Monetize Partner Videos", type: "upload", action: "monetize", conditions: ["All territories"], assetsUsing: 200, scheduledDate: null, createdDate: "2024-02-01", status: "active" },
  { id: "P5", name: "New Year Campaign - Block", type: "match", action: "block", conditions: ["Audiovisual match", "All territories"], assetsUsing: 0, scheduledDate: "2025-01-01", createdDate: "2024-12-15", status: "scheduled" },
  { id: "P6", name: "Track Audio Only", type: "match", action: "track", conditions: ["Audio only match", "All territories"], assetsUsing: 120, scheduledDate: null, createdDate: "2024-04-05", status: "active" },
];

function getActionBadge(action: PolicyAction) {
  switch (action) {
    case "monetize": return <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">Monetize</span>;
    case "track": return <span className="px-2 py-0.5 text-xs font-medium bg-[#def1ff] text-[#065FD4] rounded-full">Track</span>;
    case "block": return <span className="px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 rounded-full">Block</span>;
  }
}

export default function CmsPoliciesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPolicyType, setNewPolicyType] = useState<PolicyType>("match");
  const [newPolicyAction, setNewPolicyAction] = useState<PolicyAction>("monetize");

  const filteredPolicies = mockPolicies.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-normal text-[#282828]">Policies</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#065FD4] text-white text-sm font-medium rounded-lg hover:bg-[#0548a6] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create policy
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-[#e5e5e5] mb-4">
        {[
          { value: "all", label: "All policies" },
          { value: "match", label: "Match policies" },
          { value: "upload", label: "Upload policies" },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setTypeFilter(tab.value)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${typeFilter === tab.value ? "border-[#282828] text-[#065FD4]" : "border-transparent text-[#606060] hover:text-[#282828]"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] mb-4 p-3">
        <div className="flex items-center bg-[#f2f2f2] rounded-lg max-w-md">
          <Search className="w-4 h-4 text-[#909090] ml-3" />
          <input type="text" placeholder="Search policies..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent px-3 py-2 text-sm outline-none" />
        </div>
      </div>

      {/* Policies list */}
      <div className="space-y-3">
        {filteredPolicies.map((policy) => (
          <div key={policy.id} className="bg-white rounded-lg border border-[#e5e5e5] p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-[#909090]" />
                  <h3 className="text-sm font-medium text-[#282828]">{policy.name}</h3>
                  {getActionBadge(policy.action)}
                  <span className={`px-2 py-0.5 text-xs rounded-full ${policy.type === "match" ? "bg-purple-50 text-purple-600" : "bg-orange-50 text-orange-600"}`}>
                    {policy.type === "match" ? "Match policy" : "Upload policy"}
                  </span>
                  {policy.status === "scheduled" && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-50 text-yellow-600 rounded-full">
                      <Clock className="w-3 h-3" /> Scheduled: {policy.scheduledDate}
                    </span>
                  )}
                </div>
                <div className="ml-8 flex items-center gap-4 text-xs text-[#606060]">
                  <span>Conditions: {policy.conditions.join(", ")}</span>
                  <span>•</span>
                  <span>{policy.assetsUsing} assets using this policy</span>
                  <span>•</span>
                  <span>Created {policy.createdDate}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-1.5 hover:bg-[#f2f2f2] rounded transition-colors" title="Duplicate">
                  <Copy className="w-4 h-4 text-[#909090]" />
                </button>
                <button className="p-1.5 hover:bg-[#f2f2f2] rounded transition-colors" title="Edit">
                  <Edit3 className="w-4 h-4 text-[#909090]" />
                </button>
                <button className="p-1.5 hover:bg-[#f2f2f2] rounded transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4 text-[#909090]" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Policy Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-[#282828] mb-4">Create new policy</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Policy name</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Enter policy name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#282828] mb-1">Policy type</label>
                  <select value={newPolicyType} onChange={(e) => setNewPolicyType(e.target.value as PolicyType)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="match">Match policy</option>
                    <option value="upload">Upload policy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#282828] mb-1">Action</label>
                  <select value={newPolicyAction} onChange={(e) => setNewPolicyAction(e.target.value as PolicyAction)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="monetize">Monetize</option>
                    <option value="track">Track</option>
                    <option value="block">Block</option>
                  </select>
                </div>
              </div>
              {newPolicyType === "match" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[#282828] mb-1">Match type</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      <option>All match types</option>
                      <option>Audio only</option>
                      <option>Video only</option>
                      <option>Audiovisual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#282828] mb-1">Minimum match length</label>
                    <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g., 30 seconds" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Viewer location</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g., Worldwide or specific countries" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Schedule (optional)</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">Cancel</button>
              <button className="px-4 py-2 text-sm text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">Create policy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
