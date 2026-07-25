"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Video,
  Radio,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,


  Users,
  LinkIcon,
  Unlink,
  FileText,
  Shield,
  Music,
  ShieldCheck,
  Globe,
  CreditCard,
  MonitorPlay,
  MessageSquare,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InTubeMediaMark } from "@/components/branding/InTubeMediaMark";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const clientNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/channels",
    label: "Channels",
    icon: Radio,
    children: [
      { href: "/channels", label: "Active Channels", icon: LinkIcon },
      { href: "/delinked-channels", label: "Delinked Channels", icon: Unlink },
    ],
  },
  { href: "/videos", label: "Videos", icon: Video },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    children: [
      { href: "/reports/video-revenue", label: "Video Revenue", icon: FileText },
      { href: "/reports/channel-revenue", label: "Channel Revenue", icon: FileText },
      { href: "/reports/summary-channel", label: "Summary Channel", icon: FileText },
    ],
  },
  { href: "/vendors", label: "Vendor Management", icon: Users },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/music-distribution", label: "Music Distribution", icon: Music },
  { href: "/claim-release", label: "Claim Release", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/contact-admin", label: "Contact Admin", icon: MessageSquare },
];

const companyNavItems: NavItem[] = [
  { href: "/company-dashboard", label: "Company Dashboard", icon: Shield },
  { href: "/company-clients", label: "My Clients", icon: Users },
  { href: "/dashboard", label: "Channel Dashboard", icon: LayoutDashboard },
  {
    href: "/channels",
    label: "Channels",
    icon: Radio,
    children: [
      { href: "/channels", label: "Active Channels", icon: LinkIcon },
      { href: "/delinked-channels", label: "Delinked Channels", icon: Unlink },
    ],
  },
  { href: "/videos", label: "Videos", icon: Video },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    children: [
      { href: "/reports/video-revenue", label: "Video Revenue", icon: FileText },
      { href: "/reports/channel-revenue", label: "Channel Revenue", icon: FileText },
      { href: "/reports/summary-channel", label: "Summary Channel", icon: FileText },
    ],
  },
  { href: "/vendors", label: "Vendor Management", icon: Users },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminNavItems: NavItem[] = [
  { href: "/admin-dashboard", label: "Admin Dashboard", icon: Shield },
  { href: "/admin-clients", label: "User Management", icon: Users },
  { href: "/admin-networks", label: "Network Management", icon: Globe },
  { href: "/admin-vendors", label: "Vendor Management", icon: Users },
  { href: "/dashboard", label: "Network Dashboard", icon: LayoutDashboard },
  {
    href: "/admin-channels",
    label: "Channels",
    icon: Radio,
    children: [
      { href: "/admin-channels", label: "Active Channels", icon: LinkIcon },
      { href: "/delinked-channels", label: "Delinked Channels", icon: Unlink },
    ],
  },
  { href: "/admin-videos", label: "Videos & Claims", icon: Video },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    children: [
      { href: "/reports/video-revenue", label: "Video Revenue", icon: FileText },
      { href: "/reports/channel-revenue", label: "Channel Revenue", icon: FileText },
      { href: "/reports/summary-channel", label: "Summary Channel", icon: FileText },
    ],
  },
  { href: "/admin-payments", label: "Payments", icon: CreditCard },
  { href: "/admin-distribution", label: "Music Distribution", icon: Music },
  { href: "/admin-claims", label: "Claim Release", icon: ShieldCheck },
  { href: "/admin-audit-log", label: "Audit Log", icon: ClipboardList },
  { href: "/admin-settings", label: "Settings", icon: Settings },
  { href: "/cms-dashboard", label: "YouTube CMS", icon: MonitorPlay },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({ "/channels": true, "/admin-channels": true });
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const isCompany = session?.user?.role === "company";
  const navItems = isAdmin ? adminNavItems : isCompany ? companyNavItems : clientNavItems;

  const [branding, setBranding] = useState<{ brandName?: string; brandColor?: string; brandLogo?: string } | null>(null);
  useEffect(() => {
    if (!session?.user?.email || isAdmin) return;

    let active = true;
    const loadBranding = async () => {
      try {
        const response = await fetch("/api/users?action=branding", { cache: "no-store" });
        const json = await response.json();
        if (active && response.ok) setBranding(json.data || null);
      } catch {
        if (active) setBranding(null);
      }
    };
    const handleBrandingUpdate = (event: Event) => {
      const updated = (event as CustomEvent<{ brandName?: string; brandColor?: string; brandLogo?: string }>).detail;
      if (active) setBranding(updated || null);
    };

    loadBranding();
    window.addEventListener("branding-updated", handleBrandingUpdate);
    return () => {
      active = false;
      window.removeEventListener("branding-updated", handleBrandingUpdate);
    };
  }, [session?.user?.email, isAdmin]);

  const toggleMenu = (href: string) => {
    setOpenMenus((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar text-white flex flex-col transition-all duration-300 z-40",
        collapsed ? "w-[72px]" : "w-[250px]"
      )}
      style={branding?.brandColor ? { backgroundColor: branding.brandColor } : undefined}
    >
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        {branding?.brandLogo ? (
          <img src={branding.brandLogo} alt="" className="w-9 h-9 rounded-lg shrink-0 object-contain" />
        ) : (
          <InTubeMediaMark className="w-9 h-9" textClassName="text-[11px]" />
        )}
        {!collapsed && (
          <div className="overflow-hidden">
            {branding?.brandName ? (
              <h1 className="text-lg font-bold leading-tight text-white">{branding.brandName}</h1>
            ) : isAdmin ? (
              <>
                <h1 className="text-lg font-bold leading-tight text-white">InTube</h1>
                <p className="text-[10px] font-bold tracking-[0.25em] text-amber-400 uppercase">
                  Media
                </p>
              </>
            ) : isCompany ? (
              <>
                <h1 className="text-lg font-bold leading-tight text-white">InTube</h1>
                <p className="text-[10px] font-bold tracking-[0.25em] text-emerald-400 uppercase">
                  Company
                </p>
              </>
            ) : (
              <>
                <h1 className="text-lg font-bold leading-tight bg-gradient-to-r from-red-400 to-red-500 bg-clip-text text-transparent">InTube</h1>
                <p className="text-[10px] font-bold tracking-[0.25em] text-white/60 uppercase">
                  Media
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || item.children?.some((c) => pathname === c.href);
            const isOpen = openMenus[item.href];

            if (item.children && !collapsed) {
              return (
                <li key={item.href}>
                  <button
                    onClick={() => toggleMenu(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/20 text-white"
                        : "text-white/70 hover:text-white hover:bg-sidebar-hover"
                    )}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform",
                        isOpen ? "rotate-180" : ""
                      )}
                    />
                  </button>
                  {isOpen && (
                    <ul className="mt-1 ml-4 space-y-1 border-l border-white/10 pl-3">
                      {item.children.map((child) => {
                        const isChildActive = pathname === child.href;
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                                isChildActive
                                  ? "bg-primary text-white shadow-md shadow-primary/30"
                                  : "text-white/60 hover:text-white hover:bg-sidebar-hover"
                              )}
                            >
                              <child.icon className="w-4 h-4 shrink-0" />
                              <span>{child.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            }

            if (item.children && collapsed) {
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary text-white shadow-md shadow-primary/30"
                        : "text-white/70 hover:text-white hover:bg-sidebar-hover"
                    )}
                    title={item.label}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary text-white shadow-md shadow-primary/30"
                      : "text-white/70 hover:text-white hover:bg-sidebar-hover"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-3 pb-4 space-y-1">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-sidebar-hover transition-all"
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white shadow-md hover:bg-primary-dark transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
}
