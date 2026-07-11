"use client";

interface ResetDataCardProps {
  onCancel: () => void;
  onExport: () => void;
  onConfirmReset: () => void;
}

/**
 * T42: 全削除の2段階確認カード。
 *
 * デザイン方針:
 * - 赤い警告・詰問調は使わない。stone/amber の落ち着いた配色。
 * - 1段階目: エクスポート導線を添えてから「それでも削除したい」への自然な流れ。
 * - 2段階目: 「すべて削除する」ボタンを静かに確定できる。キャンセルできる。
 */
export default function ResetDataCard({ onCancel, onExport, onConfirmReset }: ResetDataCardProps) {
  return (
    <section className="rounded-[28px] border border-stone-200 bg-stone-50/80 p-4 shadow-sm">
      <p className="text-sm font-semibold text-stone-700">すべての記録を削除する前に</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        これまでの記録は、先に手元に書き出しておくこともできます。
        <br />
        書き出しておけば、あとで読み返したり、別の端末に移したりすることができます。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onExport}
          className="min-h-[44px] rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 hover:bg-amber-100"
        >
          記録を書き出してから削除する
        </button>
      </div>
      <div className="mt-4 border-t border-stone-200 pt-4">
        <p className="text-sm leading-6 text-stone-500">
          書き出しが不要な場合、そのまま削除することもできます。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onConfirmReset}
            className="min-h-[44px] rounded-full bg-stone-200 px-4 py-2 text-sm text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 hover:bg-stone-300"
          >
            すべて削除する
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-full px-4 py-2 text-sm text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            とじる
          </button>
        </div>
      </div>
    </section>
  );
}
