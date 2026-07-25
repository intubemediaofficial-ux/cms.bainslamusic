"use client";

import { useState } from "react";
import { Plus, Search, Target, Calendar, MoreVertical, Play, Pause, CheckCircle, Clock, Eye, DollarSign } from "lucide-react";

type CampaignStatus = "active" | "scheduled" | "ended" | "draft";
type CampaignType = "asset-based" | "label-based";

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  assets: number;
  startDate: string;
  endDate: string;
  views: string;
  revenue: string;
  description: string;
}

const mockCampaigns: Campaign[] = [
  { id: "C1", name: "Punjabi Hits Winter 2024", type: "label-based", status: "active", assets: 25, startDate: "2024-12-01", endDate: "2025-02-28", views: "2.3M", revenue: "$1,200", description: "Winter season Punjabi music promotion" },
  { id: "C2", name: "Tere Bina Launch Campaign", type: "asset-based", status: "ended", assets: 1, startDate: "2024-12-10", endDate: "2024-12-25", views: "890K", revenue: "$450", description: "New single launch promotion" },
  { id: "C3", name: "New Year Special 2025", type: "label-based", status: "scheduled", assets: 30, startDate: "2025-01-01", endDate: "2025-01-15", views: "0", revenue: "$0", description: "New year celebration special playlist" },
  { id: "C4", name: "Bainsla Classics Revival", type: "label-based", status: "active", assets: 60, startDate: "2024-11-01", endDate: "2025-03-31", views: "1.5M", revenue: "$780", description: "Reviving classic Bainsla music catalog" },
  { id: "C5", name: "Ishq Tera Promo", type: "asset-based", status: "draft", assets: 2, startDate: "", endDate: "", views: "0", revenue: "$0", description: "Upcoming Ishq Tera promotional campaign" },
];

function getStatusBadge(status: CampaignStatus) {
  switch (status) {
    case "active": return <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full"><Play className="w-3 h-3" /> Active</span>;
    case "scheduled": return <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-[#def1ff] text-[#065FD4] rounded-full"><Clock className="w-3 h-3" /> Scheduled</span>;
    case "ended": return <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-[#f2f2f2] text-[#606060] rounded-full"><CheckCircle className="w-3 h-3" /> Ended</span>;
    case "draft": return <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-50 text-yellow-700 rounded-full"><Pause className="w-3 h-3" /> Draft</span>;
  }
}

export default function CmsCampaignsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filteredCampaigns = mockCampaigns.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-normal text-[#282828]">Campaigns</h1>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#065FD4] text-white text-sm font-medium rounded-lg hover:bg-[#0548a6]">
          <Plus className="w-4 h-4" /> Create campaign
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        {["all", "active", "scheduled", "ended", "draft"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-sm rounded-full border transition-colors capitalize ${statusFilter === s ? "bg-[#def1ff] border-blue-200 text-[#065FD4]" : "border-[#e5e5e5] text-[#606060] hover:bg-[#f9f9f9]"}`}>
            {s === "all" ? "All campaigns" : s}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] mb-4 p-3">
        <div className="flex items-center bg-[#f2f2f2] rounded-lg max-w-md">
          <Search className="w-4 h-4 text-[#909090] ml-3" />
          <input type="text" placeholder="Search campaigns..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent px-3 py-2 text-sm outline-none" />
        </div>
      </div>

      {/* Campaigns list */}
      <div className="space-y-3">
        {filteredCampaigns.map(campaign => (
          <div key={campaign.id} className="bg-white rounded-lg border border-[#e5e5e5] p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Target className="w-5 h-5 text-[#909090]" />
                  <h3 className="text-sm font-medium text-[#282828]">{campaign.name}</h3>
                  {getStatusBadge(campaign.status)}
                  <span className={`px-2 py-0.5 text-xs rounded-full ${campaign.type === "asset-based" ? "bg-purple-50 text-purple-600" : "bg-orange-50 text-orange-600"}`}>
                    {campaign.type === "asset-based" ? "Asset-based" : "Label-based"}
                  </span>
                </div>
                <p className="text-xs text-[#606060] ml-8 mb-3">{campaign.description}</p>
                <div className="flex items-center gap-6 ml-8 text-xs text-[#606060]">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {campaign.startDate || "Not set"} → {campaign.endDate || "Not set"}</span>
                  <span>{campaign.assets} assets</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {campaign.views}</span>
                  <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {campaign.revenue}</span>
                </div>
              </div>
              <button className="p-1 hover:bg-[#f2f2f2] rounded"><MoreVertical className="w-4 h-4 text-[#909090]" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-[#282828] mb-4">Create new campaign</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Campaign name</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Enter campaign name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Campaign type</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option>Asset-based</option>
                  <option>Label-based</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Description</label>
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Campaign description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#282828] mb-1">Start date</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#282828] mb-1">End date</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">Cancel</button>
              <button className="px-4 py-2 text-sm text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">Create campaign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
