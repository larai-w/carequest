"use client";

import type { Reading } from "@/lib/taskReading";

// 記録したことに関連する読みものを、そっと1つだけ出す。
//
// ⚠️ **記録を評価しない。** 「もっと〜しましょう」は言わない。
// 体調が悪い日に画面から評価されるのは、続ける力を削る。
// ここでやるのは「こういう制度があります」までで、
// **記録した行為が足りないという含みを持たせない。**
//
// **1日1回まで。** 記録のたびに出すと、記録が「何か言われる行為」になる。
export default function TaskReadingCard({
  reading,
  onDismiss,
}: {
  reading: Reading;
  onDismiss: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-stone-200 bg-white/70 p-4 shadow-sm">
      <p className="text-xs text-stone-500">{reading.why}</p>
      <a
        href={reading.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block text-sm font-medium text-stone-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        {reading.title}
      </a>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2 min-h-[44px] rounded-full px-3 py-2 text-sm text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
      >
        とじる
      </button>
    </section>
  );
}
