"use client";

import { useEffect } from "react";

const AUTO_RETRY_WINDOW_MS = 60_000;

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[AppError] Unhandled page error", error);

    try {
      const key = `app-error-retry:${window.location.pathname}`;
      const lastRetry = Number(window.sessionStorage.getItem(key) || 0);
      if (Date.now() - lastRetry > AUTO_RETRY_WINDOW_MS) {
        window.sessionStorage.setItem(key, String(Date.now()));
        const timer = window.setTimeout(() => window.location.reload(), 500);
        return () => window.clearTimeout(timer);
      }
    } catch {
      return;
    }
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">This page could not load</h1>
        <p className="mt-2 text-sm text-muted">
          The dashboard hit a temporary loading error. Retry the page without losing your saved data.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-slate-50"
          >
            Reload
          </button>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-muted">Error reference: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
