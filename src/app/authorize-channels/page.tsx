"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { InTubeMediaMark } from "@/components/branding/InTubeMediaMark";
import { YouTubeAttribution } from "@/components/branding/YouTubeAttribution";

interface InviteChannel {
  channelId: string;
  title: string;
  thumbnail: string;
  status: "verified" | "expired" | "pending";
}

interface InviteDetails {
  clientName: string;
  channels: InviteChannel[];
  verifiedCount: number;
}

function AuthorizeChannelsContent() {
  const searchParams = useSearchParams();
  const invite = searchParams.get("invite") || "";
  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);

  const load = useCallback(
    async (silent: boolean) => {
      if (silent) setRefreshing(true);
      try {
        if (!invite) throw new Error("Invalid link.");
        const res = await fetch(`/api/channel-invites?invite=${encodeURIComponent(invite)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Link could not be loaded");
        setDetails(json.data);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Link could not be loaded");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [invite]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const startAuthorization = async (channelId: string) => {
    setStartingId(channelId);
    setError("");
    try {
      const res = await fetch("/api/channel-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", invite, channelId }),
      });
      const json = await res.json();
      if (!res.ok || !json.data?.authorizeUrl) {
        throw new Error(json.error || "Could not start authorization");
      }
      window.location.assign(json.data.authorizeUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start authorization");
      setStartingId(null);
    }
  };

  const total = details?.channels.length || 0;
  const verified = details?.verifiedCount || 0;
  const progress = total > 0 ? Math.round((verified / total) * 100) : 0;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <InTubeMediaMark className="h-11 w-11" textClassName="text-sm" />
            <div>
              <p className="text-lg font-bold">Authorize your YouTube channels</p>
              <p className="text-sm text-slate-500">
                Verify each channel below — the status updates as soon as it is done
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-7 sm:px-8">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-12 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading your channels…
            </div>
          )}

          {!loading && error && !details && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {details && (
            <>
              <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                      Hello {details.clientName}
                    </p>
                    <p className="mt-1 text-sm text-indigo-900">
                      <span className="font-bold">{verified}</span> of{" "}
                      <span className="font-bold">{total}</span> channels verified
                    </p>
                  </div>
                  <button
                    onClick={() => load(true)}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-indigo-100">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </section>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                {details.channels.map((channel) => {
                  const isVerified = channel.status === "verified";
                  const isStarting = startingId === channel.channelId;
                  return (
                    <li
                      key={channel.channelId}
                      className="flex items-center gap-3 px-4 py-3 sm:gap-4"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-200">
                        {channel.thumbnail && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={channel.thumbnail}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <a
                          href={`https://www.youtube.com/channel/${channel.channelId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-slate-900 hover:text-red-600"
                        >
                          <span className="truncate">{channel.title}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        </a>
                        <p className="truncate font-mono text-[11px] text-slate-400">
                          {channel.channelId}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                            <CheckCircle2 className="h-4 w-4" />
                            Verified
                          </span>
                        ) : (
                          <button
                            onClick={() => startAuthorization(channel.channelId)}
                            disabled={startingId !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {isStarting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                            {channel.status === "expired" ? "Re-authorize" : "Authorize"}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {verified === total && total > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  <ShieldCheck className="h-5 w-5" />
                  All channels are verified. You can close this page.
                </div>
              )}

              <p className="text-xs text-slate-500">
                Each Authorize button opens Bainsla Music&apos;s disclosure, then Google sign-in on
                accounts.google.com. Bainsla Music never receives your Google or YouTube password.
                Sign in with the Google account that owns that specific channel.{" "}
                <Link href="/privacy-policy" className="underline">
                  Privacy Policy
                </Link>{" "}
                ·{" "}
                <Link href="/terms" className="underline">
                  Terms
                </Link>
              </p>
              <YouTubeAttribution />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function AuthorizeChannelsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <AuthorizeChannelsContent />
    </Suspense>
  );
}
