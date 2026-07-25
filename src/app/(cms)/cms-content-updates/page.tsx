"use client";

import { useState } from "react";
import { Upload, Download, FileText, Package, CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle, MoreVertical, FolderOpen } from "lucide-react";

type PackageStatus = "completed" | "processing" | "failed" | "validating";

interface ContentPackage {
  id: string;
  name: string;
  type: "spreadsheet" | "ddex" | "media";
  assets: number;
  status: PackageStatus;
  uploadedBy: string;
  uploadDate: string;
  errors: number;
  warnings: number;
}

interface BulkAction {
  id: string;
  action: string;
  scope: string;
  itemsAffected: number;
  status: "completed" | "in_progress" | "failed";
  executedBy: string;
  executedDate: string;
}

const mockPackages: ContentPackage[] = [
  { id: "PK1", name: "Punjabi_Hits_2024.csv", type: "spreadsheet", assets: 25, status: "completed", uploadedBy: "Admin", uploadDate: "2024-12-20", errors: 0, warnings: 2 },
  { id: "PK2", name: "New_Releases_Jan.csv", type: "spreadsheet", assets: 10, status: "processing", uploadedBy: "Manager", uploadDate: "2024-12-22", errors: 0, warnings: 0 },
  { id: "PK3", name: "Classical_Archive_Update.ddex", type: "ddex", assets: 60, status: "completed", uploadedBy: "Admin", uploadDate: "2024-12-15", errors: 0, warnings: 5 },
  { id: "PK4", name: "Remix_Collection_v2.csv", type: "spreadsheet", assets: 15, status: "failed", uploadedBy: "Editor", uploadDate: "2024-12-18", errors: 3, warnings: 0 },
  { id: "PK5", name: "Bainsla_Exclusives.csv", type: "spreadsheet", assets: 8, status: "validating", uploadedBy: "Admin", uploadDate: "2024-12-23", errors: 0, warnings: 0 },
];

const mockBulkActions: BulkAction[] = [
  { id: "BA1", action: "Update ownership", scope: "Assets", itemsAffected: 45, status: "completed", executedBy: "Admin", executedDate: "2024-12-20" },
  { id: "BA2", action: "Apply match policy", scope: "Assets", itemsAffected: 120, status: "completed", executedBy: "Admin", executedDate: "2024-12-19" },
  { id: "BA3", action: "Release claims", scope: "Claimed videos", itemsAffected: 15, status: "completed", executedBy: "Manager", executedDate: "2024-12-18" },
  { id: "BA4", action: "Update channel permissions", scope: "Channels", itemsAffected: 3, status: "in_progress", executedBy: "Admin", executedDate: "2024-12-23" },
];

function getPackageStatusBadge(status: PackageStatus) {
  switch (status) {
    case "completed": return <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3" /> Completed</span>;
    case "processing": return <span className="flex items-center gap-1 text-xs text-[#065FD4]"><RefreshCw className="w-3 h-3 animate-spin" /> Processing</span>;
    case "failed": return <span className="flex items-center gap-1 text-xs text-red-600"><XCircle className="w-3 h-3" /> Failed</span>;
    case "validating": return <span className="flex items-center gap-1 text-xs text-yellow-600"><Clock className="w-3 h-3" /> Validating</span>;
  }
}

export default function CmsContentUpdatesPage() {
  const [activeTab, setActiveTab] = useState<"packages" | "bulk-actions" | "templates">("packages");
  const [showUploadModal, setShowUploadModal] = useState(false);

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-normal text-[#282828]">Content Updates</h1>
        <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#065FD4] text-white text-sm font-medium rounded-lg hover:bg-[#0548a6]">
          <Upload className="w-4 h-4" /> Upload package
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-[#e5e5e5] mb-6">
        {([
          { value: "packages" as const, label: "My packages" },
          { value: "bulk-actions" as const, label: "Bulk actions" },
          { value: "templates" as const, label: "Templates" },
        ]).map(tab => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.value ? "border-[#282828] text-[#065FD4]" : "border-transparent text-[#606060] hover:text-[#282828]"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Packages Tab */}
      {activeTab === "packages" && (
        <div className="bg-white rounded-lg border border-[#e5e5e5] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#f9f9f9]">
                <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Package</th>
                <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Type</th>
                <th className="text-right text-xs font-medium text-[#606060] uppercase px-4 py-3">Assets</th>
                <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Issues</th>
                <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Uploaded by</th>
                <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Date</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {mockPackages.map(pkg => (
                <tr key={pkg.id} className="border-b border-[#e5e5e5] hover:bg-[#f9f9f9]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#909090]" />
                      <span className="text-sm font-medium text-[#282828]">{pkg.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#606060] capitalize">{pkg.type}</td>
                  <td className="px-4 py-3 text-sm text-[#606060] text-right">{pkg.assets}</td>
                  <td className="px-4 py-3">{getPackageStatusBadge(pkg.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {pkg.errors > 0 && <span className="text-xs text-red-600">{pkg.errors} errors</span>}
                      {pkg.warnings > 0 && <span className="text-xs text-yellow-600">{pkg.warnings} warnings</span>}
                      {pkg.errors === 0 && pkg.warnings === 0 && <span className="text-xs text-[#909090]">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#606060]">{pkg.uploadedBy}</td>
                  <td className="px-4 py-3 text-sm text-[#606060]">{pkg.uploadDate}</td>
                  <td className="px-4 py-3"><button className="p-1 hover:bg-[#f2f2f2] rounded"><MoreVertical className="w-4 h-4 text-[#909090]" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Actions Tab */}
      {activeTab === "bulk-actions" && (
        <div className="bg-white rounded-lg border border-[#e5e5e5] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#f9f9f9]">
                <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Action</th>
                <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Scope</th>
                <th className="text-right text-xs font-medium text-[#606060] uppercase px-4 py-3">Items</th>
                <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Executed by</th>
                <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {mockBulkActions.map(action => (
                <tr key={action.id} className="border-b border-[#e5e5e5] hover:bg-[#f9f9f9]">
                  <td className="px-4 py-3 text-sm font-medium text-[#282828]">{action.action}</td>
                  <td className="px-4 py-3 text-sm text-[#606060]">{action.scope}</td>
                  <td className="px-4 py-3 text-sm text-[#606060] text-right">{action.itemsAffected}</td>
                  <td className="px-4 py-3">
                    {action.status === "completed" && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3" /> Completed</span>}
                    {action.status === "in_progress" && <span className="flex items-center gap-1 text-xs text-[#065FD4]"><RefreshCw className="w-3 h-3 animate-spin" /> In progress</span>}
                    {action.status === "failed" && <span className="flex items-center gap-1 text-xs text-red-600"><XCircle className="w-3 h-3" /> Failed</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#606060]">{action.executedBy}</td>
                  <td className="px-4 py-3 text-sm text-[#606060]">{action.executedDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: "Sound Recording Template", desc: "CSV template for uploading sound recordings", format: "CSV" },
            { name: "Music Video Template", desc: "CSV template for uploading music videos", format: "CSV" },
            { name: "Composition Template", desc: "CSV template for uploading compositions", format: "CSV" },
            { name: "Asset Update Template", desc: "CSV template for bulk updating asset metadata", format: "CSV" },
            { name: "Ownership Template", desc: "CSV template for updating ownership data", format: "CSV" },
            { name: "DDEX Template", desc: "DDEX format template for bulk delivery", format: "DDEX" },
          ].map(t => (
            <div key={t.name} className="bg-white rounded-lg border border-[#e5e5e5] p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-medium text-[#282828]">{t.name}</h3>
              </div>
              <p className="text-xs text-[#606060] mb-4">{t.desc}</p>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#065FD4] border border-blue-200 rounded-lg hover:bg-[#def1ff]">
                <Download className="w-3 h-3" /> Download {t.format}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowUploadModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-[#282828] mb-4">Upload content package</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
              <Upload className="w-10 h-10 text-[#909090] mx-auto mb-3" />
              <p className="text-sm text-[#606060] mb-1">Drag and drop files here</p>
              <p className="text-xs text-[#909090] mb-3">or</p>
              <button className="px-4 py-2 text-sm text-[#065FD4] border border-blue-200 rounded-lg hover:bg-[#def1ff]">Select files</button>
              <p className="text-xs text-[#909090] mt-3">Upload a metadata file (CSV or DDEX) along with media files</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">Cancel</button>
              <button className="px-4 py-2 text-sm text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">Process package</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
