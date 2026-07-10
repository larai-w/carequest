import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#fdf2f8_60%,_#fef3c7)] text-stone-700">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-4">
          <section className="rounded-[28px] border border-stone-200 bg-white/80 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">
              Care Quest
            </p>
            <h2 className="mt-2 text-lg font-semibold text-stone-800">
              このページは見つかりませんでした
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              URLが変わったか、ページが移動した可能性があります。あなたの記録はホームからいつでも確認できます。
            </p>
          </section>

          <Link
            href="/"
            className="flex items-center justify-center rounded-[24px] bg-stone-800 px-4 py-3 text-sm font-semibold text-white shadow-sm"
          >
            ホームへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
