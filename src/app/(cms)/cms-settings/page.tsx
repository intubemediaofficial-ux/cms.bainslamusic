"use client";

import { useState } from "react";
import {
  Settings, Users, Bell, Shield, Globe, Key, UserPlus, Trash2, Edit3, MoreVertical, Plus, CheckCircle, Mail, Link2,
} from "lucide-react";

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "pending";
  addedDate: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  usersCount: number;
  permissions: string[];
}

const mockUsers: UserAccount[] = [
  { id: "U1", name: "Vijendra Choudhary", email: "vijendra@bainsla.com", role: "Administrator", status: "active", addedDate: "2024-01-01" },
  { id: "U2", name: "Rahul Singh", email: "rahul@bainsla.com", role: "Asset Manager", status: "active", addedDate: "2024-03-15" },
  { id: "U3", name: "Priya Sharma", email: "priya@bainsla.com", role: "Rights Manager", status: "active", addedDate: "2024-05-20" },
  { id: "U4", name: "Amit Kumar", email: "amit@bainsla.com", role: "Analyst", status: "active", addedDate: "2024-07-10" },
  { id: "U5", name: "New Intern", email: "intern@bainsla.com", role: "Channel Manager", status: "pending", addedDate: "2024-12-20" },
];

const mockRoles: Role[] = [
  { id: "R1", name: "Administrator", description: "Full access to all Content Manager features", usersCount: 1, permissions: ["Manage users", "Edit settings", "Manage assets", "Manage claims", "View analytics", "Manage channels"] },
  { id: "R2", name: "Asset Manager", description: "Create, edit, and manage assets and references", usersCount: 1, permissions: ["Manage assets", "Create references", "Edit metadata", "View claims"] },
  { id: "R3", name: "Rights Manager", description: "Manage claims, disputes, and policies", usersCount: 1, permissions: ["Manage claims", "Review disputes", "Edit policies", "Manage ownership"] },
  { id: "R4", name: "Analyst", description: "View analytics, reports, and revenue data", usersCount: 1, permissions: ["View analytics", "Download reports", "View revenue"] },
  { id: "R5", name: "Channel Manager", description: "Manage linked channels and their settings", usersCount: 1, permissions: ["Manage channels", "Edit permissions", "View channel metrics"] },
];

type SettingsTab = "general" | "permissions" | "notifications" | "content-id" | "adsense";

export default function CmsSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-normal text-[#282828]">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-[#e5e5e5] mb-6">
        {([
          { value: "general" as const, label: "General", icon: Settings },
          { value: "permissions" as const, label: "Permissions", icon: Users },
          { value: "notifications" as const, label: "Notifications", icon: Bell },
          { value: "content-id" as const, label: "Content ID", icon: Shield },
          { value: "adsense" as const, label: "AdSense", icon: Link2 },
        ]).map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === tab.value ? "border-[#282828] text-[#065FD4]" : "border-transparent text-[#606060] hover:text-[#282828]"}`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === "general" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-[#e5e5e5] p-6">
            <h3 className="text-sm font-medium text-[#282828] mb-4">Account Information</h3>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Content Manager name</label>
                <input type="text" defaultValue="YouTube Studio" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Contact email</label>
                <input type="email" defaultValue="" placeholder="admin@example.com" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#e5e5e5] p-6">
            <h3 className="text-sm font-medium text-[#282828] mb-4">User Preferences</h3>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Currency</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option>USD - US Dollar</option>
                  <option>INR - Indian Rupee</option>
                  <option>EUR - Euro</option>
                  <option>GBP - British Pound</option>
                  <option>CAD - Canadian Dollar</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Language</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option>English</option>
                  <option>Hindi</option>
                  <option>Urdu</option>
                  <option>Punjabi</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Timezone</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option>Asia/Kolkata (IST)</option>
                  <option>America/New_York (EST)</option>
                  <option>Europe/London (GMT)</option>
                  <option>America/Los_Angeles (PST)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#e5e5e5] p-6">
            <h3 className="text-sm font-medium text-[#282828] mb-4">Embedding & Attribution</h3>
            <div className="space-y-3 max-w-lg">
              <label className="flex items-center gap-3 text-sm text-[#606060]">
                <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                Allow embedding on external websites
              </label>
              <label className="flex items-center gap-3 text-sm text-[#606060]">
                <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                Show attribution in descriptions
              </label>
              <label className="flex items-center gap-3 text-sm text-[#606060]">
                <input type="checkbox" className="rounded border-gray-300" />
                Restrict embedding to allowlisted domains only
              </label>
            </div>
          </div>

          <button className="px-4 py-2 text-sm text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">Save changes</button>
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === "permissions" && (
        <div className="space-y-6">
          {/* Users section */}
          <div className="bg-white rounded-lg border border-[#e5e5e5]">
            <div className="px-6 py-4 border-b border-[#e5e5e5] flex items-center justify-between">
              <h3 className="text-sm font-medium text-[#282828]">Users ({mockUsers.length})</h3>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-xs font-medium text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">Export</button>
                <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">
                  <UserPlus className="w-3.5 h-3.5" /> Invite user
                </button>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e5e5e5] bg-[#f9f9f9]">
                  <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">User</th>
                  <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-[#606060] uppercase px-4 py-3">Added</th>
                  <th className="w-20 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {mockUsers.map(user => (
                  <tr key={user.id} className="border-b border-[#e5e5e5] hover:bg-[#f9f9f9]">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-[#282828]">{user.name}</p>
                        <p className="text-xs text-[#606060]">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select defaultValue={user.role} className="text-sm border border-[#e5e5e5] rounded px-2 py-1 bg-white">
                        {mockRoles.map(r => <option key={r.id}>{r.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${user.status === "active" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#606060]">{user.addedDate}</td>
                    <td className="px-4 py-3">
                      <button className="p-1 hover:bg-[#f2f2f2] rounded"><MoreVertical className="w-4 h-4 text-[#909090]" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Roles section */}
          <div className="bg-white rounded-lg border border-[#e5e5e5]">
            <div className="px-6 py-4 border-b border-[#e5e5e5] flex items-center justify-between">
              <h3 className="text-sm font-medium text-[#282828]">Roles</h3>
              <button onClick={() => setShowCreateRoleModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#065FD4] border border-blue-200 rounded-lg hover:bg-[#def1ff]">
                <Plus className="w-3.5 h-3.5" /> Create role
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {mockRoles.map(role => (
                <div key={role.id} className="px-6 py-4 hover:bg-[#f9f9f9]">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-[#282828]">{role.name}</h4>
                        <span className="text-xs text-[#909090]">{role.usersCount} user(s)</span>
                      </div>
                      <p className="text-xs text-[#606060] mb-2">{role.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {role.permissions.map(p => (
                          <span key={p} className="px-2 py-0.5 text-[10px] bg-[#f2f2f2] text-[#606060] rounded-full">{p}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="p-1 hover:bg-[#f2f2f2] rounded"><Edit3 className="w-4 h-4 text-[#909090]" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="bg-white rounded-lg border border-[#e5e5e5] p-6">
          <h3 className="text-sm font-medium text-[#282828] mb-4">Email Notification Preferences</h3>
          <div className="space-y-4 max-w-lg">
            {[
              { label: "Claim alerts", desc: "Notify when new claims are created or disputed", defaultChecked: true },
              { label: "Ownership conflict alerts", desc: "Notify when ownership conflicts arise", defaultChecked: true },
              { label: "Channel alerts", desc: "Notify about channel status changes and copyright strikes", defaultChecked: true },
              { label: "Reference issues", desc: "Notify about invalid references and overlaps", defaultChecked: true },
              { label: "Revenue reports", desc: "Weekly/monthly revenue report notifications", defaultChecked: true },
              { label: "Content updates", desc: "Notify when content packages finish processing", defaultChecked: false },
              { label: "Campaign alerts", desc: "Notify about campaign start/end dates", defaultChecked: false },
              { label: "Policy changes", desc: "Notify when policies are modified", defaultChecked: false },
            ].map(n => (
              <label key={n.label} className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked={n.defaultChecked} className="rounded border-gray-300 mt-0.5" />
                <div>
                  <span className="text-sm text-[#282828] font-medium">{n.label}</span>
                  <p className="text-xs text-[#606060]">{n.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <button className="mt-6 px-4 py-2 text-sm text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">Save preferences</button>
        </div>
      )}

      {/* Content ID Tab */}
      {activeTab === "content-id" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-[#e5e5e5] p-6">
            <h3 className="text-sm font-medium text-[#282828] mb-4">Default Match Policy</h3>
            <div className="space-y-3 max-w-lg">
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option>Monetize — Earn revenue from matching videos</option>
                <option>Track — Only track matching videos</option>
                <option>Block — Block matching videos from being viewed</option>
              </select>
              <p className="text-xs text-[#606060]">This policy will be applied as the default when Content ID matching is enabled for new videos.</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-[#e5e5e5] p-6">
            <h3 className="text-sm font-medium text-[#282828] mb-4">Reference Settings</h3>
            <div className="space-y-3 max-w-lg">
              <label className="flex items-center gap-3 text-sm text-[#606060]">
                <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                Auto-create references for new uploads
              </label>
              <label className="flex items-center gap-3 text-sm text-[#606060]">
                <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                Route short matches to manual review
              </label>
              <label className="flex items-center gap-3 text-sm text-[#606060]">
                <input type="checkbox" className="rounded border-gray-300" />
                Auto-release claims on allowlisted channels
              </label>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-[#e5e5e5] p-6">
            <h3 className="text-sm font-medium text-[#282828] mb-4">Claim Routing</h3>
            <div className="space-y-3 max-w-lg">
              <label className="flex items-center gap-3 text-sm text-[#606060]">
                <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                Route potential claims to manual review
              </label>
              <label className="flex items-center gap-3 text-sm text-[#606060]">
                <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                Auto-reinstate claims after dispute rejection
              </label>
            </div>
          </div>
          <button className="px-4 py-2 text-sm text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">Save settings</button>
        </div>
      )}

      {/* AdSense Tab */}
      {activeTab === "adsense" && (
        <div className="bg-white rounded-lg border border-[#e5e5e5] p-6">
          <h3 className="text-sm font-medium text-[#282828] mb-4">AdSense for YouTube</h3>
          <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg mb-4 max-w-lg">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">AdSense account connected</p>
              <p className="text-xs text-green-600">pub-1234567890 • Last payment: Dec 2024</p>
            </div>
          </div>
          <div className="space-y-3 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-[#282828] mb-1">Payout currency</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option>USD - US Dollar</option>
                <option>INR - Indian Rupee</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#282828] mb-1">Payment threshold</label>
              <input type="text" defaultValue="$100" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowInviteModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-[#282828] mb-4">Invite user</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Email address</label>
                <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="user@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Role</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {mockRoles.map(r => <option key={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowInviteModal(false)} className="px-4 py-2 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">Cancel</button>
              <button className="px-4 py-2 text-sm text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">Send invite</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {showCreateRoleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreateRoleModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-[#282828] mb-4">Create new role</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Role name</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Enter role name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-1">Description</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="What does this role do?" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#282828] mb-2">Permissions</label>
                <div className="space-y-2">
                  {["Manage users", "Edit settings", "Manage assets", "Create references", "Manage claims", "Review disputes", "Edit policies", "View analytics", "Download reports", "View revenue", "Manage channels", "Edit permissions", "Manage ownership"].map(p => (
                    <label key={p} className="flex items-center gap-2 text-sm text-[#606060]">
                      <input type="checkbox" className="rounded border-gray-300" /> {p}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateRoleModal(false)} className="px-4 py-2 text-sm text-[#606060] border border-gray-300 rounded-lg hover:bg-[#f9f9f9]">Cancel</button>
              <button className="px-4 py-2 text-sm text-white bg-[#065FD4] rounded-lg hover:bg-[#0548a6]">Create role</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
