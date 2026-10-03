import Link from "next/link";
import {
  ArrowLeft,
  Github,
  ExternalLink,
  Layers,
  ArrowRight,
  Database,
  Cpu,
  ShieldAlert,
  Clock,
  FileAudio,
  Radio,
  Sparkles,
  Server,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

export const metadata = {
  title: "Architecture & System Design | Audio Notes",
  description:
    "End-to-end technical architecture, audio pipeline specifications, chunking mechanics, and failure modes for Audio Notes.",
};

export default function ArchitecturePage() {
  const githubUrl =
    process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/uzairjameelece24-ui/audio_notes";

  return (
    <div className="space-y-12 pb-16 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Title */}
      <div className="space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-semibold transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Recordings
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/70 border border-orange-200 text-orange-800 text-xs font-mono font-bold tracking-wider uppercase mb-2">
              <Layers className="w-3.5 h-3.5 text-orange-600" />
              <span>Production Pipeline Specs</span>
            </div>
            <h1 className="font-serif-heading text-4xl sm:text-5xl text-slate-900 font-normal tracking-tight">
              System Architecture &amp; Pipeline Design
            </h1>
          </div>

          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-md flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] self-start sm:self-auto shrink-0"
          >
            <Github className="w-4 h-4" />
            <span>View Source Code</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>

        <p className="text-base text-slate-600 leading-relaxed max-w-3xl">
          An in-depth technical specification of the Audio Notes architecture. This document
          reflects strictly what is implemented in the codebase—covering direct S3 uploads,
          PostgreSQL queue concurrency, silence-aware audio chunking for Gnani Speech-to-Text,
          automated Groq LLM map-reduce summarization, and fine-grained failure recovery.
        </p>
      </div>

      {/* Section 1: Overview */}
      <section id="overview" className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-sans">
              1. Architecture Overview &amp; Infrastructure
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Component stack, runtime environments, and hosting boundaries
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed">
          The system separates browser interactions, API endpoints, background worker processing,
          and external cloud intelligence. Audio data never streams through the API server; files
          travel directly from the client browser to object storage using signed URLs.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase font-mono text-slate-800">Frontend Application</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">Node / Vercel</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Built with <strong>Next.js 14 (App Router)</strong>, React 18, TypeScript, and Tailwind CSS.
              Performs client-side file validation, initiates upload sessions, performs direct-to-S3 XHR uploads
              with byte-level progress reporting, and polls job status at 3-second intervals. Client identity is
              maintained via an anonymous UUID stored in browser <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">localStorage</code> and transmitted via the <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">X-Client-Id</code> header.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase font-mono text-slate-800">Backend API</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">FastAPI / Railway / Docker</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Built with <strong>FastAPI (Python 3.12)</strong> and Uvicorn. Containerized via Dockerfile.
              Issues S3 presigned PUT URLs via <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">boto3</code>, verifies file presence on upload completion with S3 HEAD requests,
              exposes query and retry endpoints, and enqueues tasks into the PostgreSQL job queue.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase font-mono text-slate-800">Asynchronous Worker</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">Python 3.12 / ThreadPool</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Runs <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">app/worker.py</code> in a background process. Claims queued tasks via atomic row locking,
              maintains a 15-second heartbeat thread, executes <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">ffmpeg</code> / <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">ffprobe</code> for silence detection and WAV normalization,
              and manages a <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">ThreadPoolExecutor</code> (concurrency of 3) for parallel chunk transcription.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase font-mono text-slate-800">Database &amp; Job Queue</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">PostgreSQL 16 (psycopg3)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Stores relational tables <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">recordings</code>, <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">chunks</code>, and <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">jobs</code>.
              The <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">jobs</code> table doubles as the message queue, utilizing <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">SELECT ... FOR UPDATE SKIP LOCKED</code> to safely
              dispatch tasks without Redis, and automatically recovers stale jobs if heartbeats lapse beyond 2 minutes.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase font-mono text-slate-800">Object Storage</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">S3 / S3Mock / Cloudflare R2</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              S3-compatible storage bucket (<code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">audio-notes</code>) running Adobe S3Mock locally on port 9090, or Cloudflare R2 / AWS S3 in production.
              Configured with CORS rules allowing direct browser <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">PUT</code> uploads.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase font-mono text-slate-800">AI Services (ASR &amp; LLM)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">Gnani STT v3 &amp; Groq Cloud</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Gnani STT:</strong> Hosted at <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">https://api.vachana.ai/stt/v3</code> with <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">X-API-Key-ID</code> header authentication (or local mock fallback).<br />
              <strong>Groq LLM:</strong> Hosted on Groq Cloud running model <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">qwen/qwen3.8-27b</code> with strict JSON mode enforcement.
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: Flow from Upload to Transcript */}
      <section id="flow" className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-sans">
              2. End-to-End Processing Flow
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Every step in sequence from browser audio selection to structured summary
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              1
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Client-Side File Selection &amp; Validation</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The user selects an audio file (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">.wav</code>, <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">.mp3</code>, <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">.ogg</code>, <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">.flac</code>, <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">.aac</code>, or <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">.m4a</code>) and specifies the spoken language code (e.g. <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">en-IN</code>, <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">hi-IN</code>). The browser verifies file extension, non-zero byte size, and that file size is strictly &le; 500 MB.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              2
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Upload Session Initialization (<code className="font-mono text-xs text-orange-700">POST /api/uploads/init</code>)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The browser requests an upload ticket by submitting filename, MIME type, file size, language code, and the client&apos;s <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">X-Client-Id</code>. The API verifies parameters, inserts a recording row into PostgreSQL with status <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">UPLOADING</code>, constructs the storage key <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">recordings/&#123;client_id&#125;/&#123;recording_id&#125;/&#123;filename&#125;</code>, and generates an S3 presigned PUT URL valid for 3,600 seconds.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              3
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Direct S3 PUT via Browser XHR</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The browser streams raw audio directly to the S3 bucket using an <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">XMLHttpRequest</code> PUT call. The API server does not touch file bytes, preventing network bottlenecks. Progress events (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">loaded / total</code>) drive the frontend upload progress bar.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              4
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Upload Finalization &amp; Job Enqueueing (<code className="font-mono text-xs text-orange-700">POST /api/uploads/&#123;id&#125;/complete</code>)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Upon upload completion, the browser alerts the API. The API executes an S3 <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">head_object()</code> call to confirm object arrival. Once verified, the recording status transitions to <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">QUEUED</code>, the stage is set to <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">validating</code>, and a job with <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">kind=process_recording</code> is inserted into PostgreSQL.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              5
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Worker Job Claim &amp; Heartbeat Initialization</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The worker executes <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">claim_next_job()</code> via <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">SELECT ... FOR UPDATE SKIP LOCKED</code>. The job status becomes <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">RUNNING</code>, and a daemon <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">HeartbeatThread</code> starts, touching <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">heartbeat_at</code> every 15 seconds to prevent stale-job reclamation.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              6
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Audio Retrieval, Probe &amp; Validation</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The worker creates an ephemeral directory (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">/tmp/audio_notes_&#123;id&#125;_*</code>) and downloads the audio from S3. It executes <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">ffprobe</code> to verify audio streams, sample rate, and format. It verifies that duration is &gt; 0.1 seconds and &le; 120 minutes (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">MAX_DURATION_MIN</code>). The recording stage updates to <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">chunking</code>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              7
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Normalization &amp; Silence-Aware Chunking</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The audio is normalized to 16kHz mono 16-bit PCM WAV using <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">ffmpeg -ar 16000 -ac 1 -c:a pcm_s16le</code>. Silent intervals are parsed using <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">silencedetect=noise=-30dB:d=0.3s</code>. The chunk planner calculates chunk boundary intervals (targeting 24s, min 18s, max 28s). All chunks are written to the <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">chunks</code> table as <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">PENDING</code>, and stage advances to <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">transcribing</code>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              8
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Parallel Chunk Transcription &amp; Incremental Database Commits</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pending chunks are processed in parallel across 3 worker threads. Each thread extracts its segment (clamped to &le; 28.5s) and sends it to the Gnani STT API with up to 4 retries. As each chunk returns, its status (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">DONE</code> or <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">FAILED</code>) and text are committed immediately to PostgreSQL, allowing the frontend progress bar to update in real time. Sliced chunk WAVs are immediately deleted from disk.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              9
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Transcript Stitching &amp; Assessment</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The worker gathers chunks ordered by index. Failed chunks are inserted as <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">[could not transcribe M:SS-M:SS]</code>. If at least one chunk succeeded, transcript status becomes <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">PARTIAL</code> (if any failed) or <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">DONE</code>, and stage advances to <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">summarizing</code>. If all chunks failed or no speech was detected, the recording fails.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              10
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Structured LLM Summarization &amp; Completion</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The stitched transcript is passed to the Groq LLM (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">qwen/qwen3.8-27b</code>) with JSON mode to extract title, tldr, key points, and action items (using automated map-reduce if length exceeds 12,000 characters). The worker saves <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">summary_json</code>, sets recording status to <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">COMPLETED</code>, marks the job <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">DONE</code>, deletes the temporary directory, and stops the heartbeat thread.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Where files live */}
      <section id="storage" className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-sans">
              3. Data Storage &amp; Lifecycle
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Physical locations and lifetimes of audio assets, transcripts, and metadata
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-mono uppercase text-[11px]">
                <th className="pb-3 pr-4 font-bold">Artifact</th>
                <th className="pb-3 pr-4 font-bold">Storage Location</th>
                <th className="pb-3 pr-4 font-bold">Format / Schema</th>
                <th className="pb-3 font-bold">Persistence Lifecycle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Original Audio File</td>
                <td className="py-3 pr-4 font-mono text-[11px]">S3 Bucket: audio-notes<br /><span className="text-slate-400">recordings/&#123;cid&#125;/&#123;id&#125;/&#123;filename&#125;</span></td>
                <td className="py-3 pr-4">Original user encoding (WAV, MP3, OGG, FLAC, AAC, M4A)</td>
                <td className="py-3">Persistent until explicitly deleted via <code className="font-mono text-[11px]">DELETE /api/recordings/&#123;id&#125;</code>.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Temporary Chunks &amp; Normalized WAV</td>
                <td className="py-3 pr-4 font-mono text-[11px]">Worker Local Disk<br /><span className="text-slate-400">/tmp/audio_notes_&#123;id&#125;_*/</span></td>
                <td className="py-3 pr-4">16kHz Mono 16-bit PCM WAV (<code className="font-mono text-[11px]">pcm_s16le</code>)</td>
                <td className="py-3">Ephemeral. Sliced chunk WAVs deleted immediately after ASR dispatch. Entire directory unlinked on job completion or failure. Never uploaded to S3.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Chunk Transcripts &amp; Timestamps</td>
                <td className="py-3 pr-4 font-mono text-[11px]">PostgreSQL Table: chunks</td>
                <td className="py-3 pr-4 font-mono text-[11px]">idx, start_sec, end_sec, status, text, attempts, error</td>
                <td className="py-3">Persistent in PostgreSQL. Cascades on recording deletion.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Stitched Full Transcript</td>
                <td className="py-3 pr-4 font-mono text-[11px]">PostgreSQL: recordings.transcript_text</td>
                <td className="py-3 pr-4">UTF-8 Text (chunks joined by double newlines)</td>
                <td className="py-3">Persistent. Includes timestamped markers for any un-transcribed segments.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Structured Summary</td>
                <td className="py-3 pr-4 font-mono text-[11px]">PostgreSQL: recordings.summary_json</td>
                <td className="py-3 pr-4 font-mono text-[11px]">JSON: &#123;title, tldr, key_points[], action_items[]&#125;</td>
                <td className="py-3">Persistent. Generated by Groq LLM or mock fallback.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Jobs &amp; Heartbeat State</td>
                <td className="py-3 pr-4 font-mono text-[11px]">PostgreSQL Table: jobs</td>
                <td className="py-3 pr-4 font-mono text-[11px]">kind, status, attempts, locked_at, heartbeat_at, run_at</td>
                <td className="py-3">Retained for worker execution and auditing. Stale locks cleared automatically after 2 minutes.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 4: How long audio is handled */}
      <section id="long-audio" className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-700">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-sans">
              4. Handling Long Audio &amp; Chunking Mechanics
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Overcoming Gnani STT&apos;s 30-second constraint with silence-aware partitioning
            </p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
          <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200/70 space-y-2">
            <h3 className="font-bold text-xs uppercase font-mono text-orange-900">
              The Gnani ASR Constraint &amp; Configured Chunk Sizes
            </h3>
            <p className="text-xs text-orange-950/80 leading-relaxed">
              Gnani STT v3 (<code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-orange-200">https://api.vachana.ai/stt/v3</code>) enforces a hard limit of <strong>30 seconds</strong> per request. Submitting audio beyond 30 seconds triggers HTTP 400 rejection.
              To guarantee requests never violate this boundary, the pipeline configures:
            </p>
            <ul className="text-xs list-disc list-inside space-y-1 font-mono text-orange-900">
              <li><strong>Target Chunk Size (<code className="text-[11px]">CHUNK_TARGET_SEC</code>):</strong> 24.0 seconds</li>
              <li><strong>Minimum Chunk Size (<code className="text-[11px]">CHUNK_MIN_SEC</code>):</strong> 18.0 seconds</li>
              <li><strong>Maximum Chunk Size (<code className="text-[11px]">CHUNK_MAX_SEC</code>):</strong> 28.0 seconds</li>
              <li><strong>Hard Extraction Clamp:</strong> In <code className="text-[11px]">extract_chunk_file()</code>, duration is clamped to <code className="text-[11px]">min(end_sec - start_sec, 28.5)</code> with <code className="text-[11px]">pcm_s16le</code> encoding, ensuring container headers or floating-point rounding never exceed 30 seconds.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Silence Cut Point Selection Algorithm</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Instead of slicing audio at fixed intervals (which cuts mid-syllable and degrades speech recognition), the pipeline runs <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">ffmpeg -af silencedetect=noise=-30.0dB:d=0.3</code> over the normalized audio. For each chunk starting at <code className="font-mono text-[11px]">current_start</code>:
            </p>
            <ol className="text-xs list-decimal list-inside space-y-1.5 text-slate-600 pl-2">
              <li>If the remaining audio is &le; 28.0 seconds, it is taken as the final chunk.</li>
              <li>Otherwise, the planner opens a candidate window from <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">current_start + 18.0s</code> to <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">current_start + 28.0s</code>.</li>
              <li>It searches for detected silence intervals falling within or overlapping this window.</li>
              <li>From the candidates, it picks the silence midpoint closest to the target cut point (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">current_start + 24.0s</code>).</li>
              <li>If no silence exists within the window, it executes a hard cut at <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">current_start + 28.0s</code>.</li>
              <li>This guarantees 100% audio coverage with 0 gaps or overlaps across the entire recording.</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
              <h4 className="font-bold text-xs uppercase font-mono text-slate-800">Concurrency &amp; Per-Chunk Commits</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Transcription tasks are executed in parallel using a Python <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">ThreadPoolExecutor</code> with concurrency capped at 3 (<code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">WORKER_CONCURRENCY=3</code>). As each thread completes, it immediately commits its chunk status and transcript to PostgreSQL. Progress is updated incrementally rather than in one final batch.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
              <h4 className="font-bold text-xs uppercase font-mono text-slate-800">Exponential Backoff &amp; Stitching</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Each chunk performs up to 4 retries for transient errors (HTTP 429, 5xx, timeouts) using exponential backoff with full jitter (<code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">(1.5^attempt) + random.uniform(0.1, 0.8)</code>). Chunks are sorted by index and stitched with double newlines. Any failed segments are marked with timestamp placeholders (e.g. <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">[could not transcribe 0:48-1:12]</code>), allowing partial transcript inspection.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200 text-xs text-slate-600 space-y-1">
            <span className="font-bold text-slate-800 font-mono uppercase text-[11px]">Why the Batch API was not used</span>
            <p className="leading-relaxed">
              Gnani STT v3 is an interactive REST endpoint returning transcripts synchronously in milliseconds for short chunks. A batch API requires asynchronous webhooks (demanding public callback URLs and webhook listener infrastructure) or polling a batch queue with high turnaround latencies. Parallel synchronous chunking provides instant chunk-by-chunk progress for users, fault isolation so one corrupt segment does not fail the entire recording, and granular retry capability.
            </p>
          </div>
        </div>
      </section>

      {/* Section 5: Sync vs Background */}
      <section id="sync-vs-bg" className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-sans">
              5. Synchronous API vs. Asynchronous Worker Execution
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Clear demarcation of request-response operations vs. worker queue tasks
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Synchronous (FastAPI Request Cycle)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              These operations execute within client HTTP requests and respond in milliseconds:
            </p>
            <ul className="text-xs space-y-2 text-slate-700">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span><strong>Payload Validation:</strong> Validating file extension, MIME type, size limit (&le; 500 MB), and supported language code.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span><strong>Presigned URL Generation:</strong> Signing S3v4 PUT URLs with 1-hour expiry.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span><strong>S3 Object Verification:</strong> Running <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">s3.head_object()</code> on complete to ensure file exists in storage before queueing.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span><strong>Job Enqueueing:</strong> Inserting initial records into <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">recordings</code> and <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">jobs</code> with status <code className="font-mono text-[11px]">QUEUED</code>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span><strong>Status Queries &amp; Deletions:</strong> Returning recording status, progress counts, transcript, summary, and deleting S3 objects and database rows upon request.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span><strong>Retry Scheduling:</strong> Resetting failed chunk/summary statuses and inserting new queued jobs.</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-800 text-xs font-mono font-bold">
              <Cpu className="w-3.5 h-3.5" />
              <span>Asynchronous (Background Worker Process)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              These long-running, CPU-intensive operations execute off the HTTP path in <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">app/worker.py</code>:
            </p>
            <ul className="text-xs space-y-2 text-slate-700">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
                <span><strong>Job Claiming &amp; Lock Recovery:</strong> Claiming jobs using row-level locking (<code className="font-mono text-[11px]">SKIP LOCKED</code>) and recovering stale tasks whose heartbeat &gt; 2 min.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
                <span><strong>Heartbeat Thread:</strong> Maintaining a background thread updating <code className="font-mono text-[11px]">heartbeat_at</code> every 15s during execution.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
                <span><strong>Media I/O:</strong> Downloading audio from S3 bucket to local temp storage.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
                <span><strong>FFmpeg Processing:</strong> Probing stream metadata, normalizing to 16kHz mono WAV, and detecting silence.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
                <span><strong>Parallel ASR Dispatch:</strong> Slicing chunk WAVs and sending requests to Gnani STT API across 3 worker threads.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
                <span><strong>Groq LLM Summarization:</strong> Calling Groq API with JSON mode (including map-reduce for &gt; 12,000 characters).</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section 6: Progress */}
      <section id="progress" className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-cyan-100 flex items-center justify-center text-cyan-700">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-sans">
              6. Progress Tracking &amp; Polling Architecture
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Real-time progress calculation and frontend polling intervals
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
          <p>
            Progress is tracked at the database level and communicated to the frontend via HTTP polling:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
              <span className="font-bold text-slate-900 uppercase font-mono text-[11px]">Backend Progress Calculation</span>
              <p className="text-slate-600 leading-relaxed">
                When <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">GET /api/recordings/&#123;id&#125;</code> is called, the endpoint queries the database:
              </p>
              <div className="p-3 bg-slate-900 text-slate-200 font-mono text-[11px] rounded-xl space-y-1">
                <div>chunks_total = len(chunks)</div>
                <div>chunks_done = sum(1 for c in chunks if c.status == &quot;DONE&quot;)</div>
                <div className="text-orange-400">progress = &#123; chunks_done, chunks_total &#125;</div>
              </div>
              <p className="text-slate-600 leading-relaxed">
                The recording state also reports the current stage: <code className="font-mono text-[11px]">validating</code> &rarr; <code className="font-mono text-[11px]">chunking</code> &rarr; <code className="font-mono text-[11px]">transcribing</code> &rarr; <code className="font-mono text-[11px]">summarizing</code>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
              <span className="font-bold text-slate-900 uppercase font-mono text-[11px]">Frontend Stepper &amp; Polling Loop</span>
              <p className="text-slate-600 leading-relaxed">
                The recording detail page (<code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">frontend/src/app/recordings/[id]/page.tsx</code>) polls the API:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li><strong>Poll Interval:</strong> Exactly <strong>3,000 ms (3 seconds)</strong> via <code className="font-mono text-[11px]">POLL_INTERVAL_MS = 3000</code>.</li>
                <li><strong>Active Polling Condition:</strong> Active while status is <code className="font-mono text-[11px]">UPLOADING</code>, <code className="font-mono text-[11px]">QUEUED</code>, or <code className="font-mono text-[11px]">PROCESSING</code>.</li>
                <li><strong>Automatic Cessation:</strong> Polling timer is cleared immediately when recording transitions to <code className="font-mono text-[11px]">COMPLETED</code> or <code className="font-mono text-[11px]">FAILED</code>.</li>
                <li><strong>Percentage Display:</strong> Progress percentage is rendered as <code className="font-mono text-[11px]">Math.round((chunks_done / chunks_total) * 100)</code> with an animated progress bar.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Section 7: Failure Handling */}
      <section id="failure-handling" className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-700">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-sans">
              7. Failure Handling &amp; Edge Cases
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Complete matrix of error conditions, user interface states, and automated system recovery
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-mono uppercase text-[11px]">
                <th className="pb-3 pr-4 font-bold">Failure Scenario</th>
                <th className="pb-3 pr-4 font-bold">What the User Sees</th>
                <th className="pb-3 font-bold">What the System Does</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Browser Direct S3 Upload Fails / Aborted</td>
                <td className="py-3 pr-4 text-rose-700 font-medium">Upload error banner with retry button. Error code <code className="font-mono text-[11px]">S3_UPLOAD_FAILED</code> or <code className="font-mono text-[11px]">S3_NETWORK_ERROR</code>.</td>
                <td className="py-3">XHR aborts; no worker job is ever queued; partial S3 upload will be overwritten if retried.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Missing S3 Object on Complete</td>
                <td className="py-3 pr-4 text-rose-700 font-medium">HTTP 409 Conflict: &quot;Uploaded audio object could not be found in storage.&quot; Error code <code className="font-mono text-[11px]">UPLOAD_MISSING</code>.</td>
                <td className="py-3"><code className="font-mono text-[11px]">s3_client.head_object()</code> returns None. The API rejects the completion call and prevents queueing phantom jobs.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Corrupt or Unreadable Audio File</td>
                <td className="py-3 pr-4 text-rose-700 font-medium">Status card: &quot;Processing Failed&quot;. Error Code: <code className="font-mono text-[11px]">CORRUPT_AUDIO</code> or <code className="font-mono text-[11px]">INVALID_AUDIO</code>.</td>
                <td className="py-3"><code className="font-mono text-[11px]">ffprobe</code> or <code className="font-mono text-[11px]">ffmpeg</code> returns non-zero exit code. Recording status is marked <code className="font-mono text-[11px]">FAILED</code>. Job marked <code className="font-mono text-[11px]">FAILED</code> with diagnostic error. Temp directory cleaned up.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Audio Exceeds Duration Limit (&gt; 120 min)</td>
                <td className="py-3 pr-4 text-rose-700 font-medium">Status card: &quot;Audio duration (X min) exceeds maximum limit of 120 minutes.&quot; Error Code: <code className="font-mono text-[11px]">TOO_LONG</code>.</td>
                <td className="py-3"><code className="font-mono text-[11px]">probe_audio()</code> calculates duration &gt; <code className="font-mono text-[11px]">MAX_DURATION_MIN * 60</code> and raises <code className="font-mono text-[11px]">AudioValidationError</code>. Processing halts; recording status set to <code className="font-mono text-[11px]">FAILED</code>.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Gnani ASR 403 Forbidden / Invalid Key / Depleted Credits</td>
                <td className="py-3 pr-4 text-rose-700 font-medium">Status card: &quot;Processing Failed&quot;. Error Code: <code className="font-mono text-[11px]">ASR_AUTH_OR_CREDITS</code>.</td>
                <td className="py-3">Gnani client catches HTTP 403 and immediately raises non-retryable <code className="font-mono text-[11px]">ASRAuthError</code>. Worker terminates further chunk calls, marks recording <code className="font-mono text-[11px]">FAILED</code>, and records error in database.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Gnani ASR 400 Bad Request</td>
                <td className="py-3 pr-4 text-rose-700 font-medium">Status card: &quot;Processing Failed&quot;. Error Code: <code className="font-mono text-[11px]">ASR_BAD_REQUEST</code>.</td>
                <td className="py-3">Non-retryable error raised immediately (<code className="font-mono text-[11px]">ASRBadRequestError</code>). Prevents wasteful retry loops against invalid parameters.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Gnani ASR 429 Rate Limit / 5xx Server Error / HTTP Timeout</td>
                <td className="py-3 pr-4 text-slate-600">Temporary delay in the transcribing progress bar.</td>
                <td className="py-3">Worker retries chunk up to 4 times with exponential backoff and random jitter (<code className="font-mono text-[11px]">1.5^attempt + jitter</code>). If all 4 retries fail, that specific chunk is marked <code className="font-mono text-[11px]">FAILED</code>.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Partial Chunk Transcription Failure (some chunks fail, some pass)</td>
                <td className="py-3 pr-4 text-slate-800">Recording completes! Transcript displays stitched text with <code className="font-mono text-[11px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">[could not transcribe M:SS-M:SS]</code> markers. Orange &quot;Partial Transcript&quot; banner with &quot;Retry Failed Segments&quot; button.</td>
                <td className="py-3">Recording marked <code className="font-mono text-[11px]">COMPLETED</code> with <code className="font-mono text-[11px]">transcript_status = PARTIAL</code>. LLM summary runs on available text. Clicking Retry resets only the failed chunks to <code className="font-mono text-[11px]">PENDING</code> and re-queues them.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">All Chunks Failed</td>
                <td className="py-3 pr-4 text-rose-700 font-medium">Status card: &quot;All audio segments failed to transcribe&quot; with &quot;Retry Processing&quot; button. Error Code: <code className="font-mono text-[11px]">ASR_UNAVAILABLE</code>.</td>
                <td className="py-3">Worker detects 100% chunk failure rate. Recording status is marked <code className="font-mono text-[11px]">FAILED</code>. Job marked <code className="font-mono text-[11px]">FAILED</code>.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">No Speech Detected in Audio</td>
                <td className="py-3 pr-4 text-rose-700 font-medium">Status card: &quot;No intelligible speech detected in the audio recording.&quot; Error Code: <code className="font-mono text-[11px]">NO_SPEECH</code>.</td>
                <td className="py-3">All chunks return empty text strings. Worker flags condition, marks recording <code className="font-mono text-[11px]">FAILED</code>, and avoids calling LLM summarization on blank text.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Groq LLM Summary Failure / Rate Limit</td>
                <td className="py-3 pr-4 text-slate-800">Transcript is 100% visible! Summary section shows an error alert with a dedicated &quot;Retry Summary&quot; button.</td>
                <td className="py-3">Recording marked <code className="font-mono text-[11px]">COMPLETED</code> with <code className="font-mono text-[11px]">summary_status = FAILED</code>. When user clicks Retry Summary, API enqueues a <code className="font-mono text-[11px]">summarize</code> job that bypasses ASR and only re-runs LLM inference.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-bold text-slate-900">Worker Crash / Process Kill Mid-Job</td>
                <td className="py-3 pr-4 text-slate-600">Job stays in &quot;Processing&quot; briefly, then automatically resumes and completes without user intervention.</td>
                <td className="py-3">Worker daemon heartbeat thread stops. On the next worker poll cycle, <code className="font-mono text-[11px]">claim_next_job()</code> detects any running job with <code className="font-mono text-[11px]">heartbeat_at &gt; 2 minutes ago</code>, reclaims it back to <code className="font-mono text-[11px]">QUEUED</code>, and resumes processing.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 8: What I'd do differently with more time */}
      <section id="future-work" className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-700">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-sans">
              8. What I&apos;d Do Differently With More Time
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Architectural enhancements and production scaling roadmap (Not currently implemented)
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          The current implementation achieves high resilience with minimal moving parts. Given additional development time, the following improvements would further elevate scalability and user experience:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <h3 className="font-bold text-xs uppercase font-mono text-slate-900">Batch API for Very Long Audio</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              For recordings exceeding 60 minutes, local slicing generates over 150 chunks. Migrating very long files to an asynchronous batch STT API with webhooks would eliminate worker CPU overhead, prevent long-lived thread pool starvation, and offload file chunking entirely to the speech provider.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <h3 className="font-bold text-xs uppercase font-mono text-slate-900">Server-Sent Events (SSE) / WebSockets</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Replace client HTTP polling (<code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">POLL_INTERVAL_MS = 3000</code>) with Server-Sent Events (<code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">/api/recordings/&#123;id&#125;/events</code>). This pushes chunk completion events instantaneously to the browser, eliminates redundant database queries, and provides smoother UI progress transitions.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <h3 className="font-bold text-xs uppercase font-mono text-slate-900">Resumable S3 Multipart Uploads</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Implement S3 Multipart Upload protocol (or Tus) for files over 100 MB. If a user suffers network disruption at 90% of a 400 MB upload, they could resume from the last 5 MB chunk instead of restarting the entire upload from 0%.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <h3 className="font-bold text-xs uppercase font-mono text-slate-900">Real Authentication &amp; Multi-Tenancy</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Replace the anonymous <code className="font-mono text-[11px] bg-slate-200/60 px-1 py-0.5 rounded">localStorage</code> client ID with an identity provider (e.g. Supabase Auth, Clerk, or NextAuth with JWTs), row-level database security policies, and team workspaces with encrypted per-tenant API key management.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <h3 className="font-bold text-xs uppercase font-mono text-slate-900">Speaker Diarization &amp; Timestamps</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Incorporate speaker diarization (e.g. Gnani speaker identification or pyannote.audio) to separate speech into Speaker 1 / Speaker 2 dialogue turns, coupled with interactive waveform seeking in the web audio player.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <h3 className="font-bold text-xs uppercase font-mono text-slate-900">Automated Observability &amp; Tracing</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Add OpenTelemetry distributed tracing across HTTP requests, worker queue wait times, FFmpeg execution spans, and upstream Gnani/Groq API latencies, accompanied by Prometheus metrics and Grafana dashboards for worker queue depth monitoring.
            </p>
          </div>
        </div>
      </section>

      {/* Section 9: Source Code */}
      <section id="source-code" className="bg-slate-900 text-white rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-orange-400 text-xs font-mono font-bold uppercase">
            <Github className="w-3.5 h-3.5" />
            <span>Open Source Repository</span>
          </div>

          <h2 className="font-serif-heading text-3xl sm:text-4xl text-white font-normal">
            Inspect the Implementation
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
            All code described on this page—from silence-aware chunking algorithms to atomic PostgreSQL
            job claiming and Groq map-reduce summarization—is fully implemented and open source.
          </p>

          <div className="pt-3 flex flex-wrap items-center gap-4">
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-full text-xs sm:text-sm font-bold bg-white text-slate-900 hover:bg-slate-100 shadow-lg flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Github className="w-4 h-4" />
              <span>Explore GitHub Repository</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            </a>

            <Link
              href="/"
              className="px-6 py-3 rounded-full text-xs sm:text-sm font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors"
            >
              Return to Live Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
