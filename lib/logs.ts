import type { CareLog } from "@/lib/types";

/**
 * logs 配列から指定 id の記録を除去して返す純関数。
 *
 * - 存在しない id が渡された場合は no-op(同じ配列の新しいコピーを返す)。
 * - 元の配列は変更しない(immutable)。
 * - 呼び出し側は戻り値を saveCareState に渡して localStorage を更新すること。
 */
export function removeLog(logs: CareLog[], id: string): CareLog[] {
  return logs.filter((log) => log.id !== id);
}

/**
 * 取り消した記録を「元に戻す」純関数。
 *
 * - 記録した時刻(completedAt)の順番の位置に差し戻す。
 * - すでに同じ id がある場合は足さない(元に戻すを連打しても増えない)。
 * - 元の配列は変更しない(immutable)。
 */
export function restoreLog(logs: CareLog[], log: CareLog): CareLog[] {
  if (logs.some((existing) => existing.id === log.id)) {
    return [...logs];
  }
  const next = [...logs];
  const insertAt = next.findIndex((existing) => existing.completedAt > log.completedAt);
  if (insertAt === -1) {
    next.push(log);
  } else {
    next.splice(insertAt, 0, log);
  }
  return next;
}

// 同じケアの記録が「重なって押された」とみなす間隔。時間をおいた服薬などは重複にしない。
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

/**
 * 指定の記録と同じケアが、前後5分以内に何件あるかを返す純関数(自分自身は数えない)。
 *
 * 2026-09-14 /hci-check 候補 #6: 手の震えなどで0.5秒以上あけて2回触れると、
 * 連打ガードを越えて気づかないまま重複していた。確認カードで知らせるために使う。
 * 時刻が読めない記録は数えない。
 */
export function recentDuplicateCount(logs: CareLog[], log: CareLog): number {
  const at = Date.parse(log.completedAt);
  if (Number.isNaN(at)) {
    return 0;
  }
  return logs.filter((other) => {
    if (other.id === log.id || other.taskId !== log.taskId) {
      return false;
    }
    const otherAt = Date.parse(other.completedAt);
    return !Number.isNaN(otherAt) && Math.abs(at - otherAt) <= DUPLICATE_WINDOW_MS;
  }).length;
}

/**
 * 今日の記録のポイント合計と件数を再計算する純関数。
 *
 * @param allLogs 全期間の記録(削除後の配列)
 * @param today YYYY-MM-DD 形式の今日の日付
 */
export function recalcTodayStats(
  allLogs: CareLog[],
  today: string,
): { todayPoints: number; completedCount: number } {
  const todayLogs = allLogs.filter((log) => log.date === today);
  return {
    todayPoints: todayLogs.reduce((sum, log) => sum + log.points, 0),
    completedCount: todayLogs.length,
  };
}
