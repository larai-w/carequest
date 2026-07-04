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
