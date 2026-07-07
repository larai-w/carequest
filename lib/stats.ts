import { careTasks } from "@/lib/tasks";
import type { CareLog, DailyStats } from "@/lib/types";
import { getTodayDate } from "@/lib/storage";

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
  const base = new Date(`${today}T00:00:00Z`);

  for (let offset = 1; offset <= days; offset += 1) {
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() - offset);
    const date = day.toISOString().slice(0, 10);
    const dayLogs = logs.filter((log) => log.date === date);

    if (dayLogs.length === 0) {
      continue;
    }

    const label =
      offset === 1 ? "昨日" : `${day.getUTCMonth() + 1}月${day.getUTCDate()}日`;

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
