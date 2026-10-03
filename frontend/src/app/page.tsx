"use client";

import UploadCard from "@/components/UploadCard";
import RecordingList from "@/components/RecordingList";
import { ArrowRight, Sparkles, ShieldCheck, Zap, Activity } from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-10 pb-12">
      {/* Hero section inspired directly by Gnani.ai website */}
      <div className="py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Hero Column */}
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/70 border border-orange-200 text-orange-800 text-xs font-mono font-bold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>Speech To Text &amp; Insights</span>
            </div>

            <h1 className="font-serif-heading text-4xl sm:text-5xl lg:text-6xl text-slate-900 font-normal leading-[1.12] tracking-tight">
              Intelligent Audio Notes &amp; AI Summaries.
            </h1>

            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              Upload recordings of any length. We slice audio at detected silences into 
              chunks under 30s, transcribe in parallel via Gnani&apos;s STT API, then generate 
              structured executive summaries with key points and action items using Groq.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href="#upload-section"
                className="px-6 py-3 rounded-full text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-900/10 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Upload Recording</span>
                <ArrowRight className="w-4 h-4 text-orange-400" />
              </a>

              <a
                href="/architecture"
                className="px-6 py-3 rounded-full text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-sm transition-all"
              >
                View Pipeline Specs
              </a>
            </div>


          </div>

          {/* Right Hero Column: Interactive Glowing Mic Button + Card (Matching screenshot) */}
          <div className="lg:col-span-6 flex flex-col sm:flex-row items-center justify-center gap-6">
            
            {/* Circular Glowing Mic Button */}
            <div className="flex flex-col items-center justify-center text-center group cursor-pointer">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white border-4 border-white shadow-2xl flex items-center justify-center relative mic-aura transition-transform group-hover:scale-105">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 p-0.5 flex items-center justify-center">
                  <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                    <Activity className="w-7 h-7 text-slate-900 group-hover:text-orange-600 transition-colors" />
                  </div>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-600 mt-3 font-mono">
                Silence-Aware Pipeline
              </span>
            </div>

            {/* Right Interactive Demo Box (Matching screenshot live speech input box) */}
            <div className="flex-1 w-full bg-white border border-slate-200/80 shadow-2xl rounded-3xl p-6 sm:p-7 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 min-h-[110px]">
                <p className="text-xs text-orange-600/90 font-medium font-mono mb-1">Live Processing Demo</p>
                <p className="text-sm text-slate-400 italic">
                  Drag and drop your audio file or click below to start real-time silence chunking &amp; transcription...
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs text-slate-500 pt-1">
                <span className="font-medium font-mono text-slate-700">Supported Formats:</span>
                <span className="font-mono text-[11px] bg-slate-100 px-2 py-1 rounded-md">WAV, MP3, FLAC, AAC, M4A</span>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Main Upload Card Section */}
      <div id="upload-section">
        <UploadCard />
      </div>

      {/* Recording List Section */}
      <RecordingList />
    </div>
  );
}
