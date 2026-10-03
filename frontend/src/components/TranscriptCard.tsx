"use client";

import { useState } from "react";
import { FileText, Copy, Download, Check, AlertTriangle, RefreshCw } from "lucide-react";
import { TimedSegment, TranscriptStatus } from "@/types";

interface TranscriptCardProps {
  transcriptText: string | null;
  segments: TimedSegment[];
  transcriptStatus: TranscriptStatus;
  filename: string;
  onRetryPartial?: () => void;
  isRetrying?: boolean;
}

function formatSec(sec: number): string {
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TranscriptCard({
  transcriptText,
  segments,
  transcriptStatus,
  filename,
  onRetryPartial,
  isRetrying = false,
}: TranscriptCardProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"segments" | "text">("segments");

  const handleCopyText = () => {
    if (!transcriptText) return;
    navigator.clipboard.writeText(transcriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!transcriptText) return;
    const blob = new Blob([transcriptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const baseName = filename.replace(/\.[^/.]+$/, "");
    link.download = `${baseName}_transcript.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-slate-200/80 shadow-2xl rounded-3xl p-6 sm:p-8 mt-6 relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900 font-bold shadow-sm">
            <FileText className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <h3 className="text-xl font-serif-heading font-normal text-slate-900 tracking-tight">Audio Transcript</h3>
            <p className="text-xs font-mono text-slate-500 mt-0.5">
              {segments.length} segment{segments.length === 1 ? "" : "s"} &bull; Gnani STT Engine
            </p>
          </div>
        </div>

        {/* Action buttons & View toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-100 p-1 rounded-full border border-slate-200 flex text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("segments")}
              className={`px-3.5 py-1 rounded-full transition-all ${
                viewMode === "segments"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Timed Segments
            </button>
            <button
              type="button"
              onClick={() => setViewMode("text")}
              className={`px-3.5 py-1 rounded-full transition-all ${
                viewMode === "text"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Full Text
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyText}
            className="px-4 py-2 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="px-4 py-2 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download .txt</span>
          </button>
        </div>
      </div>

      {/* Partial failure warning banner */}
      {transcriptStatus === "PARTIAL" && (
        <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 font-medium">
              <span className="font-bold">Partial Transcription:</span> One or more chunks failed due to ASR timeouts or network limits.
            </p>
          </div>

          {onRetryPartial && (
            <button
              type="button"
              onClick={onRetryPartial}
              disabled={isRetrying}
              className="px-3.5 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying ? "animate-spin" : ""}`} />
              <span>{isRetrying ? "Retrying..." : "Retry Failed Parts"}</span>
            </button>
          )}
        </div>
      )}

      {/* Transcript Body */}
      <div className="mt-6">
        {viewMode === "segments" ? (
          <div className="space-y-3">
            {segments.map((seg) => {
              const isFailed = seg.status === "FAILED";

              return (
                <div
                  key={seg.idx}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-start gap-3.5 ${
                    isFailed
                      ? "bg-rose-50 border-rose-200"
                      : "bg-slate-50/70 border-slate-200/80 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-800 font-bold shadow-sm">
                      {formatSec(seg.start_sec)} &ndash; {formatSec(seg.end_sec)}
                    </span>
                  </div>

                  <div className="flex-1 text-xs sm:text-sm leading-relaxed text-slate-800">
                    {isFailed ? (
                      <span className="text-rose-600 italic font-mono">
                        [could not transcribe {formatSec(seg.start_sec)} &ndash; {formatSec(seg.end_sec)}]
                      </span>
                    ) : seg.text ? (
                      <span>{seg.text}</span>
                    ) : (
                      <span className="text-slate-400 italic">[Silence / no speech]</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 font-sans text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {transcriptText || "No transcript available."}
          </div>
        )}
      </div>
    </div>
  );
}
