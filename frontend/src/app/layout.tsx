import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Audio Notes | Gnani STT & Groq AI Pipeline",
  description: "Upload audio recordings of any duration, transcribe with Gnani STT, and extract actionable Groq LLM summaries.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#fdfbf9] text-slate-900 antialiased selection:bg-orange-500/20 selection:text-orange-900">
        <div className="relative min-h-screen flex flex-col overflow-x-hidden">
          {/* Top Announcement Bar (Matching Gnani.ai header banner) */}
          <div className="bg-[#0f172a] text-slate-200 text-xs py-2 px-4 text-center font-medium relative z-50 flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0 animate-pulse" />
            <span>
              Powered by <strong className="text-white font-semibold">Gnani STT</strong> &amp; <strong className="text-white font-semibold">Groq AI</strong> &bull; Silence-aware parallel chunking under 4% WER.
            </span>
            <Link
              href="/architecture"
              className="inline-flex items-center gap-1 text-orange-300 hover:text-orange-200 underline underline-offset-2 ml-1 font-semibold"
            >
              Explore Architecture <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <Navbar />

          <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 relative z-10">
            {children}
          </main>

          <footer className="border-t border-slate-200/80 bg-white/60 backdrop-blur-md py-8 text-center text-xs text-slate-500 relative z-10">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="font-serif-heading text-lg font-bold text-slate-900">Audio Notes</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  Gnani STT &bull; Groq AI
                </span>
              </div>
              <p className="text-slate-500">
                High-concurrency audio processing &bull; Fast parallel ASR &bull; Asynchronous worker pool
              </p>
              <div className="flex items-center gap-4 text-slate-600">
                <Link
                  href="/architecture"
                  className="hover:text-slate-900 transition-colors font-medium"
                >
                  Architecture Docs
                </Link>
                <a
                  href={process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/uzairjameelece24-ui/audio_notes"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-900 transition-colors font-medium"
                >
                  GitHub Repository
                </a>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
