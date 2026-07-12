import { careTasks } from "@/lib/tasks";
import type { CareLog, DailyStats } from "@/lib/types";
import { getTodayDate, getDateStringDaysAgo } from "@/lib/date";

export function getTodayStats(logs: CareLog[], today: string = getTodayDate()): DailyStats {
  const todayLogs = logs.filter((log) => log.date === today);
  const taskCounts = Object.fromEntries(careTasks.map((task) => [task.id, 0])) as Record<string, number>;

  todayLogs.forEach((log) => {
    taskCounts[log.taskId] = (taskCounts[log.taskId] ?? 0) + 1;
  });

  const totalPoints = todayLogs.reduce((sum, log) => sum + log.points, 0);
  const participantCount = 180 + Math.floor(totalPoints / 8) + Object.values(taskCounts).reduce((sum, count) => sum + count, 0);

  return {
    date: today,
    totalPoints,
    completedTasks: todayLogs.length,
    participantCount,
    taskCounts,
    message: "今日も、少しずつ支え合えています。",
  };
}

export interface RecentDaySummary {
  date: string;
  label: string;
  totalPoints: number;
  completedTasks: number;
}

// 記録がある日だけを返します。記録がない日を「0件」と見せて介護者を責めないためです。
export function getRecentDaySummaries(
  logs: CareLog[],
  days = 7,
  today: string = getTodayDate(),
): RecentDaySummary[] {
  const summaries: RecentDaySummary[] = [];

  for (let offset = 1; offset <= days; offset += 1) {
    const date = getDateStringDaysAgo(today, offset);
    const dayLogs = logs.filter((log) => log.date === date);

    if (dayLogs.length === 0) {
      continue;
    }

    // ラベル用に Date を再構成（getMonth/getDate でローカル値を取得）
    const [yearStr, monthStr, dayStr] = date.split("-");
    const day = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
    const label =
      offset === 1 ? "昨日" : `${day.getMonth() + 1}月${day.getDate()}日`;

    summaries.push({
      date,
      label,
      totalPoints: dayLogs.reduce((sum, log) => sum + log.points, 0),
      completedTasks: dayLogs.length,
    });
  }

  return summaries;
}

/**
 * あゆみ統計: ユーザー自身のすべての記録から「これまでの積み重ね」を返す純関数。
 *
 * 「みんな」(偽コミュニティ)の代わりに自分の実データだけを正直に見せる。
 * Phase 2 で本物のコミュニティ(US-401)を設計する際に見直す。
 * ルート(/community)は URL の変更がブックマーク・SW キャッシュに影響するため据え置き。
 *
 * @param logs - 全期間のログ(空配列でも安全に動作する)
 * @returns あゆみ統計オブジェクト
 */
export function getJourneyStats(logs: CareLog[]) {
  // 累計ポイント
  const totalPoints = logs.reduce((sum, log) => sum + (Number.isFinite(log.points) ? log.points : 0), 0);

  // タスク別累計回数(不正な taskId は動的に追加)
  const taskCounts = Object.fromEntries(careTasks.map((task) => [task.id, 0])) as Record<string, number>;
  logs.forEach((log) => {
    taskCounts[log.taskId] = (taskCounts[log.taskId] ?? 0) + 1;
  });

  // 記録をはじめてからの日数(最初の記録日から今日まで)。
  // date が不正な形式("YYYY-MM-DD" 以外)の記録は無視する。
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const validDates = logs
    .map((log) => log.date)
    .filter((d) => DATE_RE.test(d));

  let daysSinceFirst = 0;
  let recordedDays = 0;
  if (validDates.length > 0) {
    const sorted = [...validDates].sort();
    const firstDate = sorted[0];
    const today = getTodayDate();
    // ローカル midnight として解釈するため手動パース
    const [fy, fm, fd] = firstDate.split("-").map(Number);
    const [ty, tm, td] = today.split("-").map(Number);
    const firstMs = new Date(fy, fm - 1, fd).getTime();
    const todayMs = new Date(ty, tm - 1, td).getTime();
    const diff = todayMs - firstMs;
    // 未来日付の記録が混ざっていても 0 未満にしない
    daysSinceFirst = diff >= 0 ? Math.floor(diff / 86_400_000) + 1 : 1;

    // 記録した日数(ユニーク日数)
    recordedDays = new Set(validDates).size;
  }

  return {
    totalPoints,
    taskCounts,
    daysSinceFirst,
    recordedDays,
    totalLogs: logs.length,
  };
}
