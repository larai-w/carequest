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

export function getCommunityStats(logs: CareLog[], today: string = getTodayDate()) {
  const todayLogs = logs.filter((log) => log.date === today);
  const taskCounts = Object.fromEntries(careTasks.map((task) => [task.id, 0])) as Record<string, number>;
  todayLogs.forEach((log) => {
    taskCounts[log.taskId] = (taskCounts[log.taskId] ?? 0) + 1;
  });

  const totalPoints = todayLogs.reduce((sum, log) => sum + log.points, 0);
  const participantCount = 180 + Math.floor(totalPoints / 6) + todayLogs.length;

  return {
    totalPoints: 12430 + totalPoints * 2 + todayLogs.length * 8,
    participantCount,
    taskCounts,
  };
}
