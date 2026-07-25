"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Video,
  Package,
  Tags,
  AlertTriangle,
  Radio,
  FileVideo,
  Shield,
  BarChart3,
  Target,
  CheckCircle,
  FileText,
  Upload,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InTubeMediaMark } from "@/components/branding/InTubeMediaMark";
import { YouTubeAttribution } from "@/components/branding/YouTubeAttribution";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const navItems: NavItem[] = [
  { href: "/cms-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cms-videos", label: "Videos", icon: Video },
  { href: "/cms-assets", label: "Assets", icon: Package },
  { href: "/cms-asset-labels", label: "Asset labels", icon: Tags },
  { href: "/cms-issues", label: "Issues", icon: AlertTriangle },
  { href: "/cms-channels", label: "Channels", icon: Radio },
  { href: "/cms-claimed-videos", label: "Claimed videos", icon: FileVideo },
  { href: "/cms-policies", label: "Policies", icon: Shield },
  { href: "/cms-analytics", label: "Analytics", icon: BarChart3 },
  { href: "/cms-campaigns", label: "Campaigns", icon: Target },
  { href: "/cms-allowlist", label: "Allowlist", icon: CheckCircle },
  { href: "/cms-reports", label: "Reports", icon: FileText },
  { href: "/cms-content-updates", label: "Content Updates", icon: Upload },
  { href: "/cms-settings", label: "Settings", icon: Settings },
];

export default function CmsSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-white flex flex-col transition-all duration-200 z-40",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* InTubeMedia Header */}
      <div className="h-[56px] flex items-center px-3 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Menu className="w-6 h-6 text-[#606060]" />
        </button>
        {!collapsed && (
          <Link href="/cms-dashboard" className="flex items-center gap-2 ml-3">
            <InTubeMediaMark className="w-7 h-7 rounded-lg" textClassName="text-[8px]" />
            <span className="text-sm font-bold text-slate-900">InTubeMedia CMS</span>
          </Link>
        )}
      </div>

      <div className={cn("flex flex-col items-center py-4 px-3", collapsed && "py-3")}>
        <InTubeMediaMark
          className={cn(collapsed ? "w-8 h-8" : "w-[72px] h-[72px] rounded-2xl")}
          textClassName={collapsed ? "text-[9px]" : "text-xl"}
        />
        {!collapsed && (
          <p className="mt-3 text-[14px] font-medium text-slate-800">Content operations</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pb-2">
        <ul>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center h-10 text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-[#f2f2f2] text-[#282828]"
                      : "text-[#606060] hover:bg-[#f2f2f2]",
                    collapsed ? "justify-center mx-1 rounded-lg px-0" : "pl-6 pr-4"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className={cn(
                    "w-5 h-5 shrink-0",
                    isActive ? "text-[#282828]" : "text-[#606060]"
                  )} strokeWidth={1.5} />
                  {!collapsed && <span className="ml-6">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {!collapsed && (
        <div className="border-t border-gray-200 px-4 py-3">
          <YouTubeAttribution className="justify-center" />
        </div>
      )}

      {/* Collapse toggle at bottom */}
      <div className="py-2 shrink-0">
        {!collapsed ? (
          <button
            onClick={() => setCollapsed(true)}
            className="flex items-center h-10 pl-6 pr-4 text-[13px] text-[#606060] hover:bg-[#f2f2f2] transition-colors w-full"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            <span className="ml-6">Collapse</span>
          </button>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => setCollapsed(false)}
              className="p-2 hover:bg-[#f2f2f2] rounded-full transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-[#606060]" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
