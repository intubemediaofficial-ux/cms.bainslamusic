"use client";

import Link from "next/link";

interface IssueRow {
  label: string;
  count: number;
  href: string;
}

const issueRows: IssueRow[] = [
  { label: "Reference overlaps", count: 0, href: "/cms-issues?type=reference-overlaps" },
  { label: "Invalid references", count: 0, href: "/cms-issues?type=invalid-references" },
  { label: "Ownership conflicts", count: 0, href: "/cms-issues?type=ownership-conflicts" },
  { label: "Ownership transfers", count: 0, href: "/cms-issues?type=ownership-transfers" },
  { label: "Potential claims", count: 1, href: "/cms-issues?type=potential-claims" },
  { label: "Disputed claims", count: 0, href: "/cms-issues?type=disputed-claims" },
  { label: "Appealed claims", count: 0, href: "/cms-issues?type=appealed-claims" },
];

interface ChannelOverviewRow {
  label: string;
  count: number;
  href: string;
}

const channelOverviewRows: ChannelOverviewRow[] = [
  { label: "Active channels with copyright strikes", count: 0, href: "/cms-channels?filter=copyright-strikes" },
  { label: "Pending invites", count: 0, href: "/cms-channels?filter=pending-invites" },
  { label: "Not monetizing", count: 7, href: "/cms-channels?filter=not-monetizing" },
];

export default function CmsDashboardPage() {
  return (
    <div>
      {/* Two-column content overview */}
      <div className="flex gap-6">
        {/* Issues Card */}
        <div className="flex-1 bg-white rounded-lg border border-[#e5e5e5]">
          <div className="px-6 pt-5 pb-3">
            <h2 className="text-[16px] font-medium text-[#282828]">Issues</h2>
          </div>
          <div className="px-6">
            {/* Column header */}
            <div className="flex items-center justify-between pb-2 text-[12px] text-[#909090]">
              <span></span>
              <span>Action required</span>
            </div>
            {/* Issue rows */}
            {issueRows.map((issue) => (
              <Link
                key={issue.label}
                href={issue.href}
                className="flex items-center justify-between py-3 border-t border-[#e5e5e5] hover:bg-[#f9f9f9] transition-colors -mx-6 px-6"
              >
                <span className="text-[14px] text-[#282828]">{issue.label}</span>
                <span className={`text-[14px] min-w-[32px] text-center ${
                  issue.count > 0 ? "text-[#065FD4] font-medium" : "text-[#909090]"
                }`}>
                  {issue.count}
                </span>
              </Link>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-[#e5e5e5]">
            <Link
              href="/cms-issues"
              className="inline-flex items-center text-[14px] font-medium text-[#065FD4] hover:text-[#0548a6] transition-colors px-3 py-1.5 rounded hover:bg-[#def1ff]"
            >
              View all issues
            </Link>
          </div>
        </div>

        {/* Channels Overview Card */}
        <div className="flex-1 bg-white rounded-lg border border-[#e5e5e5]">
          <div className="px-6 pt-5 pb-3">
            <h2 className="text-[16px] font-medium text-[#282828]">Channels overview</h2>
          </div>
          <div className="px-6">
            {channelOverviewRows.map((row) => (
              <Link
                key={row.label}
                href={row.href}
                className="flex items-center justify-between py-3.5 border-t border-[#e5e5e5] hover:bg-[#f9f9f9] transition-colors -mx-6 px-6"
              >
                <span className="text-[14px] text-[#282828]">{row.label}</span>
                <span className={`text-[14px] min-w-[28px] h-[28px] flex items-center justify-center rounded ${
                  row.count > 0
                    ? "bg-[#f1f1f1] text-[#065FD4] font-medium"
                    : "bg-[#f1f1f1] text-[#909090]"
                }`}>
                  {row.count}
                </span>
              </Link>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-[#e5e5e5]">
            <Link
              href="/cms-channels"
              className="inline-flex items-center text-[14px] font-medium text-[#065FD4] hover:text-[#0548a6] transition-colors px-3 py-1.5 rounded hover:bg-[#def1ff]"
            >
              View all channels
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
