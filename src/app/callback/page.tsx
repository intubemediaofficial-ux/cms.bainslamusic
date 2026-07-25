"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";

interface ChannelInfo {
  channelId: string;
  channelTitle: string;
  subscribers: number;
  totalViews: number;
  totalVideos: number;
  thumbnail: string;
}

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [kvConfigured, setKvConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      queueMicrotask(() => {
        setStatus("error");
        setErrorMessage(error === "access_denied"
          ? "Access denied. The channel owner did not grant permission."
          : `OAuth error: ${error}`);
      });
      return;
    }

    if (!code || !state) {
      queueMicrotask(() => {
        setStatus("error");
        setErrorMessage("Missing authorization code or state parameter.");
      });
      return;
    }

    if (!/^cms-oauth-[A-Za-z0-9_-]+$/.test(state)) {
      queueMicrotask(() => {
        setStatus("error");
        setErrorMessage("Invalid state parameter.");
      });
      return;
    }

    // Exchange code for tokens via API
    async function exchangeCode() {
      try {
        const response = await fetch("/api/channel-tokens/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        });

        const result = await response.json();
        if (!response.ok) {
          setStatus("error");
          setErrorMessage(result.error || "Failed to exchange authorization code.");
          return;
        }

        setChannelInfo(result.data.channelInfo);
        setKvConfigured(result.data.kvConfigured ?? null);
        setStatus("success");
      } catch {
        setStatus("error");
        setErrorMessage("Failed to process authorization. Please try again.");
      }
    }

    exchangeCode();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">YouTube OAuth2 Callback</h1>
          <p className="text-gray-500 text-sm mb-6">{status === "error" ? "Failed to process authorization callback" : status === "success" ? "Successfully processed YouTube authorization callback" : "Processing..."}</p>

          {status === "loading" && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-600">Processing authorization...</p>
            </div>
          )}

          {status === "success" && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-700 font-medium">YouTube OAuth2 callback processed successfully</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  Token validated and stored. You can close this page or open the verified channel on YouTube.
                </p>
              </div>
              {kvConfigured === false && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
                  <p className="text-sm text-amber-700">
                    <strong>Warning:</strong> Persistent server storage is unavailable. Please contact InTubeMedia support.
                  </p>
                </div>
              )}

              {channelInfo && (
                <div className="border border-gray-200 rounded-lg p-5">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Channel Information</h2>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <div>
                        <span className="font-medium text-gray-700">Channel ID:</span>{" "}
                        <span className="text-gray-900">{channelInfo.channelId}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Channel Title:</span>{" "}
                        <span className="text-gray-900">{channelInfo.channelTitle}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Subscribers:</span>{" "}
                        <span className="text-gray-900">{channelInfo.subscribers.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Total Views:</span>{" "}
                        <span className="text-gray-900">{channelInfo.totalViews.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Total Videos:</span>{" "}
                        <span className="text-gray-900">{channelInfo.totalVideos.toLocaleString()}</span>
                      </div>
                    </div>
                    {channelInfo.thumbnail && (
                      <img
                        src={channelInfo.thumbnail}
                        alt={channelInfo.channelTitle}
                        className="w-20 h-20 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {status === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-700 font-medium">{errorMessage}</span>
              </div>
            </div>
          )}

          {status === "success" && channelInfo && (
            <div className="mt-6 flex justify-end gap-3">
              <a
                href={`https://www.youtube.com/channel/${channelInfo.channelId}`}
                className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Go to YouTube Channel
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
