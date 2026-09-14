import type { BackupResult } from "@/lib/api";
import type { SignInSyncResult } from "@/lib/sync";

// クラウド控えの知らせ(2026-09-14 /hci-check「クラウド控え」)。
// 「試みた」を「できた」と同じ言い方にしない。システムが知っている以上を言わない。

const OTHER_ACCOUNT =
  "この端末には、別のアカウントで控えていた記録があります。混ざらないように、クラウドとのやりとりを止めました。";
const PAUSED_SUFFIX = "自動でクラウドへ控えるのは止めています。";

// 通信できず、ログインしているか確かめられなかった(「切れた」とは言わない・「直した後」#1)。
const UNREACHABLE_AUTO =
  "通信できず、クラウドへ控えられませんでした。記録はこの端末に残っています。次に記録したときに、もう一度控えます。";

// 自動の控えを止めている間、記録するたびに確認カードで言う(2026-09-14 /hci-check「直した後」#4)。
// 止めた記憶は端末にしか無く、機種変更の日に初めて気づくことがないように。
export const AUTO_BACKUP_PAUSED_NOTE =
  "自動でクラウドへ控えるのは止めています。再開するときは、ふりかえりの「クラウドにバックアップ」を押してください。";

export const SESSION_LOST_MESSAGE =
  "ログインが切れたため、クラウドへ控えられませんでした。記録はこの端末に残っています。ホームでもう一度ログインすると、また控えます。";

export function signInSyncMessage(result: SignInSyncResult): string {
  if (result.blocked === "other-account") {
    return OTHER_ACCOUNT;
  }
  if (result.blocked === "unreachable") {
    return "通信できず、クラウドとやりとりできませんでした。記録はこの端末に残っています。通信できる場所で、もう一度「クラウドと同期する」を押してください。";
  }
  if (result.blocked === "unknown") {
    return "ログインしている人を確かめられなかったため、クラウドとのやりとりを止めました。記録はこの端末に残っています。";
  }
  const n = result.restoredCount;
  if (n > 0) {
    if (result.paused) {
      return `クラウドから${n}件の記録を読み込みました。${PAUSED_SUFFIX}`;
    }
    return result.backedUp
      ? `クラウドから${n}件の記録を読み込み、クラウドに控えました。`
      : `クラウドから${n}件の記録を読み込みました。ただ、クラウドに控えられませんでした。記録はこの端末に残っています。`;
  }
  if (result.paused) {
    return `ログインしました。${PAUSED_SUFFIX}（再開するときは、ふりかえりの「クラウドにバックアップ」を押してください）`;
  }
  if (result.backedUp) {
    return "記録をクラウドに控えました。";
  }
  if (result.backupTotal === 0) {
    return "ログインしました。クラウドに控える記録は、まだありません。";
  }
  return "クラウドに控えられませんでした。記録はこの端末に残っています。次に記録したときに、もう一度控えます。";
}

export function cloudDeletedMessage(ok: boolean): string {
  return ok
    ? "クラウドの記録を削除しました。この端末の記録は残っています。自動でクラウドへ控えるのも止めました（再開するときは、ふりかえりの「クラウドにバックアップ」を押してください）。"
    : "削除できませんでした。もう一度お試しください。";
}

function formatBackupTime(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function lastBackupLine(lastIso: string | null, paused: boolean): string {
  const when = lastIso ? formatBackupTime(lastIso) : null;
  const base = when
    ? `この端末から最後にクラウドへ控えたのは ${when} です。`
    : "この端末から、まだクラウドへ控えていません。";
  return paused ? `${base}${PAUSED_SUFFIX}` : base;
}

export function backupStatusMessage(
  result: BackupResult,
  mode: "manual" | "auto",
  // resumedAuto: 手動のバックアップで、止めていた自動の控えを再開した(「直した後」#5)。黙って再開しない。
  options: { resumedAuto?: boolean } = {},
): string {
  const base = backupStatusBase(result, mode);
  if (!result.skipped && options.resumedAuto) {
    return `${base}自動でクラウドへ控えるのも再開しました。`;
  }
  return base;
}

function backupStatusBase(result: BackupResult, mode: "manual" | "auto"): string {
  if (result.skipped) {
    if (result.reason === "unreachable") {
      return mode === "manual"
        ? "通信できず、クラウドへ控えられませんでした。記録はこの端末に残っています。通信できる場所で、もう一度お試しください。"
        : UNREACHABLE_AUTO;
    }
    if (result.reason === "other-account") {
      return "この端末には、別のアカウントで控えていた記録があります。混ざらないように、クラウドへ控えるのを止めました。ホームの「アカウント」で確かめてください。";
    }
    if (result.reason === "paused") {
      return "";
    }
    return mode === "manual" ? "ログインすると、この端末の記録をクラウドに控えておけます。" : "";
  }
  if (result.total === 0) {
    return mode === "manual" ? "まだ控えておく記録がありません。" : "";
  }
  if (result.failed === 0) {
    return "バックアップが完了しました。";
  }
  if (result.succeeded > 0) {
    return "一部の記録を控えました。残りはこの端末にちゃんと残っています。";
  }
  return "同期できませんでした。記録はこの端末にちゃんと残っています。";
}
