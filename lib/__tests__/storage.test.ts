import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { CareStorageState } from "@/lib/storage";

// node 環境では window が未定義。
// loadCareState は typeof window === "undefined" の場合にデフォルトを返す。
// window をモックするときは global に割り当てて、テスト後に元に戻す。

// localStorage のシンプルなモック
function makeLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
  };
}

describe("loadCareState (node 環境: window 未定義)", () => {
  it("window が未定義のときデフォルト状態を返す", async () => {
    // node 環境では window は undefined → デフォルトに落ちる
    const { loadCareState } = await import("@/lib/storage");
    const state = loadCareState();
    expect(state.logs).toEqual([]);
    expect(state.note).toBe("");
    expect(state.customTasks).toEqual([]);
    expect(state.user.name).toBe("あなた");
  });
});

describe("loadCareState (window モックあり)", () => {
  let originalWindow: typeof globalThis.window | undefined;
  let mockLocalStorage: ReturnType<typeof makeLocalStorageMock>;

  beforeEach(() => {
    // window と localStorage をモック
    mockLocalStorage = makeLocalStorageMock();
    originalWindow = (globalThis as Record<string, unknown>)["window"] as typeof globalThis.window;
    (globalThis as Record<string, unknown>)["window"] = {
      localStorage: mockLocalStorage,
    };
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>)["window"];
    } else {
      (globalThis as Record<string, unknown>)["window"] = originalWindow;
    }
    // モジュールキャッシュをリセットして window 判定が再評価されるようにする
    vi.resetModules();
  });

  it("localStorage が空のときデフォルト状態を返す", async () => {
    const { loadCareState } = await import("@/lib/storage");
    const state = loadCareState();
    expect(state.logs).toEqual([]);
    expect(state.customTasks).toEqual([]);
    expect(state.note).toBe("");
  });

  it("完全な保存データを正しく読み込む", async () => {
    const saved: CareStorageState = {
      user: {
        id: "caregiver-1",
        name: "テスト太郎",
        energyLevel: "energetic",
        todayPoints: 30,
        lastActiveDate: "2024-03-15",
        reflectionNote: "よくできた",
        restMode: false,
        goodThings: ["散歩した"],
      },
      logs: [
        {
          id: "log-1",
          taskId: "medicine",
          title: "薬を渡した",
          points: 5,
          completedAt: "2024-03-15T10:00:00",
          date: "2024-03-15",
          energyLevel: "normal",
        },
      ],
      note: "今日のメモ",
      customTasks: [
        { id: "custom-1", title: "カスタムタスク", points: 10, description: "説明" },
      ],
    };
    mockLocalStorage.setItem("carequest-state-v1", JSON.stringify(saved));

    const { loadCareState } = await import("@/lib/storage");
    const state = loadCareState();
    expect(state.user.name).toBe("テスト太郎");
    expect(state.logs.length).toBe(1);
    expect(state.note).toBe("今日のメモ");
    expect(state.customTasks.length).toBe(1);
  });

  it("後方互換: customTasks キーが欠落した旧形式 JSON でも空配列にフォールバック", async () => {
    const oldFormat = {
      user: {
        id: "caregiver-1",
        name: "旧ユーザー",
        energyLevel: "normal",
        todayPoints: 0,
        lastActiveDate: "2024-01-01",
        reflectionNote: "",
        restMode: false,
        goodThings: [],
      },
      logs: [],
      note: "",
      // customTasks キーなし
    };
    mockLocalStorage.setItem("carequest-state-v1", JSON.stringify(oldFormat));

    const { loadCareState } = await import("@/lib/storage");
    const state = loadCareState();
    expect(state.customTasks).toEqual([]);
    expect(state.user.name).toBe("旧ユーザー");
  });

  it("後方互換: user フィールドが部分的な旧形式でもデフォルトとマージされる", async () => {
    const partialUser = {
      user: { name: "一部のみ" },
      logs: [],
      note: "",
    };
    mockLocalStorage.setItem("carequest-state-v1", JSON.stringify(partialUser));

    const { loadCareState } = await import("@/lib/storage");
    const state = loadCareState();
    // name は上書きされる
    expect(state.user.name).toBe("一部のみ");
    // デフォルトフィールドが補完される
    expect(state.user.energyLevel).toBe("normal");
    expect(state.user.restMode).toBe(false);
  });

  it("破損 JSON でも例外を出さずデフォルトに落ちる", async () => {
    mockLocalStorage.setItem("carequest-state-v1", "{ broken json !!!}");

    const { loadCareState } = await import("@/lib/storage");
    expect(() => loadCareState()).not.toThrow();
    const state = loadCareState();
    expect(state.logs).toEqual([]);
    expect(state.customTasks).toEqual([]);
  });

  it("空文字列を保存していた場合もデフォルトに落ちる", async () => {
    mockLocalStorage.setItem("carequest-state-v1", "");

    const { loadCareState } = await import("@/lib/storage");
    // JSON.parse("") は SyntaxError → catch → デフォルト
    expect(() => loadCareState()).not.toThrow();
    const state = loadCareState();
    expect(state.logs).toEqual([]);
  });
});
