"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  CircleDollarSign,
  Copyright,
  FileSpreadsheet,
  HeartPulse,
  Lightbulb,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WandSparkles,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface AiScopeOption {
  id: string;
  label: string;
  type: "personal" | "company";
}

interface AiAlert {
  id: string;
  severity: "critical" | "warning" | "positive" | "info";
  title: string;
  message: string;
  channelId?: string;
}

interface AiChannelInsight {
  channelId: string;
  channelTitle: string;
  ownerName: string;
  revenue: number;
  currentMonthRevenue: number;
  views: number;
  subscribers: number;
  healthScore: number;
  healthStatus: "healthy" | "attention" | "critical";
  tokenConnected: boolean;
  revenueUpdatedAt?: string;
  statsUpdatedAt?: string;
  trendPercent: number | null;
}

interface AiInsights {
  scopeId: string;
  scopeLabel: string;
  generatedAt: string;
  cacheLastUpdated: string | null;
  currentMonth: string;
  currentMonthSyncedThrough: string | null;
  channelCount: number;
  clientCount: number;
  connectedChannelCount: number;
  cachedRevenue: number;
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  forecastRevenue: number;
  forecastConfidence: "low" | "medium" | "high";
  revenueTrendPercent: number | null;
  healthScore: number;
  summary: string;
  alerts: AiAlert[];
  channels: AiChannelInsight[];
}

interface SheetReconciliationIssue {
  id: string;
  severity: "warning" | "info";
  type: "missing_metadata" | "client_name" | "channel_name" | "network_name";
  vendorName: string;
  channelId: string;
  channelTitle: string;
  dashboardValue: string;
  sheetValue: string;
  message: string;
}

interface SheetReconciliation {
  configured: boolean;
  vendorCount: number;
  assignedChannelCount: number;
  matchedChannelCount: number;
  historicalRowCount: number;
  issueCount: number;
  score: number;
  issues: SheetReconciliationIssue[];
}

interface CopyrightPriorityItem {
  id: string;
  songTitle: string;
  videoTitle: string;
  videoUrl: string;
  channelTitle: string;
  views: number;
  matchScore: number;
  status: "new" | "confirmed";
  detectedAt: string;
  priorityScore: number;
  reasons: string[];
}

interface CopyrightPriority {
  unresolvedCount: number;
  highPriorityCount: number;
  items: CopyrightPriorityItem[];
}

interface AiActionResponse {
  text?: string;
  reconciliation?: SheetReconciliation;
  priority?: CopyrightPriority;
}

interface AiResponseData {
  provider: {
    name: string;
    model: string;
    configured: boolean;
  };
  scopeOptions: AiScopeOption[];
  insights: AiInsights;
  reconciliation: SheetReconciliation;
  adminFeatures: boolean;
}

type Section = "overview" | "assistant" | "content" | "reconciliation" | "copyright";

const questionSuggestions = [
  "आज सबसे जरूरी revenue risk क्या है?",
  "कौन से channels की health सबसे कम है?",
  "इस महीने का forecast समझाओ",
  "पिछले महीने के मुकाबले performance कैसी है?",
];

function dateTime(value: string | null | undefined): string {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function alertClasses(severity: AiAlert["severity"]): string {
  if (severity === "critical") return "border-red-200 bg-red-50 text-red-800";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  if (severity === "positive") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

function healthClasses(status: AiChannelInsight["healthStatus"]): string {
  if (status === "healthy") return "bg-emerald-100 text-emerald-700";
  if (status === "attention") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function AiCenterPage() {
  const [section, setSection] = useState<Section>("overview");
  const [data, setData] = useState<AiResponseData | null>(null);
  const [scopeId, setScopeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [dailySummary, setDailySummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [topic, setTopic] = useState("");
  const [contentIdeas, setContentIdeas] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [reconciliationText, setReconciliationText] = useState("");
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [copyrightText, setCopyrightText] = useState("");
  const [copyrightPriority, setCopyrightPriority] = useState<CopyrightPriority | null>(null);
  const [copyrightLoading, setCopyrightLoading] = useState(false);

  const loadInsights = useCallback(async (requestedScopeId?: string) => {
    setLoading(true);
    setError("");
    try {
      const params = requestedScopeId
        ? `?scopeId=${encodeURIComponent(requestedScopeId)}`
        : "";
      const response = await fetch(`/api/ai${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load AI insights");
      const nextData = result.data as AiResponseData;
      setData(nextData);
      setScopeId(nextData.insights.scopeId);
      setSelectedChannelId((current) =>
        nextData.insights.channels.some((channel) => channel.channelId === current)
          ? current
          : nextData.insights.channels[0]?.channelId || ""
      );
      setDailySummary("");
      setAnswer("");
      setContentIdeas("");
      setReconciliationText("");
      setCopyrightText("");
      setCopyrightPriority(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load AI insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadInsights();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadInsights]);

  const postAiData = async (payload: Record<string, unknown>): Promise<AiActionResponse> => {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, scopeId }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "AI request failed");
    return (result.data || {}) as AiActionResponse;
  };

  const postAi = async (payload: Record<string, unknown>): Promise<string> => {
    return (await postAiData(payload)).text || "";
  };

  const askQuestion = async (nextQuestion?: string) => {
    const value = (nextQuestion || question).trim();
    if (!value) return;
    setQuestion(value);
    setAsking(true);
    setError("");
    try {
      setAnswer(await postAi({ action: "ask", question: value }));
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "AI request failed");
    } finally {
      setAsking(false);
    }
  };

  const generateSummary = async (refresh = false) => {
    setSummaryLoading(true);
    setError("");
    try {
      setDailySummary(await postAi({ action: "summary", refresh }));
    } catch (summaryError) {
      setError(summaryError instanceof Error ? summaryError.message : "Summary failed");
    } finally {
      setSummaryLoading(false);
    }
  };

  const generateContentIdeas = async () => {
    if (!selectedChannelId || !topic.trim()) return;
    setContentLoading(true);
    setError("");
    try {
      setContentIdeas(
        await postAi({
          action: "content-suggestions",
          channelId: selectedChannelId,
          topic,
        })
      );
    } catch (contentError) {
      setError(contentError instanceof Error ? contentError.message : "Content generation failed");
    } finally {
      setContentLoading(false);
    }
  };

  const explainReconciliation = async () => {
    setReconciliationLoading(true);
    setError("");
    try {
      setReconciliationText(
        await postAi({ action: "reconciliation-summary" })
      );
    } catch (reconciliationError) {
      setError(
        reconciliationError instanceof Error
          ? reconciliationError.message
          : "Reconciliation explanation failed"
      );
    } finally {
      setReconciliationLoading(false);
    }
  };

  const loadCopyrightPriority = async () => {
    setCopyrightLoading(true);
    setError("");
    try {
      const result = await postAiData({ action: "copyright-priority" });
      setCopyrightText(result.text || "");
      setCopyrightPriority(result.priority || null);
    } catch (copyrightError) {
      setError(
        copyrightError instanceof Error
          ? copyrightError.message
          : "Copyright priority failed"
      );
    } finally {
      setCopyrightLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-9 w-9 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        {error || "AI Center is unavailable."}
      </div>
    );
  }

  const insights = data.insights;
  const trend = insights.revenueTrendPercent;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-900 p-7 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-violet-100">
              <Sparkles className="h-3.5 w-3.5" />
              {data.provider.name} · {data.provider.model}
            </div>
            <h1 className="text-3xl font-bold">AI Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Tenant-safe revenue intelligence, channel health, forecasting and content assistance from the server cache.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {data.scopeOptions.length > 0 && (
              <select
                value={scopeId}
                onChange={(event) => loadInsights(event.target.value)}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white outline-none"
              >
                {data.scopeOptions.map((option) => (
                  <option key={option.id} value={option.id} className="text-slate-900">
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => loadInsights(scopeId)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20"
            >
              <RefreshCw className="h-4 w-4" /> Refresh cache view
            </button>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {([
            ["overview", "Overview", BrainCircuit],
            ["assistant", "Ask AI", Bot],
            ["content", "Content Ideas", WandSparkles],
            ["reconciliation", "Sheet Check", FileSpreadsheet],
          ] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setSection(value)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                section === value ? "bg-white text-slate-950" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
          {data.adminFeatures && (
            <button
              onClick={() => setSection("copyright")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                section === "copyright" ? "bg-white text-slate-950" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Copyright className="h-4 w-4" /> Copyright Priority
            </button>
          )}
        </div>
      </div>

      {!data.provider.configured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Gemini is not configured on this server. Deterministic insights remain available, but generated answers are disabled.
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {section === "overview" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={CircleDollarSign}
              label="Dashboard revenue cache"
              value={formatCurrency(insights.cachedRevenue)}
              detail="Original server cache"
              color="emerald"
            />
            <Metric
              icon={TrendingUp}
              label={`${insights.currentMonth} revenue`}
              value={formatCurrency(insights.currentMonthRevenue)}
              detail={`Through ${insights.currentMonthSyncedThrough || "latest cache"}`}
              color="blue"
            />
            <Metric
              icon={Sparkles}
              label="Month-end forecast"
              value={formatCurrency(insights.forecastRevenue)}
              detail={`${insights.forecastConfidence} confidence`}
              color="violet"
            />
            <Metric
              icon={HeartPulse}
              label="Channel health"
              value={`${insights.healthScore}/100`}
              detail={`${insights.connectedChannelCount}/${insights.channelCount} tokens connected`}
              color="amber"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <BrainCircuit className="h-5 w-5 text-violet-600" /> Daily AI Brief
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">Cache updated {dateTime(insights.cacheLastUpdated)}</p>
                </div>
                <button
                  onClick={() => generateSummary(Boolean(dailySummary))}
                  disabled={summaryLoading || !data.provider.configured}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {summaryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {dailySummary ? "Regenerate" : "Generate"}
                </button>
              </div>
              <div className="mt-5 whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                {dailySummary || insights.summary}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                {trend !== null && trend < 0 ? (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                )}
                Revenue Movement
              </h2>
              <div className="mt-6 text-4xl font-black text-slate-900">
                {trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend.toFixed(1)}%`}
              </div>
              <p className="mt-2 text-sm text-slate-500">Current daily run rate vs previous calendar month</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-blue-600">Current month</p>
                  <p className="mt-1 font-bold text-blue-950">{formatCurrency(insights.currentMonthRevenue)}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-slate-500">Previous month</p>
                  <p className="mt-1 font-bold text-slate-900">{formatCurrency(insights.previousMonthRevenue)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Smart Alerts
              </h2>
              <div className="mt-4 space-y-3">
                {insights.alerts.length === 0 ? (
                  <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">No material cache risks detected.</div>
                ) : (
                  insights.alerts.slice(0, 10).map((alert) => (
                    <div key={alert.id} className={`rounded-xl border p-4 ${alertClasses(alert.severity)}`}>
                      <p className="text-sm font-bold">{alert.title}</p>
                      <p className="mt-1 text-xs leading-5 opacity-90">{alert.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <ShieldCheck className="h-5 w-5 text-violet-600" /> Channel Health Priority
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Channel</th>
                      <th className="px-5 py-3">Health</th>
                      <th className="px-5 py-3">Revenue</th>
                      <th className="px-5 py-3">Views</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {insights.channels.slice(0, 15).map((channel) => (
                      <tr key={channel.channelId}>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">{channel.channelTitle}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{channel.ownerName}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${healthClasses(channel.healthStatus)}`}>
                            {channel.healthScore}/100
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-800">{formatCurrency(channel.revenue)}</td>
                        <td className="px-5 py-4 text-slate-600">{formatNumber(channel.views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {section === "assistant" && (
        <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Lightbulb className="h-5 w-5 text-amber-500" /> Suggested Questions
            </h2>
            <div className="mt-4 space-y-2">
              {questionSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => askQuestion(suggestion)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-left text-sm text-slate-700 hover:border-violet-300 hover:bg-violet-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Bot className="h-5 w-5 text-violet-600" /> Ask about {insights.scopeLabel}
            </h2>
            <div className="mt-4 flex gap-2">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    askQuestion();
                  }
                }}
                placeholder="Revenue, channel health, forecast या alerts के बारे में पूछें…"
                className="min-h-24 flex-1 rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-violet-400"
              />
              <button
                onClick={() => askQuestion()}
                disabled={asking || !question.trim() || !data.provider.configured}
                className="self-end rounded-xl bg-violet-600 p-3 text-white disabled:opacity-50"
              >
                {asking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
            <div className="mt-5 min-h-64 whitespace-pre-wrap rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-100">
              {asking ? "Analyzing the tenant-safe cache…" : answer || "AI answer will appear here. It can read cache data but cannot change anything."}
            </div>
          </div>
        </div>
      )}

      {section === "content" && (
        <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <WandSparkles className="h-5 w-5 text-violet-600" /> Content Brief
            </h2>
            <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-500">Channel</label>
            <select
              value={selectedChannelId}
              onChange={(event) => setSelectedChannelId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              {insights.channels.map((channel) => (
                <option key={channel.channelId} value={channel.channelId}>{channel.channelTitle}</option>
              ))}
            </select>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">Topic or goal</label>
            <textarea
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="जैसे: नया Haryanvi devotional song launch करना है"
              className="mt-2 min-h-32 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-violet-400"
            />
            <button
              onClick={generateContentIdeas}
              disabled={contentLoading || !topic.trim() || !selectedChannelId || !data.provider.configured}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {contentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate content plan
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">AI Suggestions</h2>
            <div className="mt-4 min-h-[420px] whitespace-pre-wrap rounded-2xl bg-gradient-to-br from-violet-50 to-blue-50 p-5 text-sm leading-7 text-slate-700">
              {contentLoading ? "Generating titles, hooks, keywords and publishing checklist…" : contentIdeas || "Select a channel and describe the next video or campaign."}
            </div>
          </div>
        </div>
      )}

      {section === "reconciliation" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={FileSpreadsheet} label="Sheet match score" value={`${data.reconciliation.score}/100`} detail={`${data.reconciliation.issueCount} differences`} color="violet" />
            <Metric icon={ShieldCheck} label="Matched assignments" value={`${data.reconciliation.matchedChannelCount}/${data.reconciliation.assignedChannelCount}`} detail={`${data.reconciliation.vendorCount} vendors`} color="emerald" />
            <Metric icon={AlertTriangle} label="Review queue" value={String(data.reconciliation.issueCount)} detail="Read-only differences" color="amber" />
            <Metric icon={RefreshCw} label="Historical rows" value={String(data.reconciliation.historicalRowCount)} detail="Preserved, never auto-deleted" color="blue" />
          </div>
          {!data.reconciliation.configured && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Google Sheet is not configured for this tenant scope. No Sheet data was changed.
            </div>
          )}
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FileSpreadsheet className="h-5 w-5 text-violet-600" /> Dashboard vs Sheet</h2>
                <p className="mt-1 text-xs text-slate-500">Metadata only. Revenue stays authoritative from server cache.</p>
              </div>
              <div className="max-h-[520px] divide-y divide-slate-100 overflow-auto">
                {data.reconciliation.issues.length === 0 ? (
                  <p className="p-6 text-sm text-emerald-700">No active assignment differences detected.</p>
                ) : data.reconciliation.issues.map((issue) => (
                  <div key={issue.id} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-slate-900">{issue.channelTitle}</p>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{issue.vendorName}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{issue.message}</p>
                    <p className="mt-2 text-xs text-slate-500">Dashboard: {issue.dashboardValue || "Blank"} · Sheet: {issue.sheetValue || "Blank"}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-slate-900">AI Reconciliation Brief</h2>
                <button onClick={explainReconciliation} disabled={reconciliationLoading || !data.provider.configured} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                  {reconciliationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Explain
                </button>
              </div>
              <div className="mt-4 min-h-80 whitespace-pre-wrap rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-100">
                {reconciliationLoading ? "Explaining safe reconciliation priorities…" : reconciliationText || "Generate a read-only explanation. Historical Sheet rows will remain preserved."}
              </div>
            </div>
          </div>
        </div>
      )}

      {section === "copyright" && data.adminFeatures && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Copyright className="h-5 w-5 text-violet-600" /> Admin Copyright Priority</h2>
                <p className="mt-1 text-sm text-slate-500">Scores unresolved matches for human review. No claim or status is changed.</p>
              </div>
              <button onClick={loadCopyrightPriority} disabled={copyrightLoading || !data.provider.configured} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                {copyrightLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Analyze queue
              </button>
            </div>
          </div>
          {copyrightPriority && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Metric icon={Copyright} label="Unresolved matches" value={String(copyrightPriority.unresolvedCount)} detail="New and confirmed" color="amber" />
                <Metric icon={AlertTriangle} label="High priority" value={String(copyrightPriority.highPriorityCount)} detail="Priority score 75+" color="violet" />
              </div>
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="max-h-[600px] divide-y divide-slate-100 overflow-auto">
                    {copyrightPriority.items.map((item) => (
                      <div key={item.id} className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <a href={item.videoUrl} target="_blank" rel="noreferrer" className="font-bold text-violet-700 hover:underline">{item.videoTitle}</a>
                            <p className="mt-1 text-sm text-slate-600">Song: {item.songTitle} · {item.channelTitle}</p>
                          </div>
                          <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-black text-violet-700">{item.priorityScore}</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Match {item.matchScore}% · {formatNumber(item.views)} views · {item.status}</p>
                        <p className="mt-2 text-xs text-slate-600">{item.reasons.join(" · ") || "Standard human review"}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="min-h-[400px] whitespace-pre-wrap rounded-2xl bg-slate-950 p-6 text-sm leading-7 text-slate-100">
                  {copyrightText || "AI priority explanation will appear here."}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface MetricProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  color: "emerald" | "blue" | "violet" | "amber";
}

function Metric({ icon: Icon, label, value, detail, color }: MetricProps) {
  const colors = {
    emerald: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex rounded-xl p-2.5 ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
