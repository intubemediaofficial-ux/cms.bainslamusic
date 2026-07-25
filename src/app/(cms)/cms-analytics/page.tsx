"use client";

import { useState } from "react";

const revenueData = [
  { label: "Estimated revenue", value: "$4,520", change: "+8.2%", up: true },
  { label: "RPM", value: "$3.45", change: "+2.1%", up: true },
  { label: "CPM", value: "$5.12", change: "-1.3%", up: false },
  { label: "Playback-based CPM", value: "$7.84", change: "+3.4%", up: true },
];

const overviewData = [
  { label: "Views", value: "3.2M", change: "+12.4%", up: true },
  { label: "Watch time (hours)", value: "145K", change: "+9.8%", up: true },
  { label: "Subscribers", value: "+2.4K", change: "+15.2%", up: true },
  { label: "Estimated revenue", value: "$4,520", change: "+8.2%", up: true },
];

const reachData = [
  { label: "Impressions", value: "8.5M", change: "+11.3%", up: true },
  { label: "Impressions click-through rate", value: "4.8%", change: "+0.3%", up: true },
  { label: "Views", value: "3.2M", change: "+12.4%", up: true },
  { label: "Unique viewers", value: "1.8M", change: "+7.2%", up: true },
];

const engagementData = [
  { label: "Watch time (hours)", value: "145K", change: "+9.8%", up: true },
  { label: "Average view duration", value: "3:42", change: "+5.1%", up: true },
  { label: "Likes", value: "196K", change: "+14.6%", up: true },
  { label: "Shares", value: "24K", change: "+8.9%", up: true },
];

const audienceData = [
  { label: "Returning viewers", value: "1.2M", change: "+6.3%", up: true },
  { label: "New viewers", value: "620K", change: "+18.5%", up: true },
  { label: "Unique viewers", value: "1.8M", change: "+7.2%", up: true },
  { label: "Subscribers", value: "89.4K", change: "+2.4K", up: true },
];

const topContent = [
  { title: "Tere Bina - Official Music Video", views: "1.2M", watchTime: "42.5K hrs", revenue: "$1,245" },
  { title: "Nachdi Jawani - Lyrical", views: "2.1M", watchTime: "65.2K hrs", revenue: "$2,100" },
  { title: "Sada Punjab - Full Song", views: "856K", watchTime: "28.4K hrs", revenue: "$780" },
  { title: "Ishq Tera - Unplugged", views: "189K", watchTime: "8.2K hrs", revenue: "$195" },
  { title: "Punjab Di Shan - Remix", views: "567K", watchTime: "18.9K hrs", revenue: "$520" },
];

const trafficSources = [
  { source: "YouTube search", views: "960K", percent: 30 },
  { source: "Suggested videos", views: "832K", percent: 26 },
  { source: "Browse features", views: "640K", percent: 20 },
  { source: "External", views: "384K", percent: 12 },
  { source: "Channel pages", views: "192K", percent: 6 },
  { source: "Other YouTube features", views: "192K", percent: 6 },
];

const geoData = [
  { country: "India", views: "1.8M", percent: 56 },
  { country: "United States", views: "320K", percent: 10 },
  { country: "Canada", views: "256K", percent: 8 },
  { country: "United Kingdom", views: "192K", percent: 6 },
  { country: "Australia", views: "128K", percent: 4 },
  { country: "Pakistan", views: "96K", percent: 3 },
  { country: "Bangladesh", views: "80K", percent: 2.5 },
  { country: "Germany", views: "64K", percent: 2 },
  { country: "Other", views: "272K", percent: 8.5 },
];

const ageData = [
  { group: "13-17", male: 5, female: 3 },
  { group: "18-24", male: 22, female: 10 },
  { group: "25-34", male: 18, female: 10 },
  { group: "35-44", male: 12, female: 6 },
  { group: "45-54", male: 6, female: 3 },
  { group: "55-64", male: 2, female: 1 },
  { group: "65+", male: 1, female: 1 },
];

const tabs = ["Overview", "Reach", "Engagement", "Audience", "Revenue"] as const;
type Tab = typeof tabs[number];

function generateChartBars(count: number, color: string) {
  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    heights.push(15 + Math.sin(i * 0.5) * 25 + Math.random() * 30);
  }
  return (
    <div className="h-[200px] flex items-end gap-[2px]">
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[1px] hover:opacity-80 transition-opacity cursor-pointer"
          style={{ height: `${h}%`, backgroundColor: color }}
        />
      ))}
    </div>
  );
}

function MetricCards({ data }: { data: { label: string; value: string; change: string; up: boolean }[] }) {
  return (
    <div className="flex gap-0 border-b border-[#e5e5e5]">
      {data.map((m, i) => (
        <div key={m.label} className={`flex-1 py-4 px-5 ${i > 0 ? "border-l border-[#e5e5e5]" : ""}`}>
          <p className="text-[12px] text-[#606060] mb-1">{m.label}</p>
          <p className="text-[28px] font-normal text-[#282828] leading-tight">{m.value}</p>
          <p className={`text-[12px] mt-1 ${m.up ? "text-[#0d7d2c]" : "text-[#cc0000]"}`}>
            {m.change}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function CmsAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [dateRange, setDateRange] = useState("Last 28 days");

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-[20px] font-normal text-[#282828]">Channel analytics</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[#e5e5e5] mb-0">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-[13px] font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-[#282828] text-[#282828]"
                : "border-transparent text-[#606060] hover:text-[#282828]"
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="ml-auto">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="text-[13px] text-[#606060] border border-[#d0d0d0] rounded px-3 py-1.5 bg-white cursor-pointer"
          >
            <option>Last 7 days</option>
            <option>Last 28 days</option>
            <option>Last 90 days</option>
            <option>Last 365 days</option>
            <option>Lifetime</option>
          </select>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === "Overview" && (
        <div>
          <MetricCards data={overviewData} />
          <div className="py-6">
            {generateChartBars(28, "#065FD4")}
            <div className="flex justify-between mt-2 text-[11px] text-[#909090]">
              <span>Apr 14</span>
              <span>Apr 21</span>
              <span>Apr 28</span>
              <span>May 5</span>
            </div>
          </div>

          {/* Top content */}
          <div className="border border-[#e5e5e5] rounded-lg">
            <div className="px-5 py-4 border-b border-[#e5e5e5]">
              <h3 className="text-[14px] font-medium text-[#282828]">Top content</h3>
              <p className="text-[12px] text-[#606060] mt-0.5">Last 28 days &middot; Views</p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[12px] text-[#606060] border-b border-[#e5e5e5]">
                  <th className="text-left font-normal px-5 py-2.5">Content</th>
                  <th className="text-right font-normal px-5 py-2.5">Views</th>
                  <th className="text-right font-normal px-5 py-2.5">Watch time</th>
                  <th className="text-right font-normal px-5 py-2.5">Est. revenue</th>
                </tr>
              </thead>
              <tbody>
                {topContent.map((item) => (
                  <tr key={item.title} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f9f9f9]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-[120px] h-[68px] bg-[#f2f2f2] rounded flex items-center justify-center shrink-0">
                          <svg className="w-8 h-8 text-[#909090]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M10 8l6 4-6 4V8z"/>
                          </svg>
                        </div>
                        <span className="text-[13px] text-[#282828] font-medium">{item.title}</span>
                      </div>
                    </td>
                    <td className="text-right px-5 py-3 text-[13px] text-[#282828]">{item.views}</td>
                    <td className="text-right px-5 py-3 text-[13px] text-[#282828]">{item.watchTime}</td>
                    <td className="text-right px-5 py-3 text-[13px] text-[#282828]">{item.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-[#e5e5e5]">
              <button className="text-[13px] font-medium text-[#065FD4] hover:bg-[#def1ff] px-3 py-1.5 rounded transition-colors">
                SEE MORE
              </button>
            </div>
          </div>

          {/* Real-time card */}
          <div className="border border-[#e5e5e5] rounded-lg mt-6">
            <div className="px-5 py-4 border-b border-[#e5e5e5]">
              <h3 className="text-[14px] font-medium text-[#282828]">Realtime</h3>
              <p className="text-[12px] text-[#606060] mt-0.5">Updating live</p>
            </div>
            <div className="px-5 py-4">
              <div className="flex gap-12">
                <div>
                  <p className="text-[12px] text-[#606060]">Last 48 hours</p>
                  <p className="text-[28px] font-normal text-[#282828]">12.4K</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#606060]">Last 60 minutes</p>
                  <p className="text-[28px] font-normal text-[#282828]">847</p>
                </div>
              </div>
              <div className="mt-4">
                {generateChartBars(48, "#909090")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reach Tab */}
      {activeTab === "Reach" && (
        <div>
          <MetricCards data={reachData} />
          <div className="py-6">
            {generateChartBars(28, "#065FD4")}
            <div className="flex justify-between mt-2 text-[11px] text-[#909090]">
              <span>Apr 14</span>
              <span>Apr 21</span>
              <span>Apr 28</span>
              <span>May 5</span>
            </div>
          </div>

          {/* Traffic sources */}
          <div className="border border-[#e5e5e5] rounded-lg">
            <div className="px-5 py-4 border-b border-[#e5e5e5]">
              <h3 className="text-[14px] font-medium text-[#282828]">Traffic source types</h3>
              <p className="text-[12px] text-[#606060] mt-0.5">Last 28 days</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {trafficSources.map((t) => (
                <div key={t.source} className="flex items-center gap-4">
                  <span className="text-[13px] text-[#282828] w-[200px]">{t.source}</span>
                  <div className="flex-1 bg-[#e5e5e5] rounded-full h-[4px]">
                    <div className="bg-[#065FD4] h-[4px] rounded-full" style={{ width: `${t.percent}%` }} />
                  </div>
                  <span className="text-[13px] text-[#282828] w-16 text-right">{t.views}</span>
                  <span className="text-[12px] text-[#606060] w-10 text-right">{t.percent}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top geographies */}
          <div className="border border-[#e5e5e5] rounded-lg mt-6">
            <div className="px-5 py-4 border-b border-[#e5e5e5]">
              <h3 className="text-[14px] font-medium text-[#282828]">Geography</h3>
              <p className="text-[12px] text-[#606060] mt-0.5">Top countries &middot; Last 28 days</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {geoData.map((g) => (
                <div key={g.country} className="flex items-center gap-4">
                  <span className="text-[13px] text-[#282828] w-[200px]">{g.country}</span>
                  <div className="flex-1 bg-[#e5e5e5] rounded-full h-[4px]">
                    <div className="bg-[#065FD4] h-[4px] rounded-full" style={{ width: `${g.percent * 1.5}%` }} />
                  </div>
                  <span className="text-[13px] text-[#282828] w-16 text-right">{g.views}</span>
                  <span className="text-[12px] text-[#606060] w-12 text-right">{g.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Engagement Tab */}
      {activeTab === "Engagement" && (
        <div>
          <MetricCards data={engagementData} />
          <div className="py-6">
            {generateChartBars(28, "#065FD4")}
            <div className="flex justify-between mt-2 text-[11px] text-[#909090]">
              <span>Apr 14</span>
              <span>Apr 21</span>
              <span>Apr 28</span>
              <span>May 5</span>
            </div>
          </div>

          {/* Top content by watch time */}
          <div className="border border-[#e5e5e5] rounded-lg">
            <div className="px-5 py-4 border-b border-[#e5e5e5]">
              <h3 className="text-[14px] font-medium text-[#282828]">Top content</h3>
              <p className="text-[12px] text-[#606060] mt-0.5">Last 28 days &middot; Watch time (hours)</p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[12px] text-[#606060] border-b border-[#e5e5e5]">
                  <th className="text-left font-normal px-5 py-2.5">Content</th>
                  <th className="text-right font-normal px-5 py-2.5">Watch time (hours)</th>
                  <th className="text-right font-normal px-5 py-2.5">Avg view duration</th>
                </tr>
              </thead>
              <tbody>
                {topContent.map((item) => (
                  <tr key={item.title} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f9f9f9]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-[120px] h-[68px] bg-[#f2f2f2] rounded flex items-center justify-center shrink-0">
                          <svg className="w-8 h-8 text-[#909090]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M10 8l6 4-6 4V8z"/>
                          </svg>
                        </div>
                        <span className="text-[13px] text-[#282828] font-medium">{item.title}</span>
                      </div>
                    </td>
                    <td className="text-right px-5 py-3 text-[13px] text-[#282828]">{item.watchTime}</td>
                    <td className="text-right px-5 py-3 text-[13px] text-[#282828]">3:42</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-[#e5e5e5]">
              <button className="text-[13px] font-medium text-[#065FD4] hover:bg-[#def1ff] px-3 py-1.5 rounded transition-colors">
                SEE MORE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audience Tab */}
      {activeTab === "Audience" && (
        <div>
          <MetricCards data={audienceData} />
          <div className="py-6">
            {generateChartBars(28, "#065FD4")}
            <div className="flex justify-between mt-2 text-[11px] text-[#909090]">
              <span>Apr 14</span>
              <span>Apr 21</span>
              <span>Apr 28</span>
              <span>May 5</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Age and gender */}
            <div className="border border-[#e5e5e5] rounded-lg">
              <div className="px-5 py-4 border-b border-[#e5e5e5]">
                <h3 className="text-[14px] font-medium text-[#282828]">Age and gender</h3>
                <p className="text-[12px] text-[#606060] mt-0.5">Last 28 days</p>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center gap-4 mb-4 text-[12px]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#065FD4]" /> Male 66%</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#EA4335]" /> Female 32%</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#909090]" /> Other 2%</span>
                </div>
                <div className="space-y-2">
                  {ageData.map((a) => (
                    <div key={a.group} className="flex items-center gap-2">
                      <span className="text-[12px] text-[#606060] w-10">{a.group}</span>
                      <div className="flex-1 flex h-[18px]">
                        <div className="bg-[#065FD4] rounded-l" style={{ width: `${a.male * 2}%` }} />
                        <div className="bg-[#EA4335] rounded-r" style={{ width: `${a.female * 2}%` }} />
                      </div>
                      <span className="text-[12px] text-[#606060] w-10 text-right">{a.male + a.female}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top geographies */}
            <div className="border border-[#e5e5e5] rounded-lg">
              <div className="px-5 py-4 border-b border-[#e5e5e5]">
                <h3 className="text-[14px] font-medium text-[#282828]">Top geographies</h3>
                <p className="text-[12px] text-[#606060] mt-0.5">Last 28 days &middot; Views</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {geoData.slice(0, 7).map((g) => (
                  <div key={g.country} className="flex items-center gap-3">
                    <span className="text-[13px] text-[#282828] w-[140px]">{g.country}</span>
                    <div className="flex-1 bg-[#e5e5e5] rounded-full h-[4px]">
                      <div className="bg-[#065FD4] h-[4px] rounded-full" style={{ width: `${g.percent * 1.5}%` }} />
                    </div>
                    <span className="text-[12px] text-[#606060] w-12 text-right">{g.percent}%</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-[#e5e5e5]">
                <button className="text-[13px] font-medium text-[#065FD4] hover:bg-[#def1ff] px-3 py-1.5 rounded transition-colors">
                  SEE MORE
                </button>
              </div>
            </div>
          </div>

          {/* When your viewers are on YouTube */}
          <div className="border border-[#e5e5e5] rounded-lg mt-6">
            <div className="px-5 py-4 border-b border-[#e5e5e5]">
              <h3 className="text-[14px] font-medium text-[#282828]">When your viewers are on YouTube</h3>
              <p className="text-[12px] text-[#606060] mt-0.5">Your local time</p>
            </div>
            <div className="px-5 py-6">
              <div className="grid grid-cols-8 gap-1">
                <div></div>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                  <div key={d} className="text-center text-[11px] text-[#606060] pb-2">{d}</div>
                ))}
                {["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm"].map((time) => (
                  <div key={time} className="contents">
                    <div className="text-[11px] text-[#606060] pr-2 text-right flex items-center justify-end">{time}</div>
                    {Array.from({ length: 7 }, (_, j) => {
                      const intensity = Math.random();
                      const opacity = 0.1 + intensity * 0.9;
                      return (
                        <div
                          key={j}
                          className="aspect-square rounded-sm cursor-pointer"
                          style={{ backgroundColor: `rgba(6, 95, 212, ${opacity})` }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4 text-[11px] text-[#606060]">
                <span>Not active</span>
                <div className="flex gap-0.5">
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map((o) => (
                    <div key={o} className="w-4 h-4 rounded-sm" style={{ backgroundColor: `rgba(6, 95, 212, ${o})` }} />
                  ))}
                </div>
                <span>Most active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === "Revenue" && (
        <div>
          <MetricCards data={revenueData} />
          <div className="py-6">
            {generateChartBars(28, "#0d7d2c")}
            <div className="flex justify-between mt-2 text-[11px] text-[#909090]">
              <span>Apr 14</span>
              <span>Apr 21</span>
              <span>Apr 28</span>
              <span>May 5</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Revenue sources */}
            <div className="border border-[#e5e5e5] rounded-lg">
              <div className="px-5 py-4 border-b border-[#e5e5e5]">
                <h3 className="text-[14px] font-medium text-[#282828]">Revenue sources</h3>
                <p className="text-[12px] text-[#606060] mt-0.5">Last 28 days</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { type: "Ads", revenue: "$3,300", percent: 73 },
                  { type: "YouTube Premium", revenue: "$620", percent: 14 },
                  { type: "Memberships", revenue: "$380", percent: 8 },
                  { type: "Super Chat & Super Stickers", revenue: "$220", percent: 5 },
                ].map((r) => (
                  <div key={r.type} className="flex items-center gap-4">
                    <span className="text-[13px] text-[#282828] w-[220px]">{r.type}</span>
                    <div className="flex-1 bg-[#e5e5e5] rounded-full h-[4px]">
                      <div className="bg-[#0d7d2c] h-[4px] rounded-full" style={{ width: `${r.percent}%` }} />
                    </div>
                    <span className="text-[13px] text-[#282828] w-16 text-right">{r.revenue}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top earning content */}
            <div className="border border-[#e5e5e5] rounded-lg">
              <div className="px-5 py-4 border-b border-[#e5e5e5]">
                <h3 className="text-[14px] font-medium text-[#282828]">Top earning content</h3>
                <p className="text-[12px] text-[#606060] mt-0.5">Last 28 days &middot; Estimated revenue</p>
              </div>
              <div className="px-5 py-4">
                {topContent.map((item, i) => (
                  <div key={item.title} className="flex items-center gap-3 py-2">
                    <span className="text-[12px] text-[#909090] w-5">{i + 1}</span>
                    <div className="w-[80px] h-[45px] bg-[#f2f2f2] rounded flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-[#909090]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10 8l6 4-6 4V8z"/>
                      </svg>
                    </div>
                    <span className="text-[13px] text-[#282828] flex-1">{item.title}</span>
                    <span className="text-[13px] text-[#282828]">{item.revenue}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
