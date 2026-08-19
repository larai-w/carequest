"use client";

import Link from "next/link";

interface RestModeCardProps {
  onExit: () => void;
}

export default function RestModeCard({ onExit }: RestModeCardProps) {
  return (
    <div className="rounded-[28px] border border-stone-200 bg-white/80 p-6 shadow-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-500">
          おやすみモード中
        </div>

        <p className="text-base leading-7 text-stone-600">
          今日はゆっくりしていてください。
          <br />
          ここにいるだけで、十分です。
        </p>

        <p className="text-sm text-stone-600">
          記録したいときは、いつでもクエストへ。
        </p>

        <div className="flex w-full flex-col gap-2">
          <Link
            href="/quest"
            className="flex items-center justify-center rounded-[20px] border border-stone-200 bg-white/80 px-4 py-3 text-sm font-medium text-stone-600 shadow-sm"
          >
            記録する（クエストへ）
          </Link>

          <button
            type="button"
            onClick={onExit}
            className="min-h-[44px] rounded-[20px] bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            通常モードにもどる
          </button>
        </div>
      </div>
    </div>
  );
}
