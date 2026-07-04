export type EnergyLevel = "low" | "normal" | "energetic";

export interface User {
  id: string;
  name: string;
  energyLevel: EnergyLevel;
  todayPoints: number;
  lastActiveDate: string;
  reflectionNote: string;
  restMode: boolean;
  goodThings: string[];
}

export interface CareTask {
  id: string;
  title: string;
  points: number;
  description: string;
}

export interface CareLog {
  id: string;
  taskId: string;
  title: string;
  points: number;
  completedAt: string;
  date: string;
  energyLevel: EnergyLevel;
}

export interface DailyStats {
  date: string;
  totalPoints: number;
  completedTasks: number;
  participantCount: number;
  taskCounts: Record<string, number>;
  message: string;
}
