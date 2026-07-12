"use client";

import { SIGNED_IN_FLAG_KEY } from "@/lib/api";
import { useHydratedState } from "@/lib/useHydratedState";

// localStorage の軽量サインインフラグを読む(amplify は読み込まない・T45)。
// window が無い(SSR/プリレンダー)・localStorage 不可なら安全側の false。
function readSignedInFlag(): boolean {
  try {
    return window.localStorage.getItem(SIGNED_IN_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

interface CloudBackupCardProps {
  onBackup: () => void;
  onRestore: () => void;
  // 親が管理する穏やかな結果メッセージ(importMessage と同じ方式)。
  message: string;
  // バックアップ/復元の実行中はボタンを無効化する。
  busy: boolean;
}

/**
 * T10 Phase A: 手動のクラウドバックアップ/復元カード。
 *
 * デザイン方針(design-sync.md §1・§5 Phase A):
 * - ResetDataCard / BackupReminderCard に揃えた stone/amber・rounded-[28px]。
 * - サインイン誘導は控えめ。未サインインでも機能をブロックしない(§6 E-7)。
 * - マウント時に認証 SDK(amplify)を読み込まない(T45)。localStorage の軽量フラグ
 *   だけを見て「サインイン済みかもしれない」案内を出す。実セッション確認と
 *   バックアップ処理はボタン押下時に親のハンドラ(lib/api)側で行う。
 * - 初回描画(SSR/hydration)は常に「未サインイン」で描き、hydration 後にフラグを
 *   読んで差し替える(mismatch を避ける・AuthPanel と同じ方針)。
 */
export default function CloudBackupCard({ onBackup, onRestore, message, busy }: CloudBackupCardProps) {
  // 初回描画(SSR/hydration)は必ず false(未サインイン)。hydration 完了後に
  // 軽量フラグの値へ切り替わる(useSyncExternalStore ベースで mismatch を避ける)。
  const [maybeSignedIn] = useHydratedState<boolean>(false, readSignedInFlag);

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
      <h3 className="text-base font-semibold text-stone-700">クラウドに控えておく</h3>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        サインインしておくと、この端末の記録をクラウドに控えておけます。別の端末でも読み込めます。
      </p>
      <p className="mt-1 text-xs leading-5 text-stone-500">
        これはあくまで記録の控えです。うまくいかなくても、記録はこの端末にそのまま残ります。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBackup}
          disabled={busy}
          className="min-h-[44px] rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 hover:bg-amber-100 disabled:opacity-60"
        >
          クラウドにバックアップ
        </button>
        <button
          type="button"
          onClick={onRestore}
          disabled={busy}
          className="min-h-[44px] rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 hover:bg-stone-200 disabled:opacity-60"
        >
          クラウドから復元
        </button>
      </div>
      {!maybeSignedIn ? (
        <p className="mt-2 text-xs leading-5 text-stone-500">
          サインインするとバックアップできます。ホーム画面からサインインできます。
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-3 text-sm leading-6 text-stone-700">
          {message}
        </p>
      ) : null}
    </section>
  );
}
