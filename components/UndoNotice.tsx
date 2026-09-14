"use client";

interface UndoNoticeProps {
  message: string;
  onUndo: () => void;
}

/**
 * 取り消した直後に出す「元に戻す」カード。
 *
 * 確認ダイアログは挟まない(10秒ルール)。その代わり、消したことをその場で知らせ、
 * 1タップで戻せるようにする。勝手に消えない(ペースは利用者に渡す)。
 * 2026-09-14 /hci-check の候補 #1・#4 への対応。
 */
export default function UndoNotice({ message, onUndo }: UndoNoticeProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-4 shadow-sm"
    >
      <p className="text-sm leading-6 text-stone-700">{message}</p>
      <button
        type="button"
        onClick={onUndo}
        className="mt-3 min-h-[44px] rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
      >
        元に戻す
      </button>
    </section>
  );
}
