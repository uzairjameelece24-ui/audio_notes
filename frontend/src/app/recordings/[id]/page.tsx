"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  RefreshCw,
  Clock,
  FileAudio,
} from "lucide-react";
import { RecordingDetail } from "@/types";
import { fetchRecordingDetail, retryRecording, ApiClientError } from "@/lib/api";
import StatusStepper from "@/components/StatusStepper";
import TranscriptCard from "@/components/TranscriptCard";
import SummaryCard from "@/components/SummaryCard";

const POLL_INTERVAL_MS = 3000;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${["B", "KB", "MB", "GB"][i]}`;
}

function formatDuration(sec: number | null): string {
  if (sec === null) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RecordingDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [recording, setRecording] = useState<RecordingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(
    async (background = false) => {
      if (!background) setIsLoading(true);
      setError(null);
      try {
        const data = await fetchRecordingDetail(id);
        setRecording(data);
      } catch (err: any) {
        if (!background) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Could not load recording. Please refresh."
          );
        }
      } finally {
        if (!background) setIsLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const isActive =
      recording?.status === "PROCESSING" ||
      recording?.status === "QUEUED" ||
      recording?.status === "UPLOADING";

    if (isActive) {
      pollRef.current = setInterval(() => load(true), POLL_INTERVAL_MS);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [recording?.status, load]);

  const handleRetry = async () => {
    if (!recording) return;
    setIsRetrying(true);
    try {
      await retryRecording(id);
      await load(true);
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setIsRetrying(false);
    }
  };

  // Loading Skeleton
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-slate-200 rounded-full" />
        <div className="bg-white rounded-3xl h-64 border border-slate-200" />
        <div className="bg-white rounded-3xl h-48 border border-slate-200" />
      </div>
    );
  }

  // Error state
  if (error || !recording) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <div className="w-14 h-14 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
          <AlertCircle className="w-7 h-7" />
        </div>
        <p className="text-base font-bold text-rose-900">
          {error || "Recording not found."}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => load()}
            className="px-5 py-2.5 rounded-full text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2 transition-colors shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isActive =
    recording.status === "PROCESSING" ||
    recording.status === "QUEUED" ||
    recording.status === "UPLOADING";
  const isFailed = recording.status === "FAILED";
  const isCompleted = recording.status === "COMPLETED";

  return (
    <div className="space-y-6 pb-12">
      {/* Back nav + meta bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-semibold transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          All Recordings
        </Link>

        {/* Meta chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-medium text-slate-600">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm">
            <FileAudio className="w-3.5 h-3.5 text-orange-600" />
            {recording.language_code}
          </span>
          {recording.duration_sec !== null && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              {formatDuration(recording.duration_sec)}
            </span>
          )}
          <span className="px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm">
            {formatBytes(recording.size_bytes)}
          </span>
        </div>
      </div>

      {/* Active job stepper */}
      {isActive && (
        <StatusStepper
          status={recording.status}
          stage={recording.stage}
          progress={recording.progress}
          createdAt={recording.created_at}
          filename={recording.filename}
        />
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="bg-rose-50 border border-rose-200 shadow-xl rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-rose-950">
                  Processing Failed
                </h2>
                {recording.error_message && (
                  <p className="text-xs sm:text-sm text-rose-800 mt-1 leading-relaxed">
                    {recording.error_message}
                  </p>
                )}
                {recording.error_code && (
                  <p className="text-[11px] font-mono text-rose-700 mt-2 uppercase tracking-wider font-bold">
                    Error Code: {recording.error_code}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-6 py-3 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 transition-all disabled:opacity-60 shrink-0 shadow-md"
            >
              {isRetrying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isRetrying ? "Re-queuing..." : "Retry Processing"}
            </button>
          </div>
        </div>
      )}

      {/* Completed state: summary + transcript */}
      {isCompleted && (
        <>
          <SummaryCard
            summary={recording.summary_json}
            summaryStatus={recording.summary_status}
            languageCode={recording.language_code}
            onRetrySummary={
              recording.summary_status === "FAILED" ? handleRetry : undefined
            }
            isRetrying={isRetrying}
          />

          {recording.transcript_status !== "PENDING" && (
            <TranscriptCard
              transcriptText={recording.transcript_text}
              segments={recording.segments}
              transcriptStatus={recording.transcript_status}
              filename={recording.filename}
              onRetryPartial={
                recording.transcript_status === "PARTIAL"
                  ? handleRetry
                  : undefined
              }
              isRetrying={isRetrying}
            />
          )}
        </>
      )}

      {/* Polling Indicator */}
      {isActive && (
        <p className="text-center text-xs text-slate-500 font-mono font-medium flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
          Polling every {POLL_INTERVAL_MS / 1000}s — page updates automatically
        </p>
      )}
    </div>
  );
}
