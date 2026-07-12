"use client";

import Link from "next/link";

interface SupportNudgeCardProps {
  onDismiss: () => void;
}

// US-502: low が続いたときにそっと出す相談窓口カード。
// 「相談すべき」ではなく「話せる場所がある」という here-if-you-need の姿勢。
// 警告色(赤)は使わず、他のカードと同じ落ち着いた amber/stone にする。
export default function SupportNudgeCard({ onDismiss }: SupportNudgeCardProps) {
  return (
    <section className="rounded-[28px] border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
      <p className="text-sm leading-7 text-stone-700">
        ここ数日、おつかれがたまっていませんか。
        <br />
        あなたのことを話せる窓口があります。ひとりで抱えなくて大丈夫です。
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href="/about"
          className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm"
        >
          相談できる窓口を見る
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[44px] rounded-full px-4 py-2 text-sm text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          とじる
        </button>
      </div>
    </section>
  );
}
