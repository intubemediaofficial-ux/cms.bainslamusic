"use client";

import CmsSidebar from "@/components/layout/CmsSidebar";
import CmsTopBar from "@/components/layout/CmsTopBar";

export default function CmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Roboto font for YouTube Studio look */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
      `}</style>
      <div className="flex min-h-screen bg-white font-['Roboto',sans-serif]">
        <CmsSidebar />
        <div className="flex-1 ml-[240px] transition-all duration-200">
          <CmsTopBar />
          <main className="px-8 py-6">{children}</main>
        </div>
      </div>
    </>
  );
}
