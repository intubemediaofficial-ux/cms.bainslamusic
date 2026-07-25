"use client";

import { useState } from "react";
import { FileText, Download, Calendar, Clock, CheckCircle, RefreshCw, BarChart3, DollarSign, Video, Package, Shield, Target } from "lucide-react";

type ReportType = "revenue" | "videos" | "assets" | "references" | "claims" | "campaigns";
type ReportFrequency = "weekly" | "monthly";

interface Report {
  id: string;
  name: string;
  type: ReportType;
  frequency: ReportFrequency;
  period: string;
  status: "ready" | "processing" | "scheduled";
  size: string;
  generatedDate: string;
}

const mockReports: Report[] = [
  { id: "R1", name: "Revenue Report - December 2024", type: "revenue", frequency: "monthly", period: "Dec 2024", status: "ready", size: "2.3 MB", generatedDate: "2025-01-01" },
  { id: "R2", name: "Revenue Report - Week 51", type: "revenue", frequency: "weekly", period: "Dec 16-22, 2024", status: "ready", size: "1.1 MB", generatedDate: "2024-12-23" },
  { id: "R3", name: "Video Performance - December 2024", type: "videos", frequency: "monthly", period: "Dec 2024", status: "ready", size: "3.5 MB", generatedDate: "2025-01-01" },
  { id: "R4", name: "Asset Report - December 2024", type: "assets", frequency: "monthly", period: "Dec 2024", status: "processing", size: "—", generatedDate: "—" },
  { id: "R5", name: "Claims Report - December 2024", type: "claims", frequency: "monthly", period: "Dec 2024", status: "ready", size: "1.8 MB", generatedDate: "2025-01-01" },
  { id: "R6", name: "Reference Report - November 2024", type: "references", frequency: "monthly", period: "Nov 2024", status: "ready", size: "890 KB", generatedDate: "2024-12-01" },
  { id: "R7", name: "Campaign Report - Q4 2024", type: "campaigns", frequency: "monthly", period: "Oct-Dec 2024", status: "ready", size: "1.2 MB", generatedDate: "2025-01-02" },
  { id: "R8", name: "Revenue Report - Week 50", type: "revenue", frequency: "weekly", period: "Dec 9-15, 2024", status: "ready", size: "980 KB", generatedDate: "2024-12-16" },
];

function getTypeIcon(type: ReportType) {
  switch (type) {
    case "revenue": return <DollarSign className="w-4 h-4 text-green-500" />;
    case "videos": return <Video className="w-4 h-4 text-blue-500" />;
    case "assets": return <Package className="w-4 h-4 text-purple-500" />;
    case "references": return <FileText className="w-4 h-4 text-orange-500" />;
    case "claims": return <Shield className="w-4 h-4 text-red-500" />;
    case "campaigns": return <Target className="w-4 h-4 text-teal-500" />;
  }
}

function getStatusBadge(status: Report["status"]) {
  switch (status) {
    case "ready": return <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3" /> Ready</span>;
    case "processing": return <span className="flex items-center gap-1 text-xs text-[#065FD4]"><RefreshCw className="w-3 h-3 animate-spin" /> Processing</span>;
    case "scheduled": return <span className="flex items-center gap-1 text-xs text-[#606060]"><Clock className="w-3 h-3" /> Scheduled</span>;
  }
}

export default function CmsReportsPage() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("all");

  const filteredReports = mockReports.filter(r => {
    const matchesType = typeFilter === "all" || r.type === typeFilter;
    const matchesFreq = frequencyFilter === "all" || r.frequency === frequencyFilter;
    return matchesType && matchesFreq;
  });

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-normal text-[#282828]">Reports</h1>
      </div>

      {/* Report type filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {[
          { value: "all", label: "All reports" },
          { value: "revenue", label: "Revenue" },
          { value: "videos", label: "Videos" },
          { value: "assets", label: "Assets" },
          { value: "references", label: "References" },
          { value: "claims", label: "Claims" },
          { value: "campaigns", label: "Campaigns" },
        ].map(tab => (
          <button key={tab.value} onClick={() => setTypeFilter(tab.value)} className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${typeFilter === tab.value ? "bg-[#def1ff] border-blue-200 text-[#065FD4]" : "border-[#e5e5e5] text-[#606060] hover:bg-[#f9f9f9]"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Frequency filter */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-[#606060]">Frequency:</span>
        {["all", "weekly", "monthly"].map(f => (
          <button key={f} onClick={() => setFrequencyFilter(f)} className={`px-3 py-1 text-xs rounded-full border transition-colors capitalize ${frequencyFilter === f ? "bg-gray-800 border-gray-800 text-white" : "border-[#e5e5e5] text-[#606060] hover:bg-[#f9f9f9]"}`}>
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Reports table */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e5e5e5] bg-[#f9f9f9]">
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Report</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Type</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Period</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Frequency</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Size</th>
              <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Generated</th>
              <th className="w-20 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map(report => (
              <tr key={report.id} className="border-b border-[#e5e5e5] hover:bg-[#f9f9f9] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(report.type)}
                    <span className="text-sm font-medium text-[#282828]">{report.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[#606060] capitalize">{report.type}</td>
                <td className="px-4 py-3 text-sm text-[#606060]">{report.period}</td>
                <td className="px-4 py-3 text-sm text-[#606060] capitalize">{report.frequency}</td>
                <td className="px-4 py-3">{getStatusBadge(report.status)}</td>
                <td className="px-4 py-3 text-sm text-[#606060]">{report.size}</td>
                <td className="px-4 py-3 text-sm text-[#606060]">{report.generatedDate}</td>
                <td className="px-4 py-3">
                  {report.status === "ready" && (
                    <button className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-[#065FD4] border border-blue-200 rounded-lg hover:bg-[#def1ff]">
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
