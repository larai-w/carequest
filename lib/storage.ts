import type { CareLog, User } from "@/lib/types";

const STORAGE_KEY = "carequest-state-v1";

export interface CareStorageState {
  user: User;
  logs: CareLog[];
  note: string;
}

export function createInitialUser(): User {
  return {
    id: "caregiver-1",
    name: "あなた",
    energyLevel: "normal",
    todayPoints: 0,
    lastActiveDate: getTodayDate(),
    reflectionNote: "",
    restMode: false,
    goodThings: [],
  };
}

export function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadCareState(): CareStorageState {
  if (typeof window === "undefined") {
    return { user: createInitialUser(), logs: [], note: "" };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { user: createInitialUser(), logs: [], note: "" };
    }

    const parsed = JSON.parse(raw) as Partial<CareStorageState>;
    return {
      user: {
        ...createInitialUser(),
        ...parsed.user,
      },
      logs: parsed.logs ?? [],
      note: parsed.note ?? "",
    };
  } catch {
    return { user: createInitialUser(), logs: [], note: "" };
  }
}

export function saveCareState(state: CareStorageState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    // TODO: AWS へ移行する際は、この保存処理を API Gateway + Lambda + DynamoDB へ置き換えます。
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 保存に失敗しても画面は継続できるようにします。
  }
}
