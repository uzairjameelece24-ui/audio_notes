"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileAudio, AlertCircle, X, ArrowRight, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { uploadAudioFile, UploadProgressEvent, ApiClientError } from "@/lib/api";

const SUPPORTED_LANGUAGES = [
  { code: "en-IN", label: "English (India)" },
  { code: "hi-IN", label: "Hindi (हिंदी)" },
  { code: "bn-IN", label: "Bengali (বাংলা)" },
  { code: "gu-IN", label: "Gujarati (ગુજરાતી)" },
  { code: "kn-IN", label: "Kannada (<ctrl42>ನ್ನಡ)" },
  { code: "ml-IN", label: "Malayalam (മലയാളം)" },
  { code: "mr-IN", label: "Marathi (मराठी)" },
  { code: "pa-IN", label: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "ta-IN", label: "Tamil (தமிழ்)" },
  { code: "te-IN", label: "Telugu (తెలుగు)" },
];

const ALLOWED_EXTENSIONS = [".wav", ".mp3", ".ogg", ".flac", ".aac", ".m4a"];
const MAX_UPLOAD_MB = 500;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface UploadCardProps {
  onUploadSuccess?: (recordingId: string) => void;
}

export default function UploadCard({ onUploadSuccess }: UploadCardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [languageCode, setLanguageCode] = useState<string>("en-IN");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<"init" | "uploading" | "completing" | null>(null);
  const [progress, setProgress] = useState<UploadProgressEvent>({ loaded: 0, total: 0, percent: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const validateFile = (file: File): boolean => {
    setErrorMessage(null);
    setErrorCode(null);

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setErrorMessage(`Unsupported file format '${ext}'. Please upload ${ALLOWED_EXTENSIONS.join(", ")}`);
      setErrorCode("INVALID_FILE_TYPE");
      return false;
    }

    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setErrorMessage(`File size (${formatBytes(file.size)}) exceeds maximum limit of ${MAX_UPLOAD_MB} MB.`);
      setErrorCode("FILE_TOO_LARGE");
      return false;
    }

    if (file.size === 0) {
      setErrorMessage("The selected file is empty (0 bytes).");
      setErrorCode("EMPTY_FILE");
      return false;
    }

    return true;
  };

  const handleFileSelection = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMessage(null);
    setErrorCode(null);
    setProgress({ loaded: 0, total: selectedFile.size, percent: 0 });

    abortControllerRef.current = new AbortController();

    try {
      const recordingId = await uploadAudioFile({
        file: selectedFile,
        languageCode,
        onProgress: (p) => setProgress(p),
        onStageChange: (s) => setUploadStage(s),
        signal: abortControllerRef.current.signal
      });

      if (onUploadSuccess) {
        onUploadSuccess(recordingId);
      }
      router.push(`/recordings/${recordingId}`);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        if (err.code === "UPLOAD_CANCELLED" || err.code === "UPLOAD_ABORTED") {
          setIsUploading(false);
          setUploadStage(null);
          return;
        }
        setErrorMessage(err.message);
        setErrorCode(err.code);
      } else {
        setErrorMessage(err.message || "An unexpected error occurred during upload.");
        setErrorCode("UPLOAD_ERROR");
      }
      setIsUploading(false);
      setUploadStage(null);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsUploading(false);
    setUploadStage(null);
  };

  const handleClearSelected = () => {
    setSelectedFile(null);
    setErrorMessage(null);
    setErrorCode(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 shadow-2xl rounded-3xl p-6 sm:p-8 relative overflow-hidden">
      {/* Top Header & Language Dropdown (Matching Gnani.ai screenshot!) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-widest text-orange-600 font-bold">
              Gnani STT Engine
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
            Upload Audio Recording
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Handles audio of any duration &bull; Silence-aware splitting &bull; Groq LLM Summaries
          </p>
        </div>

        {/* Language Selector Dropdown (Exact visual match to Gnani.ai screenshot right box!) */}
        <div className="flex items-center gap-2">
          <label htmlFor="language-select" className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Language:
          </label>
          <select
            id="language-select"
            value={languageCode}
            onChange={(e) => setLanguageCode(e.target.value)}
            disabled={isUploading}
            className="bg-white text-slate-800 text-xs sm:text-sm font-semibold rounded-xl px-4 py-2 border border-slate-200 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Upload Drop Zone / Active File View */}
      <div className="mt-6">
        {!selectedFile ? (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-orange-500 bg-orange-50/60 scale-[0.99]"
                : "border-slate-200 hover:border-orange-400 bg-gradient-to-b from-orange-50/30 via-amber-50/10 to-white"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.ogg,.flac,.aac,.m4a,audio/*"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileSelection(e.target.files[0]);
                }
              }}
            />
            <div className="w-14 h-14 mx-auto rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 mb-3 shadow-sm">
              <UploadCloud className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              Drag &amp; drop audio file here, or <span className="text-orange-600 underline underline-offset-2">browse computer</span>
            </p>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Supports WAV, MP3, OGG, FLAC, AAC, M4A up to 500 MB (any duration)
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-700 font-bold">
                  <FileAudio className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 truncate max-w-[280px] sm:max-w-md">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    {formatBytes(selectedFile.size)} &bull; {selectedFile.type || "audio/wav"}
                  </p>
                </div>
              </div>

              {!isUploading && (
                <button
                  type="button"
                  onClick={handleClearSelected}
                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-full hover:bg-slate-200/60 transition-colors"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Upload Progress Bar and Stage Feedback */}
            {isUploading && (
              <div className="mt-5 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
                    <span>
                      {uploadStage === "init" && "Initializing upload session..."}
                      {uploadStage === "uploading" && "Uploading to storage bucket..."}
                      {uploadStage === "completing" && "Finalizing & enqueuing background job..."}
                    </span>
                  </div>
                  <span className="font-mono text-orange-600">{progress.percent}%</span>
                </div>

                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-200"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-mono">
                  <span>{formatBytes(progress.loaded)} of {formatBytes(progress.total)}</span>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="text-rose-600 hover:text-rose-700 font-sans text-xs font-semibold underline underline-offset-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold text-rose-900">{errorMessage}</p>
              {errorCode && (
                <p className="text-[10px] font-mono text-rose-700 mt-1 uppercase">Error Code: {errorCode}</p>
              )}
            </div>
            {selectedFile && !isUploading && (
              <button
                type="button"
                onClick={handleStartUpload}
                className="px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-semibold flex items-center gap-1 hover:bg-rose-700 transition-colors shadow-sm"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        )}

        {/* Upload Action Button */}
        {selectedFile && !isUploading && (
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClearSelected}
              className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Choose Another File
            </button>
            <button
              type="button"
              onClick={handleStartUpload}
              className="px-6 py-3 rounded-full text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/10 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Transcribe &amp; Summarize</span>
              <ArrowRight className="w-4 h-4 text-orange-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
