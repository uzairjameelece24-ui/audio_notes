// Renders when Next.js throws a 404 — e.g. user navigates to a non-existent recording ID.
import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
        <FileQuestion className="w-8 h-8" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">Page Not Found</h2>
        <p className="text-sm text-slate-400 mt-1">
          That recording doesn&apos;t exist or may have been deleted.
        </p>
      </div>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all hover:scale-[1.02]"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
