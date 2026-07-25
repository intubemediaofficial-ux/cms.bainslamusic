"use client";

import { useSession } from "next-auth/react";
import { useState, useCallback } from "react";

export default function ReadOnlyBanner() {
  const { data: session } = useSession();

  // Only show banner if status is explicitly "pending" — not for undefined/loading states
  if (!session?.user || session.user.role === "admin" || session.user.userStatus !== "pending") {
    return null;
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-center">
      <div className="flex items-center justify-center gap-2 text-amber-800 text-sm font-medium">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span>Your account is pending admin approval. You can view the dashboard but cannot make any changes.</span>
      </div>
    </div>
  );
}

export function useIsPending(): boolean {
  const { data: session } = useSession();
  if (!session?.user) return false;
  if (session.user.role === "admin") return false;
  return session.user.userStatus === "pending";
}

export function usePendingGuard(): () => boolean {
  const isPending = useIsPending();
  return useCallback(() => {
    if (isPending) {
      alert("Your account is pending admin approval. Please wait for admin to approve your account before making changes.");
      return true;
    }
    return false;
  }, [isPending]);
}
