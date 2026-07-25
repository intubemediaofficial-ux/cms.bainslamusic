"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  AlertTriangle,
  FileVideo,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
} from "lucide-react";

type IssueType = "reference-overlaps" | "invalid-references" | "ownership-conflicts" | "ownership-transfers" | "potential-claims" | "disputed-claims" | "appealed-claims";

interface Issue {
  id: string;
  type: IssueType;
  title: string;
  asset: string;
  description: string;
  status: "open" | "in_review" | "resolved";
  priority: "high" | "medium" | "low";
  createdDate: string;
  updatedDate: string;
}

const issueTypeCounts: { type: IssueType; label: string; count: number }[] = [
  { type: "reference-overlaps", label: "Reference overlaps", count: 0 },
  { type: "invalid-references", label: "Invalid references", count: 0 },
  { type: "ownership-conflicts", label: "Ownership conflicts", count: 2 },
  { type: "ownership-transfers", label: "Ownership transfers", count: 1 },
  { type: "potential-claims", label: "Potential claims", count: 5 },
  { type: "disputed-claims", label: "Disputed claims", count: 3 },
  { type: "appealed-claims", label: "Appealed claims", count: 1 },
];

const mockIssues: Issue[] = [
  { id: "I001", type: "potential-claims", title: "Potential claim on \"Tere Bina Remix\"", asset: "Tere Bina", description: "A user-uploaded video matches your asset's reference. Manual review required.", status: "open", priority: "high", createdDate: "2024-12-20", updatedDate: "2024-12-20" },
  { id: "I002", type: "potential-claims", title: "Potential claim on \"Sada Punjab Cover\"", asset: "Sada Punjab", description: "Short match detected — video is 45 seconds.", status: "open", priority: "medium", createdDate: "2024-12-18", updatedDate: "2024-12-19" },
  { id: "I003", type: "disputed-claims", title: "Dispute on \"Nachdi Jawani\" by user @music_fan", asset: "Nachdi Jawani", description: "Uploader claims fair use — educational content.", status: "in_review", priority: "high", createdDate: "2024-12-15", updatedDate: "2024-12-17" },
  { id: "I004", type: "ownership-conflicts", title: "Ownership conflict — \"Dil Da Mamla\"", asset: "Dil Da Mamla", description: "Another content owner has claimed 100% ownership for IN territory.", status: "open", priority: "high", createdDate: "2024-12-10", updatedDate: "2024-12-14" },
  { id: "I005", type: "ownership-transfers", title: "Transfer request for \"Punjab Di Shan\"", asset: "Punjab Di Shan", description: "Ownership transfer requested from Desi Beats to Bainsla Music.", status: "open", priority: "medium", createdDate: "2024-12-08", updatedDate: "2024-12-08" },
  { id: "I006", type: "disputed-claims", title: "Dispute on \"Ishq Tera\" by @bollywood_daily", asset: "Ishq Tera", description: "Uploader claims they have a license.", status: "open", priority: "medium", createdDate: "2024-12-05", updatedDate: "2024-12-06" },
  { id: "I007", type: "potential-claims", title: "Potential claim — background music match", asset: "Tere Bina", description: "Audio match in a 2-hour podcast episode.", status: "open", priority: "low", createdDate: "2024-12-03", updatedDate: "2024-12-03" },
  { id: "I008", type: "appealed-claims", title: "Appeal on reinstated claim — \"Nachdi Jawani\"", asset: "Nachdi Jawani", description: "User has appealed after dispute was rejected.", status: "in_review", priority: "high", createdDate: "2024-12-01", updatedDate: "2024-12-02" },
  { id: "I009", type: "potential-claims", title: "Potential claim — \"Sada Punjab\" Instagram reel", asset: "Sada Punjab", description: "Matched content in YouTube Shorts.", status: "open", priority: "low", createdDate: "2024-11-28", updatedDate: "2024-11-28" },
  { id: "I010", type: "ownership-conflicts", title: "Multi-owner conflict on \"Classical Raag\"", asset: "Classical Archive", description: "Three content owners claiming the same composition.", status: "open", priority: "high", createdDate: "2024-11-25", updatedDate: "2024-11-30" },
  { id: "I011", type: "disputed-claims", title: "Dispute — reaction video uses 30s of \"Ishq Tera\"", asset: "Ishq Tera", description: "Uploader argues transformative use.", status: "open", priority: "low", createdDate: "2024-11-22", updatedDate: "2024-11-23" },
  { id: "I012", type: "potential-claims", title: "Potential claim — wedding video background music", asset: "Tere Bina", description: "Low-confidence match in a wedding video.", status: "open", priority: "low", createdDate: "2024-11-20", updatedDate: "2024-11-20" },
];

function getPriorityBadge(priority: Issue["priority"]) {
  switch (priority) {
    case "high": return <span className="px-2 py-0.5 text-xs font-medium bg-red-50 text-red-600 rounded-full">High</span>;
    case "medium": return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-50 text-yellow-600 rounded-full">Medium</span>;
    case "low": return <span className="px-2 py-0.5 text-xs font-medium bg-[#f2f2f2] text-[#606060] rounded-full">Low</span>;
  }
}

function getStatusBadge(status: Issue["status"]) {
  switch (status) {
    case "open": return <span className="flex items-center gap-1 text-xs text-orange-600"><Clock className="w-3 h-3" /> Open</span>;
    case "in_review": return <span className="flex items-center gap-1 text-xs text-[#065FD4]"><RefreshCw className="w-3 h-3" /> In review</span>;
    case "resolved": return <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3" /> Resolved</span>;
  }
}

function getTypeLabel(type: IssueType): string {
  return issueTypeCounts.find(i => i.type === type)?.label || type;
}

export default function CmsIssuesPage() {
  const [activeType, setActiveType] = useState<IssueType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredIssues = mockIssues.filter((issue) => {
    const matchesType = activeType === "all" || issue.type === activeType;
    const matchesSearch = issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.asset.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || issue.status === statusFilter;
    return matchesType && matchesSearch && matchesStatus;
  });

  const totalIssues = issueTypeCounts.reduce((sum, i) => sum + i.count, 0);

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-normal text-[#282828]">Issues</h1>
        <span className="text-sm text-[#606060]">{totalIssues} issues requiring action</span>
      </div>

      {/* Issue type summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {issueTypeCounts.map((item) => (
          <button
            key={item.type}
            onClick={() => setActiveType(activeType === item.type ? "all" : item.type)}
            className={`bg-white rounded-lg border p-3 text-left transition-all ${
              activeType === item.type ? "border-blue-400 ring-1 ring-blue-200" : "border-[#e5e5e5] hover:border-gray-300"
            }`}
          >
            <p className={`text-xl font-semibold ${item.count > 0 ? "text-[#282828]" : "text-[#909090]"}`}>{item.count}</p>
            <p className="text-xs text-[#606060] mt-1 leading-tight">{item.label}</p>
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
              placeholder="Search issues..."
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
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_review">In review</option>
            <option value="resolved">Resolved</option>
          </select>
          {activeType !== "all" && (
            <button
              onClick={() => setActiveType("all")}
              className="text-sm text-[#065FD4] hover:text-[#065FD4]"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Issues list */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] overflow-hidden">
        {filteredIssues.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-200 mx-auto mb-3" />
            <p className="text-sm text-[#606060]">No issues found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredIssues.map((issue) => (
              <div key={issue.id} className="px-6 py-4 hover:bg-[#f9f9f9] transition-colors cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={`w-4 h-4 ${issue.priority === "high" ? "text-red-500" : issue.priority === "medium" ? "text-yellow-500" : "text-[#909090]"}`} />
                      <h3 className="text-sm font-medium text-[#282828]">{issue.title}</h3>
                    </div>
                    <p className="text-xs text-[#606060] ml-6 mb-2">{issue.description}</p>
                    <div className="flex items-center gap-3 ml-6">
                      <span className="text-xs text-[#909090] bg-[#f2f2f2] px-2 py-0.5 rounded">{getTypeLabel(issue.type)}</span>
                      {getPriorityBadge(issue.priority)}
                      {getStatusBadge(issue.status)}
                      <span className="text-xs text-[#909090]">Asset: {issue.asset}</span>
                      <span className="text-xs text-[#909090]">{issue.createdDate}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {issue.status === "open" && (
                      <>
                        <button className="px-3 py-1 text-xs font-medium text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">
                          Review
                        </button>
                        <button className="px-3 py-1 text-xs font-medium text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">
                          Release
                        </button>
                      </>
                    )}
                    <button className="p-1 hover:bg-[#f2f2f2] rounded">
                      <MoreVertical className="w-4 h-4 text-[#909090]" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
