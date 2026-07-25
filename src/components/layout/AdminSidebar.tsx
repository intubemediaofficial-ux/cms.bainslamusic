"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Radio,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Music2,
  Shield,
  FileText,
  Music,
  ShieldCheck,
} from "lucide-react";
import { signOut } from "next-auth/react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const navItems: NavItem[] = [
  { href: "/admin-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin-clients", label: "User Management", icon: Users },
  {
    href: "/admin-channels",
    label: "Channels",
    icon: Radio,
    children: [
      { href: "/admin-channels", label: "All Channels", icon: Radio },
    ],
  },
  {
    href: "/admin-reports",
    label: "Reports",
    icon: BarChart3,
    children: [
      { href: "/admin-reports", label: "Revenue Reports", icon: FileText },
    ],
  },
  { href: "/admin-distribution", label: "Music Distribution", icon: Music },
  { href: "/admin-claims", label: "Claim Release", icon: ShieldCheck },
  { href: "/admin-settings", label: "Settings", icon: Settings },
];

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  const toggleMenu = (href: string) => {
    setOpenMenus((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-all duration-300 z-30 flex flex-col ${
        collapsed ? "w-[70px]" : "w-[250px]"
      }`}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
        {!collapsed && (
          <Link href="/admin-dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-wide">InTubeMedia</span>
              <span className="block text-[10px] text-red-400 font-medium">ADMIN PANEL</span>
            </div>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center mx-auto">
            <Shield className="w-5 h-5 text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.children && item.children.some((c) => pathname === c.href));
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openMenus[item.href] || isActive;

            if (hasChildren) {
              return (
                <li key={item.href}>
                  <button
                    onClick={() => toggleMenu(item.href)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-red-500/20 text-red-400"
                        : "text-slate-300 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </>
                    )}
                  </button>
                  {!collapsed && isOpen && (
                    <ul className="ml-4 mt-1 space-y-1 border-l border-slate-700 pl-3">
                      {item.children!.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                              pathname === child.href
                                ? "text-red-400 bg-red-500/10"
                                : "text-slate-400 hover:text-white hover:bg-slate-700"
                            }`}
                          >
                            <child.icon className="w-4 h-4" />
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-red-500/20 text-red-400"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Client Panel Link */}
      <div className="px-3 pb-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <Music2 className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Client Panel →</span>}
        </Link>
      </div>

      <div className="p-3 border-t border-slate-700">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
