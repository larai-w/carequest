import { getDateStringDaysAgo } from "@/lib/date";

// T41: 定期バックアップのやさしいリマインド。
// R-02(localStorage 全損リスク)の軽減策として、記録が増えてきたユーザーに
// エクスポートをそっと促す。「義務」ではなく「手元にも残せますよ」の姿勢。
// ここは判定ロジックだけを純関数で持つ(DOM 非依存でテストできる)。

// リマインドを出すために必要な最小ログ件数。
export const BACKUP_REMINDER_MIN_LOGS = 20;

// 最後のエクスポートからリマインドを出すまでの日数(これ以上経過したら出す)。
export const BACKUP_REMINDER_STALE_DAYS = 30;

// カードを再表示するまでに最低限あける日数(7日に1回まで)。
// supportNudgeLastShown と同じ throttle パターン。
export const BACKUP_REMINDER_MIN_GAP_DAYS = 7;

/**
 * バックアップリマインドカードを表示すべきか判定する純関数。
 *
 * 表示条件:
 * 1. ログが BACKUP_REMINDER_MIN_LOGS 件以上ある
 * 2. かつ、以下のいずれか:
 *    - lastExportDate が空(一度もエクスポートしていない)
 *    - lastExportDate が BACKUP_REMINDER_STALE_DAYS 日以上前
 * 3. かつ、throttle: exportReminderLastShown が空 or BACKUP_REMINDER_MIN_GAP_DAYS 日以上前
 *
 * エッジケース:
 * - lastExportDate が未来日付(時計ずれ等): 「エクスポート済み・まだ新鮮」として
 *   表示しない。未来日付でクラッシュしたり常時表示になったりしない。
 * - exportReminderLastShown が未来日付: throttle が効いて表示しない(安全側に倒れる)。
 */
export function shouldShowBackupReminder(
  input: {
    logCount: number;
    lastExportDate: string;
    exportReminderLastShown: string;
  },
  today: string,
  minLogs: number = BACKUP_REMINDER_MIN_LOGS,
  staleDays: number = BACKUP_REMINDER_STALE_DAYS,
  minGapDays: number = BACKUP_REMINDER_MIN_GAP_DAYS,
): boolean {
  // 件数条件: 記録が minLogs 件未満なら出さない。
  if (input.logCount < minLogs) return false;

  // エクスポート鮮度の判定:
  // - 空文字("未エクスポート")は件数条件のみで判定(初日から催促しない設計)。
  // - 日付がある場合は staleDays 日以上前かを確認する。
  //   未来日付の場合は「まだ新鮮」として扱い、表示しない。
  const last = input.lastExportDate;
  if (last !== "") {
    // staleDays 日前の日付を計算して比較する。
    // "last > staleThreshold" のとき「まだ staleDays 以内(= 新鮮)」 → 出さない。
    const staleThreshold = getDateStringDaysAgo(today, staleDays);
    if (last > staleThreshold) {
      return false;
    }
  }

  // throttle: 最後の表示から minGapDays 日未満であれば、まだ出さない。
  // 空文字("未表示")は常に通す。
  // exportReminderLastShown が未来日付の場合: last > gapThreshold となり、
  // throttle が効いて表示しない(安全側に倒れる)。
  const nudgeLast = input.exportReminderLastShown;
  if (nudgeLast !== "" && nudgeLast > getDateStringDaysAgo(today, minGapDays)) {
    return false;
  }

  return true;
}
