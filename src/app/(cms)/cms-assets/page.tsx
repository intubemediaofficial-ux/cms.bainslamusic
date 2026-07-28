"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  Download,
  Plus,
  Edit3,
  MoreVertical,
  Music,
  Film,
  Globe,
  Tv,
  FileVideo,
  ChevronDown,
  CheckSquare,
  Square,
  ExternalLink,
} from "lucide-react";

type AssetType = "sound_recording" | "music_video" | "composition" | "web" | "movie" | "tv_episode";

interface Asset {
  id: string;
  title: string;
  type: AssetType;
  artist: string;
  isrc: string;
  upc: string;
  album: string;
  label: string;
  activeClaims: number;
  ownership: string;
  territories: string;
  status: "active" | "inactive";
  createdDate: string;
}

const mockAssets: Asset[] = [
  { id: "A001", title: "Tere Bina", type: "sound_recording", artist: "Bainsla", isrc: "INS1234567890", upc: "1234567890123", album: "Dil Se", label: "Bainsla Music", activeClaims: 12, ownership: "100%", territories: "Worldwide", status: "active", createdDate: "2024-01-15" },
  { id: "A002", title: "Tere Bina - Official MV", type: "music_video", artist: "Bainsla", isrc: "INS1234567891", upc: "1234567890124", album: "Dil Se", label: "Bainsla Music", activeClaims: 8, ownership: "100%", territories: "Worldwide", status: "active", createdDate: "2024-01-20" },
  { id: "A003", title: "Sada Punjab", type: "sound_recording", artist: "Ranjit Singh", isrc: "INS2234567890", upc: "2234567890123", album: "Punjab Forever", label: "Desi Beats", activeClaims: 5, ownership: "75%", territories: "IN, US, CA, UK", status: "active", createdDate: "2024-02-10" },
  { id: "A004", title: "Nachdi Jawani", type: "composition", artist: "Various", isrc: "", upc: "", album: "", label: "Bainsla Music", activeClaims: 3, ownership: "50%", territories: "IN", status: "active", createdDate: "2024-03-05" },
  { id: "A005", title: "Dil Da Mamla", type: "sound_recording", artist: "Bainsla", isrc: "INS3234567890", upc: "3234567890123", album: "Love Stories", label: "Music Hub", activeClaims: 0, ownership: "100%", territories: "Worldwide", status: "inactive", createdDate: "2024-04-12" },
  { id: "A006", title: "Punjab Di Shan - Remix", type: "sound_recording", artist: "DJ Remix", isrc: "INS4234567890", upc: "4234567890123", album: "Remix Collection", label: "Desi Beats", activeClaims: 2, ownership: "60%", territories: "IN, CA", status: "active", createdDate: "2024-05-20" },
  { id: "A007", title: "Ishq Tera", type: "music_video", artist: "Bainsla", isrc: "INS5234567890", upc: "5234567890123", album: "Love Stories", label: "Bainsla Music", activeClaims: 15, ownership: "100%", territories: "Worldwide", status: "active", createdDate: "2024-06-01" },
];

function getTypeIcon(type: AssetType) {
  switch (type) {
    case "sound_recording": return <Music className="w-4 h-4 text-blue-500" />;
    case "music_video": return <Film className="w-4 h-4 text-purple-500" />;
    case "composition": return <FileVideo className="w-4 h-4 text-green-500" />;
    case "web": return <Globe className="w-4 h-4 text-orange-500" />;
    case "movie": return <Film className="w-4 h-4 text-red-500" />;
    case "tv_episode": return <Tv className="w-4 h-4 text-teal-500" />;
  }
}

function getTypeLabel(type: AssetType) {
  return type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export default function CmsAssetsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filteredAssets = mockAssets.filter((a) => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.isrc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || a.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const toggleSelect = (id: string) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedAssets.size === filteredAssets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(filteredAssets.map((a) => a.id)));
    }
  };

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-normal text-[#282828]">Assets</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#065FD4] text-white text-sm font-medium rounded-lg hover:bg-[#0548a6] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create asset
        </button>
      </div>

      {/* Asset type tabs */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {[
          { value: "all", label: "All types" },
          { value: "sound_recording", label: "Sound recordings" },
          { value: "music_video", label: "Music videos" },
          { value: "composition", label: "Compositions" },
          { value: "web", label: "Web" },
          { value: "movie", label: "Movies" },
          { value: "tv_episode", label: "TV Episodes" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setTypeFilter(tab.value)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              typeFilter === tab.value
                ? "bg-[#def1ff] border-blue-200 text-[#065FD4]"
                : "border-[#e5e5e5] text-[#606060] hover:bg-[#f9f9f9]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] mb-4">
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center bg-[#f2f2f2] rounded-lg flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#909090] ml-3" />
            <input
              type="text"
              placeholder="Search assets by title, artist, ISRC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]"
          >
            <Filter className="w-4 h-4" /> Filter <ChevronDown className="w-3 h-3" />
          </button>
          <div className="flex-1" />
          {selectedAssets.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#606060]">{selectedAssets.size} selected</span>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          )}
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
        {filterOpen && (
          <div className="px-3 pb-3 border-t border-[#e5e5e5] pt-3">
            <div className="flex flex-wrap gap-3">
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-[#606060]">
                <option>Claim status</option>
                <option>Has active claims</option>
                <option>No active claims</option>
              </select>
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-[#606060]">
                <option>Ownership</option>
                <option>100% owned</option>
                <option>Partial ownership</option>
              </select>
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-[#606060]">
                <option>Label</option>
                <option>Bainsla Music</option>
                <option>Desi Beats</option>
                <option>Music Hub</option>
              </select>
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-[#606060]">
                <option>Status</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Assets table */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e5e5e5] bg-[#f9f9f9]">
              <th className="w-10 px-4 py-3">
                <button onClick={toggleSelectAll}>
                  {selectedAssets.size === filteredAssets.length && filteredAssets.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-[#065FD4]" />
                  ) : (
                    <Square className="w-4 h-4 text-[#909090]" />
                  )}
                </button>
              </th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Asset</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Type</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">ISRC</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Label</th>
              <th className="text-right text-xs font-medium text-[#606060] uppercase px-4 py-3">Claims</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Ownership</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Territories</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Status</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((asset) => (
              <tr key={asset.id} className="border-b border-[#e5e5e5] hover:bg-[#f9f9f9] transition-colors">
                <td className="px-4 py-3">
                  <button onClick={() => toggleSelect(asset.id)}>
                    {selectedAssets.has(asset.id) ? (
                      <CheckSquare className="w-4 h-4 text-[#065FD4]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#909090]" />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#282828]">{asset.title}</p>
                    <p className="text-xs text-[#606060]">{asset.artist} • {asset.album || "—"}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {getTypeIcon(asset.type)}
                    <span className="text-xs text-[#606060]">{getTypeLabel(asset.type)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[#606060] font-mono">{asset.isrc || "—"}</td>
                <td className="px-4 py-3 text-sm text-[#606060]">{asset.label}</td>
                <td className="px-4 py-3 text-sm text-[#606060] text-right">{asset.activeClaims}</td>
                <td className="px-4 py-3 text-sm text-[#606060]">{asset.ownership}</td>
                <td className="px-4 py-3 text-xs text-[#606060]">{asset.territories}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${asset.status === "active" ? "text-green-600" : "text-[#909090]"}`}>
                    {asset.status === "active" ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button className="p-1 hover:bg-[#f2f2f2] rounded transition-colors">
                    <MoreVertical className="w-4 h-4 text-[#909090]" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Asset Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-[#282828] mb-4">Create new asset</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Asset type</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option>Sound recording</option>
                  <option>Music video</option>
                  <option>Composition</option>
                  <option>Web</option>
                  <option>Movie</option>
                  <option>TV Episode</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Title</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Enter asset title" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#282828] mb-1">Artist</label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Artist name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#282828] mb-1">ISRC</label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ISRC code" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#282828] mb-1">Album</label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Album name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#282828] mb-1">Label</label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Label name" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Territories</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g., Worldwide or IN, US, CA" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">
                Cancel
              </button>
              <button className="px-4 py-2 text-sm text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">
                Create asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
