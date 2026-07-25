"use client";

import { useState } from "react";
import { Plus, Search, CheckCircle, Trash2, Radio, ExternalLink, MoreVertical } from "lucide-react";

interface AllowlistChannel {
  id: string;
  name: string;
  customUrl: string;
  subscribers: string;
  addedDate: string;
  addedBy: string;
  reason: string;
}

const mockAllowlist: AllowlistChannel[] = [
  { id: "AL1", name: "Bainsla Music Official", customUrl: "@bainslamusic", subscribers: "1.2M", addedDate: "2024-01-15", addedBy: "Admin", reason: "Own channel" },
  { id: "AL2", name: "Desi Beats HD", customUrl: "@desibeats", subscribers: "856K", addedDate: "2024-02-20", addedBy: "Admin", reason: "Partner channel" },
  { id: "AL3", name: "T-Series", customUrl: "@tseries", subscribers: "270M", addedDate: "2024-03-10", addedBy: "Admin", reason: "Licensed partner" },
  { id: "AL4", name: "Bollywood Classics", customUrl: "@bollywoodclassics", subscribers: "15M", addedDate: "2024-05-15", addedBy: "Manager", reason: "Cross-promotion agreement" },
  { id: "AL5", name: "Music Label India", customUrl: "@musiclabelindia", subscribers: "5.6M", addedDate: "2024-08-01", addedBy: "Admin", reason: "Sub-licensing deal" },
];

export default function CmsAllowlistPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredList = mockAllowlist.filter(ch =>
    ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ch.customUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-normal text-[#282828]">Allowlist</h1>
          <p className="text-sm text-[#606060] mt-1">Channels exempt from automated Content ID claims</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#065FD4] text-white text-sm font-medium rounded-lg hover:bg-[#0548a6]">
          <Plus className="w-4 h-4" /> Add channel
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] mb-4 p-3">
        <div className="flex items-center bg-[#f2f2f2] rounded-lg max-w-md">
          <Search className="w-4 h-4 text-[#909090] ml-3" />
          <input type="text" placeholder="Search allowlisted channels..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent px-3 py-2 text-sm outline-none" />
        </div>
      </div>

      {/* Channel list */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e5e5e5] bg-[#f9f9f9]">
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Channel</th>
              <th className="text-right text-xs font-medium text-[#606060] uppercase px-4 py-3">Subscribers</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Reason</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Added by</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Date added</th>
              <th className="w-20 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map(ch => (
              <tr key={ch.id} className="border-b border-[#e5e5e5] hover:bg-[#f9f9f9] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                      <Radio className="w-4 h-4 text-[#909090]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-[#282828]">{ch.name}</p>
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      </div>
                      <p className="text-xs text-[#606060]">{ch.customUrl}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[#606060] text-right">{ch.subscribers}</td>
                <td className="px-4 py-3 text-sm text-[#606060]">{ch.reason}</td>
                <td className="px-4 py-3 text-sm text-[#606060]">{ch.addedBy}</td>
                <td className="px-4 py-3 text-sm text-[#606060]">{ch.addedDate}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button className="p-1 hover:bg-[#f2f2f2] rounded transition-colors" title="View on YouTube">
                      <ExternalLink className="w-4 h-4 text-[#909090]" />
                    </button>
                    <button className="p-1 hover:bg-red-50 rounded transition-colors" title="Remove">
                      <Trash2 className="w-4 h-4 text-[#909090] hover:text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Channel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-[#282828] mb-4">Add channel to allowlist</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Channel URL or ID</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="https://youtube.com/@channel or UC..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Reason</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Why is this channel allowlisted?" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">Cancel</button>
              <button className="px-4 py-2 text-sm text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">Add to allowlist</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
