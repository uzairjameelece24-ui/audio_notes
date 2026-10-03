"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Circle, Clock, Cpu } from "lucide-react";
import { RecordingStatus, Stage, ProgressInfo } from "@/types";

interface StatusStepperProps {
  status: RecordingStatus;
  stage: Stage;
  progress: ProgressInfo;
  createdAt: string;
  filename: string;
}

const STEPS = [
  { key: "uploaded", label: "Uploaded", desc: "Saved to storage" },
  { key: "validating", label: "Validating", desc: "Format & duration check" },
  { key: "chunking", label: "Splitting", desc: "Silence-aware chunks (<=30s)" },
  { key: "transcribing", label: "Transcribing", desc: "Gnani STT parallel ASR" },
  { key: "summarizing", label: "Summarizing", desc: "Groq structured insights" },
  { key: "completed", label: "Done", desc: "Ready to inspect" },
];

function getStepIndex(status: RecordingStatus, stage: Stage): number {
  if (status === "COMPLETED") return 5;
  if (status === "QUEUED" || status === "UPLOADING") return 0;
  if (stage === "validating") return 1;
  if (stage === "chunking") return 2;
  if (stage === "transcribing") return 3;
  if (stage === "summarizing") return 4;
  return 0;
}

export default function StatusStepper({
  status,
  stage,
  progress,
  createdAt,
  filename,
}: StatusStepperProps) {
  const currentStepIdx = getStepIndex(status, stage);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  useEffect(() => {
    const startMs = new Date(createdAt).getTime();
    const updateTimer = () => {
      const nowMs = Date.now();
      setElapsedSec(Math.max(0, Math.floor((nowMs - startMs) / 1000)));
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [createdAt]);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const percentComplete =
    progress.chunks_total > 0
      ? Math.round((progress.chunks_done / progress.chunks_total) * 100)
      : 0;

  return (
    <div className="bg-white border border-slate-200/80 shadow-2xl rounded-3xl p-6 sm:p-8 relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-100">
        <div>
          <span className="text-xs uppercase font-mono tracking-widest text-orange-600 font-bold">
            Live Processing Pipeline
          </span>
          <h2 className="text-lg font-bold text-slate-900 truncate max-w-lg mt-0.5 font-sans">
            {filename}
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200 shrink-0">
          <Clock className="w-3.5 h-3.5 text-orange-600" />
          <span>Elapsed: {formatElapsed(elapsedSec)}</span>
        </div>
      </div>

      {/* Stepper Grid */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STEPS.map((step, idx) => {
          const isDone = currentStepIdx > idx || status === "COMPLETED";
          const isCurrent = currentStepIdx === idx && status !== "COMPLETED";

          return (
            <div
              key={step.key}
              className={`p-3.5 rounded-2xl border transition-all ${
                isCurrent
                  ? "bg-orange-50/80 border-orange-300 shadow-md shadow-orange-500/5"
                  : isDone
                  ? "bg-emerald-50/60 border-emerald-200 text-slate-800"
                  : "bg-slate-50/60 border-slate-200/60 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-orange-600 animate-spin shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                )}
                <span
                  className={`text-xs font-bold ${
                    isCurrent ? "text-orange-900" : isDone ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                {step.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Live Progress Bar for Transcribing */}
      {stage === "transcribing" && progress.chunks_total > 0 && (
        <div className="mt-6 p-4 rounded-2xl bg-orange-50/70 border border-orange-200 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-orange-950 mb-2">
            <span>Transcribing Segments in Parallel</span>
            <span className="font-mono text-orange-700">
              {progress.chunks_done} / {progress.chunks_total} chunks ({percentComplete}%)
            </span>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(5, percentComplete)}%` }}
            />
          </div>
        </div>
      )}

      {/* Summarizing State */}
      {stage === "summarizing" && (
        <div className="mt-6 p-4 rounded-2xl bg-slate-900 text-white flex items-center gap-3 animate-fade-in shadow-lg">
          <Cpu className="w-5 h-5 text-orange-400 animate-pulse shrink-0" />
          <p className="text-xs font-medium">
            Transcript stitched. Groq LLM is now extracting executive summaries, key discussion points, and action items...
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <p className="flex items-center gap-2 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Background worker is handling processing asynchronously &bull; Safe to leave tab
        </p>
      </div>
    </div>
  );
}
