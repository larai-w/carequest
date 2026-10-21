"use client";

import { PRODUCT_NAME } from "@/lib/brand";

interface OnboardingCardProps {
  onStart: () => void;
}

export default function OnboardingCard({ onStart }: OnboardingCardProps) {
  return (
    <section
      className="rounded-[28px] border border-amber-100 bg-amber-50/80 p-5 shadow-sm"
      aria-label="はじめてのかたへ"
    >
      <p className="text-base font-semibold text-stone-800">{`${PRODUCT_NAME} へようこそ`}</p>
      <p className="mt-3 text-base leading-7 text-stone-700">
        介護の毎日は、記録しにくいことばかりです。
        <br />
        このアプリは「今日もやった」と思い出せる場所です。
        <br />
        頑張らなくて大丈夫。記録すること自体が、もうケアです。
      </p>
      <ul className="mt-3 space-y-1.5 text-base text-stone-600">
        <li>📱 記録はまずこの端末に保存されます。アカウントは不要です</li>
        <li>📤 大切な記録はふりかえり画面からいつでも書き出せます</li>
        <li>☁️ クラウドに控えるのは、あとでログインして選んだときだけです</li>
      </ul>
      <button
        type="button"
        onClick={onStart}
        className="mt-4 min-h-[44px] rounded-full bg-stone-800 px-5 py-2.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 active:scale-[0.97]"
      >
        はじめる
      </button>
    </section>
  );
}
