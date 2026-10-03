"use client";

import { WifiOff, RefreshCw } from "lucide-react";

interface ConnectionBannerProps {
  retryInSec: number;
  onRetryNow?: () => void;
}

export default function ConnectionBanner({ retryInSec, onRetryNow }: ConnectionBannerProps) {
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-fade-in">
      <div className="rounded-xl bg-amber-500/90 text-slate-950 px-4 py-2.5 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 text-xs font-semibold">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
          <span>Connection lost. Retrying in {retryInSec}s...</span>
        </div>

        {onRetryNow && (
          <button
            type="button"
            onClick={onRetryNow}
            className="px-2.5 py-1 rounded-lg bg-slate-950/20 hover:bg-slate-950/30 text-slate-950 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry now</span>
          </button>
        )}
      </div>
    </div>
  );
}
