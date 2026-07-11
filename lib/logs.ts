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
