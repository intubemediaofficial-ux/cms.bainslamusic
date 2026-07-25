"use client";

import { useState } from "react";
import {
  Search,
  Plus,
  UserPlus,
  Link2,
  MoreVertical,
  Radio,
  Eye,
  Users,
  Video,
  DollarSign,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Trash2,
  ExternalLink,
  Filter,
  ChevronDown,
  Download,
} from "lucide-react";

interface Channel {
  id: string;
  name: string;
  customUrl: string;
  thumbnail: string;
  subscribers: string;
  views: string;
  videos: number;
  monetized: boolean;
  copyrightStrikes: number;
  contentIdEnabled: boolean;
  status: "active" | "pending" | "suspended";
  joinedDate: string;
  permissions: {
    viewRevenue: boolean;
    setMatchPolicy: boolean;
    monetizeUploads: boolean;
  };
}

const mockChannels: Channel[] = [
  { id: "UC001", name: "Bainsla Music Official", customUrl: "@bainslamusic", thumbnail: "", subscribers: "1.2M", views: "450M", videos: 245, monetized: true, copyrightStrikes: 0, contentIdEnabled: true, status: "active", joinedDate: "2020-03-15", permissions: { viewRevenue: true, setMatchPolicy: true, monetizeUploads: true } },
  { id: "UC002", name: "Desi Beats HD", customUrl: "@desibeats", thumbnail: "", subscribers: "856K", views: "280M", videos: 178, monetized: true, copyrightStrikes: 0, contentIdEnabled: true, status: "active", joinedDate: "2021-06-20", permissions: { viewRevenue: true, setMatchPolicy: false, monetizeUploads: true } },
  { id: "UC003", name: "Punjab Music Hub", customUrl: "@punjabmusic", thumbnail: "", subscribers: "345K", views: "120M", videos: 92, monetized: false, copyrightStrikes: 0, contentIdEnabled: false, status: "active", joinedDate: "2022-01-10", permissions: { viewRevenue: false, setMatchPolicy: false, monetizeUploads: false } },
  { id: "UC004", name: "Bainsla Classics", customUrl: "@bainslaclassics", thumbnail: "", subscribers: "234K", views: "89M", videos: 156, monetized: true, copyrightStrikes: 1, contentIdEnabled: true, status: "active", joinedDate: "2021-09-05", permissions: { viewRevenue: true, setMatchPolicy: true, monetizeUploads: true } },
  { id: "UC005", name: "Music Factory India", customUrl: "@musicfactory", thumbnail: "", subscribers: "567K", views: "200M", videos: 134, monetized: false, copyrightStrikes: 0, contentIdEnabled: false, status: "active", joinedDate: "2022-04-18", permissions: { viewRevenue: false, setMatchPolicy: false, monetizeUploads: false } },
  { id: "UC006", name: "Bollywood Remix Zone", customUrl: "@bollywoodremix", thumbnail: "", subscribers: "123K", views: "45M", videos: 67, monetized: false, copyrightStrikes: 0, contentIdEnabled: false, status: "active", joinedDate: "2023-02-28", permissions: { viewRevenue: false, setMatchPolicy: false, monetizeUploads: false } },
  { id: "UC007", name: "Sufi Soul Music", customUrl: "@sufisoul", thumbnail: "", subscribers: "189K", views: "67M", videos: 89, monetized: false, copyrightStrikes: 0, contentIdEnabled: true, status: "active", joinedDate: "2022-08-12", permissions: { viewRevenue: true, setMatchPolicy: false, monetizeUploads: false } },
  { id: "UC008", name: "New Artist Channel", customUrl: "@newartist", thumbnail: "", subscribers: "12K", views: "2.3M", videos: 15, monetized: false, copyrightStrikes: 0, contentIdEnabled: false, status: "pending", joinedDate: "2024-12-01", permissions: { viewRevenue: false, setMatchPolicy: false, monetizeUploads: false } },
];

type ModalType = "create" | "invite" | "link" | null;

export default function CmsChannelsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [modalType, setModalType] = useState<ModalType>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredChannels = mockChannels.filter((ch) => {
    const matchesSearch = ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ch.customUrl.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || ch.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = mockChannels.filter(c => c.status === "active").length;
  const pendingCount = mockChannels.filter(c => c.status === "pending").length;
  const notMonetizing = mockChannels.filter(c => !c.monetized).length;
  const withStrikes = mockChannels.filter(c => c.copyrightStrikes > 0).length;

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-normal text-[#282828]">Channels</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalType("create")}
            className="flex items-center gap-2 px-4 py-2 bg-[#065FD4] text-white text-sm font-medium rounded-lg hover:bg-[#0548a6] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create channel
          </button>
          <button
            onClick={() => setModalType("invite")}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium text-[#282828] rounded-lg hover:bg-[#f9f9f9] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite channel
          </button>
          <button
            onClick={() => setModalType("link")}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium text-[#282828] rounded-lg hover:bg-[#f9f9f9] transition-colors"
          >
            <Link2 className="w-4 h-4" />
            Link existing
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-[#e5e5e5] p-4">
          <p className="text-2xl font-semibold text-[#282828]">{activeCount}</p>
          <p className="text-xs text-[#606060] mt-1">Active channels</p>
        </div>
        <div className="bg-white rounded-lg border border-[#e5e5e5] p-4">
          <p className="text-2xl font-semibold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-[#606060] mt-1">Pending invites</p>
        </div>
        <div className="bg-white rounded-lg border border-[#e5e5e5] p-4">
          <p className="text-2xl font-semibold text-orange-600">{notMonetizing}</p>
          <p className="text-xs text-[#606060] mt-1">Not monetizing</p>
        </div>
        <div className="bg-white rounded-lg border border-[#e5e5e5] p-4">
          <p className="text-2xl font-semibold text-red-600">{withStrikes}</p>
          <p className="text-xs text-[#606060] mt-1">Copyright strikes</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] mb-4">
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center bg-[#f2f2f2] rounded-lg flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#909090] ml-3" />
            <input
              type="text"
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-[#606060]"
          >
            <option value="all">All channels</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
          <div className="flex-1" />
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Channel list */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e5e5e5] bg-[#f9f9f9]">
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Channel</th>
              <th className="text-right text-xs font-medium text-[#606060] uppercase px-4 py-3">Subscribers</th>
              <th className="text-right text-xs font-medium text-[#606060] uppercase px-4 py-3">Views</th>
              <th className="text-right text-xs font-medium text-[#606060] uppercase px-4 py-3">Videos</th>
              <th className="text-center text-xs font-medium text-[#606060] uppercase px-4 py-3">Monetization</th>
              <th className="text-center text-xs font-medium text-[#606060] uppercase px-4 py-3">Content ID</th>
              <th className="text-center text-xs font-medium text-[#606060] uppercase px-4 py-3">Strikes</th>
              <th className="text-center text-xs font-medium text-[#606060] uppercase px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Permissions</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredChannels.map((channel) => (
              <tr key={channel.id} className="border-b border-[#e5e5e5] hover:bg-[#f9f9f9] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                      <Radio className="w-5 h-5 text-[#909090]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#282828]">{channel.name}</p>
                      <p className="text-xs text-[#606060]">{channel.customUrl}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[#606060] text-right">{channel.subscribers}</td>
                <td className="px-4 py-3 text-sm text-[#606060] text-right">{channel.views}</td>
                <td className="px-4 py-3 text-sm text-[#606060] text-right">{channel.videos}</td>
                <td className="px-4 py-3 text-center">
                  {channel.monetized ? (
                    <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[#909090] mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {channel.contentIdEnabled ? (
                    <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[#909090] mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {channel.copyrightStrikes > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                      <AlertTriangle className="w-3 h-3" /> {channel.copyrightStrikes}
                    </span>
                  ) : (
                    <span className="text-xs text-[#909090]">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    channel.status === "active" ? "bg-green-50 text-green-600" :
                    channel.status === "pending" ? "bg-yellow-50 text-yellow-600" :
                    "bg-red-50 text-red-600"
                  }`}>
                    {channel.status.charAt(0).toUpperCase() + channel.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {channel.permissions.viewRevenue && <span className="text-[10px] bg-[#def1ff] text-[#065FD4] px-1.5 py-0.5 rounded" title="View Revenue">Rev</span>}
                    {channel.permissions.setMatchPolicy && <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded" title="Match Policy">MP</span>}
                    {channel.permissions.monetizeUploads && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded" title="Monetize">Mon</span>}
                  </div>
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

      {/* Modals */}
      {modalType && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setModalType(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {modalType === "create" && (
              <>
                <h2 className="text-lg font-medium text-[#282828] mb-4">Create new channel</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#282828] mb-1">Channel name</label>
                    <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Enter channel name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#282828] mb-1">Description</label>
                    <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Channel description" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[#282828]">Permissions</label>
                    <label className="flex items-center gap-2 text-sm text-[#606060]">
                      <input type="checkbox" className="rounded border-gray-300" /> View revenue
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[#606060]">
                      <input type="checkbox" className="rounded border-gray-300" /> Set match policy
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[#606060]">
                      <input type="checkbox" className="rounded border-gray-300" /> Monetize uploads
                    </label>
                  </div>
                </div>
              </>
            )}
            {modalType === "invite" && (
              <>
                <h2 className="text-lg font-medium text-[#282828] mb-4">Invite channel</h2>
                <p className="text-sm text-[#606060] mb-4">Send an invitation to an existing YouTube channel to join your Content Manager.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#282828] mb-1">Channel URL or ID</label>
                    <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="https://youtube.com/@channel or UC..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#282828] mb-1">Invitation message (optional)</label>
                    <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Add a personal message to the invitation" />
                  </div>
                </div>
              </>
            )}
            {modalType === "link" && (
              <>
                <h2 className="text-lg font-medium text-[#282828] mb-4">Link existing channel</h2>
                <p className="text-sm text-[#606060] mb-4">Link a channel you already own to this Content Manager.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#282828] mb-1">Channel URL or ID</label>
                    <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="https://youtube.com/@channel or UC..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#282828] mb-1">Verification</label>
                    <p className="text-xs text-[#606060]">You must be an owner of this channel to link it. Verification will be sent to the channel email.</p>
                  </div>
                </div>
              </>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModalType(null)} className="px-4 py-2 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">
                Cancel
              </button>
              <button className="px-4 py-2 text-sm text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">
                {modalType === "create" ? "Create channel" : modalType === "invite" ? "Send invite" : "Link channel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
