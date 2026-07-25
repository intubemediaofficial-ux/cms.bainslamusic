"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Video,
} from "lucide-react";
import { InTubeMediaMark } from "@/components/branding/InTubeMediaMark";
import { YouTubeAttribution } from "@/components/branding/YouTubeAttribution";

interface ScopeDetail {
  scope: string;
  title: string;
  description: string;
}

interface AuthorizationDetails {
  channelId: string;
  channelTitle: string;
  scopes: ScopeDetail[];
}

const scopeIcons = [Video, BarChart3, DollarSign];

function AuthorizationContent() {
  const searchParams = useSearchParams();
  const state = searchParams.get("state") || "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [confirmsChannelAuthority, setConfirmsChannelAuthority] = useState(false);
  const [loading, setLoading] = useState(true);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state) {
      queueMicrotask(() => {
        setError("Invalid authorization link.");
        setLoading(false);
      });
      return;
    }

    const controller = new AbortController();
    fetch(`/api/channel-authorization?state=${encodeURIComponent(state)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Authorization link could not be loaded");
        setDetails(json.data);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Authorization link could not be loaded");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [state]);

  const continueToGoogle = async () => {
    if (!acceptedPolicies || !confirmsChannelAuthority) return;
    setContinuing(true);
    setError("");
    try {
      const response = await fetch("/api/channel-authorization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, acceptedPolicies, confirmsChannelAuthority }),
      });
      const json = await response.json();
      if (!response.ok || !json.data?.oauthUrl) {
        throw new Error(json.error || "Could not continue to Google");
      }
      window.location.assign(json.data.oauthUrl);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not continue to Google");
      setContinuing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <InTubeMediaMark className="h-11 w-11" textClassName="text-sm" />
            <div>
              <p className="text-lg font-bold">Authorize YouTube channel access</p>
              <p className="text-sm text-slate-500">Review the requested access before continuing</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-7 sm:px-8">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-12 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading authorization details…
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
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Channel to authorize</p>
                <p className="mt-1 text-lg font-bold text-indigo-950">{details.channelTitle}</p>
                <p className="mt-1 break-all text-xs text-indigo-700">{details.channelId}</p>
              </section>

              <section>
                <h1 className="text-xl font-bold">What InTubeMedia requests</h1>
                <div className="mt-4 space-y-3">
                  {details.scopes.map((scope, index) => {
                    const Icon = scopeIcons[index] || ShieldCheck;
                    return (
                      <div key={scope.scope} className="flex gap-3 rounded-xl border border-slate-200 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          <Icon className="h-5 w-5 text-slate-700" />
                        </div>
                        <div>
                          <p className="font-semibold">{scope.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{scope.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex gap-3">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <div className="text-sm leading-6 text-emerald-950">
                    <p className="font-semibold">Your Google password stays with Google</p>
                    <p>
                      Google sign-in and consent happen only on <strong>accounts.google.com</strong>.
                      InTubeMedia never asks for, receives, or stores your Google or YouTube password.
                      We receive OAuth authorization tokens after you approve access.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3 text-sm text-slate-700">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={confirmsChannelAuthority}
                    onChange={(event) => setConfirmsChannelAuthority(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <span>I confirm that I am the owner or an authorized manager of the channel shown above.</span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={acceptedPolicies}
                    onChange={(event) => setAcceptedPolicies(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    I consent to the data access and uses described above and agree to the{" "}
                    <Link href="/privacy-policy" target="_blank" className="font-medium text-indigo-700 underline">Privacy Policy</Link>
                    {" "}and{" "}
                    <Link href="/terms" target="_blank" className="font-medium text-indigo-700 underline">Terms of Service</Link>.
                  </span>
                </label>
              </section>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
              )}

              <button
                type="button"
                onClick={continueToGoogle}
                disabled={!acceptedPolicies || !confirmsChannelAuthority || continuing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {continuing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Continue to Google
                {!continuing && <ExternalLink className="h-4 w-4" />}
              </button>

              <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">Google Privacy Policy</a>
                <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="underline">YouTube Terms of Service</a>
                <a href="https://security.google.com/settings/security/permissions" target="_blank" rel="noopener noreferrer" className="underline">Manage Google permissions</a>
              </div>
              <div className="flex justify-center border-t border-slate-200 pt-5">
                <YouTubeAttribution />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function AuthorizeChannelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      }
    >
      <AuthorizationContent />
    </Suspense>
  );
}
