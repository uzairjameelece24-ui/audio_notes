"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { 
  FileAudio, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  ChevronRight, 
  RefreshCw
} from "lucide-react";
import { RecordingListItem, RecordingStatus } from "@/types";
import { fetchRecordings, deleteRecording } from "@/lib/api";

function formatDuration(sec: number | null): string {
  if (sec === null || sec === undefined) return "--:--";
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function StatusBadge({ status, stage }: { status: RecordingStatus; stage?: string | null }) {
  switch (status) {
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Completed
        </span>
      );
    case "PROCESSING":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
          {stage ? `Processing: ${stage}` : "Processing"}
        </span>
      );
    case "QUEUED":
    case "UPLOADING":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Queued
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono text-slate-600 bg-slate-100">
          {status}
        </span>
      );
  }
}

export default function RecordingList() {
  const [recordings, setRecordings] = useState<RecordingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadRecordings = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      const data = await fetchRecordings();
      setRecordings(data);
    } catch (err: any) {
      if (!isBackground) {
        setError(err.message || "Failed to fetch recording history.");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  // Set up smart polling every 4s if any recording is active
  useEffect(() => {
    const hasActiveJobs = recordings.some(
      (r) => r.status === "PROCESSING" || r.status === "QUEUED" || r.status === "UPLOADING"
    );

    if (hasActiveJobs) {
      pollIntervalRef.current = setInterval(() => {
        loadRecordings(true);
      }, 4000);
    } else if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [recordings, loadRecordings]);

  const handleDeleteConfirm = async () => {
    if (!deleteModalId) return;
    setIsDeleting(true);
    try {
      await deleteRecording(deleteModalId);
      setRecordings((prev) => prev.filter((r) => r.id !== deleteModalId));
      setDeleteModalId(null);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight font-sans">Your Recordings</h3>
          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {recordings.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => loadRecordings(false)}
          disabled={isRefreshing}
          className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50"
          title="Refresh recordings"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-orange-600" : ""}`} />
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => loadRecordings(false)}
            className="underline font-bold hover:text-rose-950"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-5 border border-slate-200 animate-pulse flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-100" />
                <div className="space-y-2">
                  <div className="w-48 h-3.5 bg-slate-100 rounded" />
                  <div className="w-24 h-2.5 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="w-20 h-6 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : recordings.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-lg">
          <div className="w-14 h-14 mx-auto rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 mb-3">
            <FileAudio className="w-7 h-7" />
          </div>
          <p className="text-base font-bold text-slate-900">No recordings stored yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-medium">
            Upload an audio file above to split, transcribe, and summarize automatically.
          </p>
        </div>
      ) : (
        /* Recording Cards List */
        <div className="grid gap-3">
          {recordings.map((rec) => (
            <div
              key={rec.id}
              className="bg-white hover:bg-slate-50/80 transition-all rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group border border-slate-200/80 shadow-sm hover:shadow-md"
            >
              <Link
                href={`/recordings/${rec.id}`}
                className="flex-1 flex items-center gap-3.5 min-w-0"
              >
                <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 group-hover:bg-orange-50 group-hover:border-orange-200 group-hover:text-orange-600 transition-colors shrink-0">
                  <FileAudio className="w-5 h-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-orange-600 transition-colors">
                      {rec.title || rec.filename}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap font-mono font-medium">
                    <span className="text-orange-700 font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                      {rec.language_code}
                    </span>
                    <span>&bull;</span>
                    <span>{formatDuration(rec.duration_sec)}</span>
                    <span>&bull;</span>
                    <span className="font-sans text-slate-400">{timeAgo(rec.created_at)}</span>
                  </div>
                </div>
              </Link>

              {/* Status and Action Buttons */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <StatusBadge status={rec.status} stage={rec.stage} />

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDeleteModalId(rec.id)}
                    className="p-2 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete recording"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <Link
                    href={`/recordings/${rec.id}`}
                    className="p-2 rounded-full text-slate-400 group-hover:text-slate-900 group-hover:bg-slate-100 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white max-w-md w-full rounded-3xl p-7 border border-slate-200 shadow-2xl space-y-4">
            <h4 className="text-lg font-bold text-slate-900">Delete Recording?</h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              This will permanently delete the recording, audio file storage, transcription, and generated summary. This action cannot be undone.
            </p>
            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalId(null)}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1.5 shadow-md"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete Recording
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
