"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  Download,
  Trash2,
  Edit3,
  MoreVertical,
  Video,
  Eye,
  ThumbsUp,
  MessageSquare,
  Clock,
  CheckSquare,
  Square,
  ChevronDown,
  Upload,
  Shield,
  MonitorPlay,
} from "lucide-react";

type TabType = "uploads" | "live";

interface VideoItem {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  views: string;
  likes: string;
  comments: string;
  publishDate: string;
  duration: string;
  contentId: boolean;
  claimStatus: "none" | "active" | "potential" | "disputed";
  monetized: boolean;
  visibility: "public" | "private" | "unlisted";
}

const mockVideos: VideoItem[] = [
  { id: "1", title: "Tere Bina - Official Music Video", channel: "InTubeMedia", thumbnail: "", views: "1.2M", likes: "45K", comments: "2.3K", publishDate: "2024-12-15", duration: "4:32", contentId: true, claimStatus: "active", monetized: true, visibility: "public" },
  { id: "2", title: "Sada Punjab - Full Song", channel: "Desi Beats", thumbnail: "", views: "856K", likes: "32K", comments: "1.8K", publishDate: "2024-11-20", duration: "5:15", contentId: true, claimStatus: "potential", monetized: true, visibility: "public" },
  { id: "3", title: "Nachdi Jawani - Lyrical", channel: "InTubeMedia", thumbnail: "", views: "2.1M", likes: "78K", comments: "4.5K", publishDate: "2024-10-05", duration: "3:48", contentId: true, claimStatus: "none", monetized: true, visibility: "public" },
  { id: "4", title: "Dil Da Mamla - Audio", channel: "Music Hub", thumbnail: "", views: "345K", likes: "12K", comments: "890", publishDate: "2024-09-18", duration: "4:05", contentId: false, claimStatus: "none", monetized: false, visibility: "unlisted" },
  { id: "5", title: "Punjab Di Shan - Remix", channel: "Desi Beats", thumbnail: "", views: "567K", likes: "21K", comments: "1.1K", publishDate: "2024-08-22", duration: "3:22", contentId: true, claimStatus: "disputed", monetized: true, visibility: "public" },
  { id: "6", title: "Ishq Tera - Unplugged", channel: "InTubeMedia", thumbnail: "", views: "189K", likes: "8.5K", comments: "456", publishDate: "2024-07-30", duration: "5:48", contentId: true, claimStatus: "active", monetized: true, visibility: "public" },
];

const mockLiveStreams: VideoItem[] = [
  { id: "l1", title: "Live Concert - InTubeMedia Night 2024", channel: "InTubeMedia", thumbnail: "", views: "45K", likes: "3.2K", comments: "890", publishDate: "2024-12-31", duration: "2:30:00", contentId: false, claimStatus: "none", monetized: true, visibility: "public" },
  { id: "l2", title: "Music Launch Event Live", channel: "InTubeMedia", thumbnail: "", views: "12K", likes: "1.1K", comments: "234", publishDate: "2024-11-15", duration: "1:45:00", contentId: false, claimStatus: "none", monetized: false, visibility: "public" },
];

function getClaimBadge(status: VideoItem["claimStatus"]) {
  switch (status) {
    case "active": return <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">Active claim</span>;
    case "potential": return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-50 text-yellow-700 rounded-full">Potential</span>;
    case "disputed": return <span className="px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 rounded-full">Disputed</span>;
    default: return null;
  }
}

export default function CmsVideosPage() {
  const [activeTab, setActiveTab] = useState<TabType>("uploads");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  const videos = activeTab === "uploads" ? mockVideos : mockLiveStreams;
  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.channel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelectedVideos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedVideos.size === filteredVideos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(filteredVideos.map((v) => v.id)));
    }
  };

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-normal text-[#282828]">Videos</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-[#e5e5e5] mb-4">
        <button
          onClick={() => { setActiveTab("uploads"); setSelectedVideos(new Set()); }}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "uploads" ? "border-[#282828] text-[#065FD4]" : "border-transparent text-[#606060] hover:text-[#282828]"
          }`}
        >
          Uploads
        </button>
        <button
          onClick={() => { setActiveTab("live"); setSelectedVideos(new Set()); }}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "live" ? "border-[#282828] text-[#065FD4]" : "border-transparent text-[#606060] hover:text-[#282828]"
          }`}
        >
          Live
        </button>
        <button
          className="pb-3 text-sm font-medium border-b-2 border-transparent text-[#606060] hover:text-[#282828] transition-colors"
        >
          Rights Management
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] mb-4">
        <div className="flex items-center gap-3 p-3">
          {/* Search */}
          <div className="flex items-center bg-[#f2f2f2] rounded-lg flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#909090] ml-3" />
            <input
              type="text"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>

          {/* Filter */}
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9] transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filter
            <ChevronDown className="w-3 h-3" />
          </button>

          <div className="flex-1" />

          {/* Bulk actions */}
          {selectedVideos.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#606060]">{selectedVideos.size} selected</span>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">
                <Shield className="w-3.5 h-3.5" /> Content ID
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}

          {selectedVideos.size === 0 && (
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          )}
        </div>

        {/* Filter panel */}
        {filterOpen && (
          <div className="px-3 pb-3 border-t border-[#e5e5e5] pt-3">
            <div className="flex flex-wrap gap-3">
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-[#606060]">
                <option>All channels</option>
                <option>InTubeMedia</option>
                <option>Desi Beats</option>
                <option>Music Hub</option>
              </select>
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-[#606060]">
                <option>Claim status</option>
                <option>Active claim</option>
                <option>Potential</option>
                <option>Disputed</option>
                <option>No claim</option>
              </select>
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-[#606060]">
                <option>Visibility</option>
                <option>Public</option>
                <option>Private</option>
                <option>Unlisted</option>
              </select>
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-[#606060]">
                <option>Content ID</option>
                <option>Enabled</option>
                <option>Disabled</option>
              </select>
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-[#606060]">
                <option>Monetization</option>
                <option>Monetized</option>
                <option>Not monetized</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Video list table */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e5e5e5] bg-[#f9f9f9]">
              <th className="w-10 px-4 py-3">
                <button onClick={toggleSelectAll}>
                  {selectedVideos.size === filteredVideos.length && filteredVideos.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-[#065FD4]" />
                  ) : (
                    <Square className="w-4 h-4 text-[#909090]" />
                  )}
                </button>
              </th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Video</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Channel</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Visibility</th>
              <th className="text-right text-xs font-medium text-[#606060] uppercase px-4 py-3">Views</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Claims</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Content ID</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Date</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredVideos.map((video) => (
              <tr key={video.id} className="border-b border-[#e5e5e5] hover:bg-[#f9f9f9] transition-colors">
                <td className="px-4 py-3">
                  <button onClick={() => toggleSelect(video.id)}>
                    {selectedVideos.has(video.id) ? (
                      <CheckSquare className="w-4 h-4 text-[#065FD4]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#909090]" />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-[120px] h-[68px] bg-gray-200 rounded flex items-center justify-center shrink-0">
                      <Video className="w-6 h-6 text-[#909090]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#282828] line-clamp-2">{video.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#606060]">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{video.views}</span>
                        <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{video.likes}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{video.duration}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[#606060]">{video.channel}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium capitalize ${
                    video.visibility === "public" ? "text-green-600" : video.visibility === "private" ? "text-red-600" : "text-[#606060]"
                  }`}>
                    {video.visibility}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#606060] text-right">{video.views}</td>
                <td className="px-4 py-3">{getClaimBadge(video.claimStatus)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${video.contentId ? "text-green-600" : "text-[#909090]"}`}>
                    {video.contentId ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#606060]">{video.publishDate}</td>
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
    </div>
  );
}
