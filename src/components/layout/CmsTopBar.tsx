"use client";

import { useState } from "react";
import { Search, HelpCircle, MessageSquare, User, Settings, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function CmsTopBar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="h-[56px] bg-white flex items-center justify-between px-4 sticky top-0 z-30">
      {/* Center - Search */}
      <div className="flex items-center flex-1 justify-center">
        <div className="relative w-full max-w-[536px]">
          <div className="flex items-center h-10 bg-[#f1f1f1] rounded-lg">
            <Search className="w-5 h-5 text-[#606060] ml-4 shrink-0" />
            <input
              type="text"
              placeholder="Search for your content"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent px-3 py-2 text-[14px] text-[#282828] placeholder-[#909090] outline-none font-['Roboto',sans-serif]"
            />
          </div>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5 ml-4">
        {/* Send feedback */}
        <button className="w-10 h-10 flex items-center justify-center hover:bg-[#f2f2f2] rounded-full transition-colors">
          <MessageSquare className="w-5 h-5 text-[#606060]" strokeWidth={1.5} />
        </button>
        {/* Help */}
        <button className="w-10 h-10 flex items-center justify-center hover:bg-[#f2f2f2] rounded-full transition-colors">
          <HelpCircle className="w-5 h-5 text-[#606060]" strokeWidth={1.5} />
        </button>

        {/* Profile avatar */}
        <div className="relative ml-2">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-8 h-8 bg-[#7B1FA2] rounded-full flex items-center justify-center text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            B
          </button>
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-10 w-[300px] bg-white rounded-xl shadow-[0_4px_32px_rgba(0,0,0,0.16)] border border-[#e5e5e5] z-50 overflow-hidden">
                <div className="p-4 border-b border-[#e5e5e5]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#7B1FA2] rounded-full flex items-center justify-center text-white text-base font-medium shrink-0">
                      B
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-[#282828] truncate">InTubeMedia</p>
                      <p className="text-[12px] text-[#606060] truncate">Content Manager</p>
                    </div>
                  </div>
                </div>
                <div className="py-2">
                  <button className="w-full flex items-center gap-4 px-4 py-2 text-[14px] text-[#282828] hover:bg-[#f2f2f2] transition-colors">
                    <User className="w-5 h-5 text-[#606060]" strokeWidth={1.5} />
                    Your channel
                  </button>
                  <button className="w-full flex items-center gap-4 px-4 py-2 text-[14px] text-[#282828] hover:bg-[#f2f2f2] transition-colors">
                    <Settings className="w-5 h-5 text-[#606060]" strokeWidth={1.5} />
                    Settings
                  </button>
                </div>
                <div className="border-t border-[#e5e5e5] py-2">
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full flex items-center gap-4 px-4 py-2 text-[14px] text-[#282828] hover:bg-[#f2f2f2] transition-colors"
                  >
                    <LogOut className="w-5 h-5 text-[#606060]" strokeWidth={1.5} />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
