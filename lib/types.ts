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

// エネルギーレベルの日別記録。記録がない日は low が続いた介護者に
// 相談窓口をそっと示すため(US-502)に使う。
export interface DailyEnergy {
  date: string; // YYYY-MM-DD
  energyLevel: EnergyLevel;
}

// 「今日のよかったこと」の日別記録(v5 で追加)。
// date ごとに選択された項目リストを保持し、翌日には当日分だけがまっさらになる。
export interface DailyGoodThings {
  date: string; // YYYY-MM-DD
  items: string[]; // 選択されたよかったこと文言の配列
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
  taskCounts: Record<string, number>;
  message: string;
}
