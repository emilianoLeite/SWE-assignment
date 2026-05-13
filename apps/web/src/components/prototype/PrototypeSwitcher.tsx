"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";

interface Variant {
  key: string;
  name: string;
}

export default function PrototypeSwitcher({
  variants,
  current,
}: {
  variants: Variant[];
  current: string;
}) {
  if (process.env.NODE_ENV === "production") return null;

  const router = useRouter();
  const idx = variants.findIndex((v) => v.key === current);
  const active = variants[idx] ?? variants[0];

  const go = useCallback(
    (dir: 1 | -1) => {
      const next = variants[(idx + dir + variants.length) % variants.length];
      router.replace(`?variant=${next.key}`);
    },
    [idx, router, variants]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const editable = ["INPUT", "TEXTAREA", "SELECT"].includes(tag) ||
        (e.target as HTMLElement).isContentEditable;
      if (editable) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go]);

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-neutral-900/95 backdrop-blur-sm text-white rounded-full px-2 py-1.5 shadow-xl ring-1 ring-white/10 select-none">
      <FlaskConical className="w-3.5 h-3.5 text-neutral-400 mr-1" />

      <button
        onClick={() => go(-1)}
        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
        aria-label="Previous variant"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-1.5 px-2 min-w-[160px] justify-center">
        <span className="text-xs font-bold text-primary-300">{active.key}</span>
        <span className="text-neutral-500">—</span>
        <span className="text-xs text-neutral-200">{active.name}</span>
      </div>

      <button
        onClick={() => go(1)}
        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
        aria-label="Next variant"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <span className="ml-1 text-[10px] text-neutral-500 font-mono">← →</span>
    </div>
  );
}
