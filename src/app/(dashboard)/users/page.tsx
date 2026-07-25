"use client";

import { Plus, MoreVertical, Shield, Edit, Trash2 } from "lucide-react";

const users = [
  {
    id: "1",
    name: "Bainsla Admin",
    email: "admin@bainslamusic.com",
    role: "Super Admin",
    status: "active",
    lastLogin: "2024-12-15 10:30 AM",
    avatar: "BA",
  },
  {
    id: "2",
    name: "Rahul Manager",
    email: "rahul@bainslamusic.com",
    role: "Manager",
    status: "active",
    lastLogin: "2024-12-14 02:15 PM",
    avatar: "RM",
  },
  {
    id: "3",
    name: "Priya Editor",
    email: "priya@bainslamusic.com",
    role: "Editor",
    status: "active",
    lastLogin: "2024-12-13 09:45 AM",
    avatar: "PE",
  },
  {
    id: "4",
    name: "Amit Viewer",
    email: "amit@bainslamusic.com",
    role: "Viewer",
    status: "inactive",
    lastLogin: "2024-11-20 04:00 PM",
    avatar: "AV",
  },
];

const roleColors: Record<string, string> = {
  "Super Admin": "bg-red-100 text-red-700",
  Manager: "bg-blue-100 text-blue-700",
  Editor: "bg-green-100 text-green-700",
  Viewer: "bg-slate-100 text-slate-700",
};

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted mt-1">
            Manage team members and their access permissions.
          </p>
        </div>
        <button className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-border p-5">
          <p className="text-sm text-muted">Total Users</p>
          <p className="text-2xl font-bold text-foreground mt-1">{users.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <p className="text-sm text-muted">Active Users</p>
          <p className="text-2xl font-bold text-success mt-1">
            {users.filter((u) => u.status === "active").length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <p className="text-sm text-muted">Admins</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {users.filter((u) => u.role === "Super Admin").length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <p className="text-sm text-muted">Inactive</p>
          <p className="text-2xl font-bold text-danger mt-1">
            {users.filter((u) => u.status === "inactive").length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-5">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                  User
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                  Role
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                  Last Login
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-border/50 hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-semibold">
                          {user.avatar}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {user.name}
                        </p>
                        <p className="text-xs text-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        roleColors[user.role] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted">
                    {user.lastLogin}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                        <Edit className="w-4 h-4 text-muted" />
                      </button>
                      <button className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4 text-danger" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
