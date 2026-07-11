"use client";

interface BackupReminderCardProps {
  onDismiss: () => void;
  onExport: () => void;
}

// T41: バックアップリマインドカード。
// 記録が増えてきたユーザーに「手元にも残せますよ」とそっと伝える。
// 義務にしない・脅さない。SupportNudgeCard と同じ落ち着いた amber/stone スタイル。
export default function BackupReminderCard({ onDismiss, onExport }: BackupReminderCardProps) {
  return (
    <section className="rounded-[28px] border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
      <p className="text-sm leading-7 text-stone-700">
        たいせつな記録がたまってきました。
        <br />
        手元にも残しておきませんか。
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          className="min-h-[44px] rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          記録を書き出す
        </button>
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
