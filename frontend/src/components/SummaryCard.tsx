"use client";

import { useState } from "react";
import { Sparkles, Check, Copy, AlertTriangle, RefreshCw, CheckCircle2, ListFilter } from "lucide-react";
import { SummaryContent, SummaryStatus } from "@/types";

interface SummaryCardProps {
  summary: SummaryContent | null;
  summaryStatus: SummaryStatus;
  languageCode: string;
  onRetrySummary?: () => void;
  isRetrying?: boolean;
}

export default function SummaryCard({
  summary,
  summaryStatus,
  languageCode,
  onRetrySummary,
  isRetrying = false,
}: SummaryCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopySummary = () => {
    if (!summary) return;
    const text = `# ${summary.title}\n\n**TL;DR:** ${summary.tldr}\n\n### Key Points:\n${summary.key_points
      .map((p) => `- ${p}`)
      .join("\n")}\n\n### Action Items:\n${summary.action_items
      .map((a) => `- [ ] ${a}`)
      .join("\n")}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Case 1: Summary Failed
  if (summaryStatus === "FAILED") {
    return (
      <div className="bg-amber-50 border border-amber-200 shadow-lg rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0 mt-0.5 font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-950">
                Summary Generation Incomplete
              </h3>
              <p className="text-xs sm:text-sm text-amber-800 mt-1">
                The transcript was generated successfully, but the Groq LLM summary encountered a timeout or rate limit.
              </p>
            </div>
          </div>

          {onRetrySummary && (
            <button
              type="button"
              onClick={onRetrySummary}
              disabled={isRetrying}
              className="px-4 py-2 rounded-full text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2 transition-all shrink-0 disabled:opacity-50 shadow-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
              <span>{isRetrying ? "Retrying..." : "Retry Summary"}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Case 2: Summary Pending
  if (summaryStatus === "PENDING" || !summary) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center animate-pulse shadow-xl">
        <Sparkles className="w-8 h-8 text-orange-500 mx-auto mb-3 animate-spin" />
        <p className="text-base font-bold text-slate-900">Generating Groq Executive Summary...</p>
        <p className="text-xs text-slate-500 mt-1">
          Extracting key discussion points, decisions, and action items.
        </p>
      </div>
    );
  }

  // Case 3: Summary Ready
  return (
    <div className="bg-white border border-slate-200/80 shadow-2xl rounded-3xl p-6 sm:p-8 relative overflow-hidden">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shrink-0 font-bold">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-widest text-orange-600 font-bold">
                Groq AI Executive Summary
              </span>
              {languageCode !== "en-IN" && (
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                  Source: {languageCode}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-serif-heading font-normal text-slate-900 mt-1 tracking-tight">
              {summary.title || "Audio Summary"}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopySummary}
          className="px-4 py-2 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center gap-1.5 transition-colors self-start shrink-0 shadow-sm"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-bold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Copy Summary</span>
            </>
          )}
        </button>
      </div>

      {/* TL;DR Callout Box */}
      {summary.tldr && (
        <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-orange-50/80 via-amber-50/50 to-orange-50/30 border border-orange-200/80 text-slate-800">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-orange-700 mb-1.5">
            Executive Summary / TL;DR
          </p>
          <p className="text-sm leading-relaxed text-slate-800 font-medium">{summary.tldr}</p>
        </div>
      )}

      {/* 2-Column Grid: Key Points & Action Items */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Key Points */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
            <ListFilter className="w-4 h-4 text-orange-600" />
            <span>Key Discussion Points</span>
          </div>

          <div className="space-y-2.5">
            {summary.key_points && summary.key_points.length > 0 ? (
              summary.key_points.map((point, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-start gap-3 text-xs sm:text-sm text-slate-800 leading-relaxed hover:border-slate-300 transition-colors"
                >
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-800 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{point}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">No key points extracted.</p>
            )}
          </div>
        </div>

        {/* Action Items */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Next Steps &amp; Action Items</span>
          </div>

          <div className="space-y-2.5">
            {summary.action_items && summary.action_items.length > 0 ? (
              summary.action_items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-start gap-3 text-xs sm:text-sm text-slate-800 leading-relaxed hover:border-slate-300 transition-colors"
                >
                  <div className="w-4 h-4 rounded-full border border-emerald-500 bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-700" />
                  </div>
                  <span>{item}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">No action items detected.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
