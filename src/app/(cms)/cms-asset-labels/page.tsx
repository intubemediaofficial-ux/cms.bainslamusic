"use client";

import { useState } from "react";
import { Plus, Search, Tags, Edit3, Trash2, MoreVertical, FileVideo, ChevronRight } from "lucide-react";

interface AssetLabel {
  id: string;
  name: string;
  description: string;
  assetsCount: number;
  activeClaimsCount: number;
  createdDate: string;
  updatedDate: string;
}

const mockLabels: AssetLabel[] = [
  { id: "L1", name: "Punjabi Hits 2024", description: "All Punjabi music releases for 2024", assetsCount: 45, activeClaimsCount: 120, createdDate: "2024-01-01", updatedDate: "2024-12-15" },
  { id: "L2", name: "Bollywood Originals", description: "Original Bollywood soundtracks", assetsCount: 28, activeClaimsCount: 85, createdDate: "2024-02-15", updatedDate: "2024-11-20" },
  { id: "L3", name: "Remix Collection", description: "All remix and mashup tracks", assetsCount: 15, activeClaimsCount: 32, createdDate: "2024-03-10", updatedDate: "2024-10-05" },
  { id: "L4", name: "Classical Archive", description: "Classical music and bhajans", assetsCount: 60, activeClaimsCount: 45, createdDate: "2024-04-01", updatedDate: "2024-09-18" },
  { id: "L5", name: "Bainsla Exclusives", description: "Exclusive Bainsla Music releases", assetsCount: 22, activeClaimsCount: 67, createdDate: "2024-05-20", updatedDate: "2024-12-01" },
];

export default function CmsAssetLabelsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelDesc, setNewLabelDesc] = useState("");

  const filteredLabels = mockLabels.filter((l) =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-normal text-[#282828]">Asset labels</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#065FD4] text-white text-sm font-medium rounded-lg hover:bg-[#0548a6] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create label
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] mb-4">
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center bg-[#f2f2f2] rounded-lg flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#909090] ml-3" />
            <input
              type="text"
              placeholder="Search labels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>
      </div>

      {/* Labels grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLabels.map((label) => (
          <div key={label.id} className="bg-white rounded-lg border border-[#e5e5e5] p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tags className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-medium text-[#282828]">{label.name}</h3>
              </div>
              <button className="p-1 hover:bg-[#f2f2f2] rounded opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="w-4 h-4 text-[#909090]" />
              </button>
            </div>
            <p className="text-xs text-[#606060] mb-4">{label.description}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-lg font-semibold text-[#282828]">{label.assetsCount}</p>
                <p className="text-xs text-[#606060]">Assets</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-[#282828]">{label.activeClaimsCount}</p>
                <p className="text-xs text-[#606060]">Active claims</p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#e5e5e5] flex items-center justify-between">
              <span className="text-xs text-[#909090]">Updated {label.updatedDate}</span>
              <button className="text-xs text-[#065FD4] hover:text-[#065FD4] flex items-center gap-1">
                View claims <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Label Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-[#282828] mb-4">Create new label</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Label name</label>
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Enter label name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Description</label>
                <textarea
                  value={newLabelDesc}
                  onChange={(e) => setNewLabelDesc(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Describe this label"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">
                Cancel
              </button>
              <button className="px-4 py-2 text-sm text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">
                Create label
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
