"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, BookOpen, Github, ArrowRight, Mic } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-slate-200/80 transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo (Gnani.ai style) */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-serif-heading font-bold text-lg group-hover:scale-105 transition-transform shadow-md">
            <Mic className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-slate-900 font-sans">
                Audio <span className="font-serif-heading font-normal text-orange-600 text-xl">Notes</span>
              </span>
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                GNANI AI
              </span>
            </div>
          </div>
        </Link>

        {/* Center / Right Navigation Links & Action Pill Buttons */}
        <div className="flex items-center gap-3">
          <nav className="hidden sm:flex items-center gap-1 mr-2 text-sm font-medium text-slate-600">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                pathname === "/"
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <History className="w-4 h-4 text-slate-500" />
              <span>Recordings</span>
            </Link>

            <Link
              href="/architecture"
              className={`px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                pathname === "/architecture"
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <BookOpen className="w-4 h-4 text-slate-500" />
              <span>Architecture</span>
            </Link>
          </nav>

          {/* Action Buttons (Matching Gnani.ai screenshot header buttons!) */}
          <Link
            href="/"
            className="hidden md:inline-flex px-4 py-2 rounded-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 shadow-sm transition-all"
          >
            Start Building
          </Link>

          <a
            href={process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/uzairjameelece24-ui/audio_notes"}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-full text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-md flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>
    </header>
  );
}
