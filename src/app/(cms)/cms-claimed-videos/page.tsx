"use client";

import { useState } from "react";
import {
  Search, Filter, Download, MoreVertical, Video, ChevronDown, CheckSquare, Square, Eye, Clock, Shield, XCircle, RefreshCw,
} from "lucide-react";

type ClaimStatus = "active" | "potential" | "disputed" | "appealed" | "inactive" | "pending" | "takedown";
type ClaimType = "audio" | "visual" | "audiovisual";
type Source = "partner" | "other";

interface ClaimedVideo {
  id: string;
  title: string;
  channel: string;
  views: string;
  publishDate: string;
  source: Source;
  claims: {
    asset: string;
    status: ClaimStatus;
    type: ClaimType;
    policy: string;
    createdDate: string;
  }[];
}

const mockClaimedVideos: ClaimedVideo[] = [
  { id: "CV1", title: "My Version of Tere Bina", channel: "Random User", views: "45K", publishDate: "2024-12-10", source: "other", claims: [{ asset: "Tere Bina", status: "active", type: "audio", policy: "Monetize", createdDate: "2024-12-11" }] },
  { id: "CV2", title: "Tere Bina - Official Music Video", channel: "Bainsla Music Official", views: "1.2M", publishDate: "2024-12-15", source: "partner", claims: [{ asset: "Tere Bina", status: "active", type: "audiovisual", policy: "Monetize", createdDate: "2024-12-15" }] },
  { id: "CV3", title: "Best Punjabi Songs Mashup 2024", channel: "Music Lover", views: "234K", publishDate: "2024-11-20", source: "other", claims: [{ asset: "Sada Punjab", status: "active", type: "audio", policy: "Monetize", createdDate: "2024-11-21" }, { asset: "Nachdi Jawani", status: "disputed", type: "audio", policy: "Monetize", createdDate: "2024-11-21" }] },
  { id: "CV4", title: "Nachdi Jawani Dance Cover", channel: "Dance Academy", views: "89K", publishDate: "2024-10-05", source: "other", claims: [{ asset: "Nachdi Jawani", status: "potential", type: "audiovisual", policy: "Track", createdDate: "2024-10-06" }] },
  { id: "CV5", title: "Punjabi Songs Reaction", channel: "React World", views: "156K", publishDate: "2024-09-28", source: "other", claims: [{ asset: "Punjab Di Shan", status: "disputed", type: "audio", policy: "Block", createdDate: "2024-09-29" }] },
  { id: "CV6", title: "Ishq Tera Piano Cover", channel: "Piano Master", views: "67K", publishDate: "2024-09-15", source: "other", claims: [{ asset: "Ishq Tera", status: "appealed", type: "audio", policy: "Monetize", createdDate: "2024-09-16" }] },
  { id: "CV7", title: "Wedding Highlights with Bainsla Music", channel: "Wedding Films", views: "23K", publishDate: "2024-08-20", source: "other", claims: [{ asset: "Tere Bina", status: "pending", type: "audio", policy: "Track", createdDate: "2024-08-21" }] },
  { id: "CV8", title: "Top 10 Punjabi Hits", channel: "Music Charts", views: "345K", publishDate: "2024-07-10", source: "other", claims: [{ asset: "Sada Punjab", status: "active", type: "audio", policy: "Monetize", createdDate: "2024-07-11" }, { asset: "Tere Bina", status: "active", type: "audio", policy: "Monetize", createdDate: "2024-07-11" }] },
];

function getStatusBadge(status: ClaimStatus) {
  const styles: Record<ClaimStatus, string> = {
    active: "bg-green-50 text-green-700",
    potential: "bg-yellow-50 text-yellow-700",
    disputed: "bg-red-50 text-red-700",
    appealed: "bg-orange-50 text-orange-700",
    inactive: "bg-[#f2f2f2] text-[#606060]",
    pending: "bg-[#def1ff] text-[#065FD4]",
    takedown: "bg-red-100 text-red-800",
  };
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status]}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

export default function CmsClaimedVideosPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());

  const filteredVideos = mockClaimedVideos.filter((v) => {
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || v.channel.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = sourceFilter === "all" || v.source === sourceFilter;
    const matchesStatus = statusFilter === "all" || v.claims.some(c => c.status === statusFilter);
    return matchesSearch && matchesSource && matchesStatus;
  });

  const toggleSelect = (id: string) => {
    setSelectedVideos(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-normal text-[#282828]">Claimed videos</h1>
      </div>

      {/* Source tabs */}
      <div className="flex items-center gap-6 border-b border-[#e5e5e5] mb-4">
        {[
          { value: "all", label: "All sources" },
          { value: "partner", label: "Partner provided videos" },
          { value: "other", label: "Other parties' videos" },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setSourceFilter(tab.value)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${sourceFilter === tab.value ? "border-[#282828] text-[#065FD4]" : "border-transparent text-[#606060] hover:text-[#282828]"}`}
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
            <input type="text" placeholder="Search claimed videos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent px-3 py-2 text-sm outline-none" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-[#606060]">
            <option value="all">Claim status</option>
            <option value="active">Active</option>
            <option value="potential">Potential</option>
            <option value="disputed">Disputed</option>
            <option value="appealed">Appealed</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
            <option value="takedown">Takedown</option>
          </select>
          <select className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-[#606060]">
            <option>Claim type</option>
            <option>Audio</option>
            <option>Visual</option>
            <option>Audiovisual</option>
          </select>
          <div className="flex-1" />
          {selectedVideos.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#606060]">{selectedVideos.size} selected</span>
              <button className="px-3 py-1.5 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">Release claims</button>
              <button className="px-3 py-1.5 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">Change policy</button>
            </div>
          )}
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Claimed videos list */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] overflow-hidden">
        <div className="divide-y divide-gray-100">
          {filteredVideos.map((video) => (
            <div key={video.id} className="px-6 py-4 hover:bg-[#f9f9f9] transition-colors">
              <div className="flex items-start gap-4">
                <button onClick={() => toggleSelect(video.id)} className="mt-1">
                  {selectedVideos.has(video.id) ? <CheckSquare className="w-4 h-4 text-[#065FD4]" /> : <Square className="w-4 h-4 text-[#909090]" />}
                </button>
                <div className="w-[140px] h-[80px] bg-gray-200 rounded flex items-center justify-center shrink-0">
                  <Video className="w-6 h-6 text-[#909090]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-[#282828] mb-1">{video.title}</h3>
                  <p className="text-xs text-[#606060] mb-2">{video.channel} • {video.views} views • {video.publishDate}</p>
                  <div className="space-y-1.5">
                    {video.claims.map((claim, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-[#f9f9f9] rounded px-3 py-1.5">
                        <span className="text-xs text-[#606060] font-medium">{claim.asset}</span>
                        {getStatusBadge(claim.status)}
                        <span className="text-xs text-[#606060] capitalize">{claim.type}</span>
                        <span className="text-xs text-[#909090]">Policy: {claim.policy}</span>
                        <span className="text-xs text-[#909090] ml-auto">{claim.createdDate}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {video.claims.some(c => c.status === "potential" || c.status === "disputed" || c.status === "appealed") && (
                    <button className="px-3 py-1 text-xs font-medium text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">Review</button>
                  )}
                  <button className="p-1 hover:bg-[#f2f2f2] rounded"><MoreVertical className="w-4 h-4 text-[#909090]" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
