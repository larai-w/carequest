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
      energyHistory: [{ date: "2024-03-15", energyLevel: "energetic" }],
      supportNudgeLastShown: "",
    };
    mockLocalStorage.setItem("carequest-state-v1", JSON.stringify(saved));

    const { loadCareState } = await import("@/lib/storage");
    const state = loadCareState();
    expect(state.user.name).toBe("テスト太郎");
    expect(state.logs.length).toBe(1);
    expect(state.note).toBe("今日のメモ");
    expect(state.customTasks.length).toBe(1);
    expect(state.energyHistory).toEqual([{ date: "2024-03-15", energyLevel: "energetic" }]);
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

  // -------------------------------------------------------------------------
  // T19: スキーマバージョン + マイグレーション + フィールド単位の救済
  // -------------------------------------------------------------------------

  function validLog(overrides: Record<string, unknown> = {}) {
    return {
      id: "log-1",
      taskId: "medicine",
      title: "薬を渡した",
      points: 5,
      completedAt: "2024-03-15T10:00:00",
      date: "2024-03-15",
      energyLevel: "normal",
      ...overrides,
    };
  }

  it("version なしの旧データを v2 へ移行し、保存で version が付与される", async () => {
    const oldFormat = {
      user: { name: "旧ユーザー" },
      logs: [validLog()],
      note: "メモ",
      // version なし・customTasks なし
    };
    mockLocalStorage.setItem("carequest-state-v1", JSON.stringify(oldFormat));

    const { loadCareStateWithReport, saveCareState, CURRENT_SCHEMA_VERSION } = await import(
      "@/lib/storage"
    );
    const { state, recovered } = loadCareStateWithReport();

    // 移行しても健全なフィールドは残る。version 付与だけの移行は救済ではない。
    expect(recovered).toBe(false);
    expect(state.user.name).toBe("旧ユーザー");
    expect(state.logs.length).toBe(1);
    expect(state.note).toBe("メモ");

    // 保存すると最新バージョンが書き込まれる。
    saveCareState(state);
    const persisted = JSON.parse(mockLocalStorage.getItem("carequest-state-v1")!);
    expect(persisted.version).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("logs 内の不正要素だけ除外し、健全な要素は温存する", async () => {
    const data = {
      version: 2,
      user: { name: "太郎" },
      logs: [
        validLog({ id: "ok-1" }),
        validLog({ id: "bad-points", points: "5" }), // points が文字列 → 除外
        validLog({ id: "bad-date", date: "2024/03/15" }), // date 形式不正 → 除外
        validLog({ id: "ok-2", points: 20 }),
        "not-an-object", // → 除外
      ],
      note: "",
      customTasks: [],
    };
    mockLocalStorage.setItem("carequest-state-v1", JSON.stringify(data));

    const { loadCareStateWithReport } = await import("@/lib/storage");
    const { state, recovered } = loadCareStateWithReport();

    expect(recovered).toBe(true);
    expect(state.logs.map((l) => l.id)).toEqual(["ok-1", "ok-2"]);
    // 健全要素の内容は保持される
    expect(state.logs[1].points).toBe(20);
    // 健全なユーザーフィールドも残る
    expect(state.user.name).toBe("太郎");
  });

  it("型不正フィールド(note・logs が非配列)はデフォルトに置換し、他は残す", async () => {
    const data = {
      version: 2,
      user: { name: "花子", energyLevel: "energetic" },
      logs: "壊れた文字列", // 配列でない → [] に置換
      note: 12345, // 文字列でない → "" に置換
      customTasks: [{ id: "c1", title: "自作", points: 10, description: "x" }],
    };
    mockLocalStorage.setItem("carequest-state-v1", JSON.stringify(data));

    const { loadCareStateWithReport } = await import("@/lib/storage");
    const { state, recovered } = loadCareStateWithReport();

    expect(recovered).toBe(true);
    expect(state.logs).toEqual([]);
    expect(state.note).toBe("");
    // 健全なフィールドは温存
    expect(state.user.name).toBe("花子");
    expect(state.user.energyLevel).toBe("energetic");
    expect(state.customTasks.length).toBe(1);
  });

  it("user の個別フィールドが型不正でもデフォルトで補完し、健全フィールドは残す", async () => {
    const data = {
      version: 2,
      user: {
        name: "健一",
        energyLevel: "invalid-level", // → normal
        todayPoints: "多い", // → 0
        restMode: "yes", // → false
        goodThings: ["散歩", 42, "読書"], // 数値要素は除外
      },
      logs: [],
      note: "",
      customTasks: [],
    };
    mockLocalStorage.setItem("carequest-state-v1", JSON.stringify(data));

    const { loadCareStateWithReport } = await import("@/lib/storage");
    const { state } = loadCareStateWithReport();

    expect(state.user.name).toBe("健一");
    expect(state.user.energyLevel).toBe("normal");
    expect(state.user.todayPoints).toBe(0);
    expect(state.user.restMode).toBe(false);
    expect(state.user.goodThings).toEqual(["散歩", "読書"]);
  });

  it("往復(save → load)で健全データが完全に一致する", async () => {
    const { saveCareState, loadCareState, createInitialUser } = await import("@/lib/storage");
    const original = {
      user: {
        ...createInitialUser(),
        name: "往復太郎",
        todayPoints: 40,
        goodThings: ["よく眠れた"],
      },
      logs: [validLog({ id: "rt-1" })],
      note: "往復メモ",
      customTasks: [{ id: "ct-1", title: "自作タスク", points: 12, description: "説明" }],
      energyHistory: [{ date: "2024-03-15", energyLevel: "low" as const }],
      supportNudgeLastShown: "2024-03-14",
    };

    saveCareState(original);
    const loaded = loadCareState();
    expect(loaded).toEqual(original);
  });

  it("JSON 全体が壊れているときは recovered=true でデフォルトに落ちる", async () => {
    mockLocalStorage.setItem("carequest-state-v1", "{ broken !!!");

    const { loadCareStateWithReport } = await import("@/lib/storage");
    const { state, recovered } = loadCareStateWithReport();
    expect(recovered).toBe(true);
    expect(state.logs).toEqual([]);
  });

  it("完全に健全なデータでは recovered=false", async () => {
    const data = {
      version: 3,
      user: { name: "健全", energyLevel: "normal" },
      logs: [validLog()],
      note: "ok",
      customTasks: [],
      energyHistory: [],
      supportNudgeLastShown: "",
    };
    mockLocalStorage.setItem("carequest-state-v1", JSON.stringify(data));

    const { loadCareStateWithReport } = await import("@/lib/storage");
    const { recovered } = loadCareStateWithReport();
    expect(recovered).toBe(false);
  });

  // -------------------------------------------------------------------------
  // T23: スキーマ v3(エネルギー履歴 + 相談窓口カードの表示履歴)
  // -------------------------------------------------------------------------

  it("v2 データを v3 へ移行し、新フィールドが空で補完される(救済ではない)", async () => {
    const v2data = {
      version: 2,
      user: { name: "移行ユーザー" },
      logs: [validLog()],
      note: "メモ",
      customTasks: [],
      // energyHistory / supportNudgeLastShown なし
    };
    mockLocalStorage.setItem("carequest-state-v1", JSON.stringify(v2data));

    const { loadCareStateWithReport, saveCareState, CURRENT_SCHEMA_VERSION } = await import(
      "@/lib/storage"
    );
    const { state, recovered } = loadCareStateWithReport();

    // フィールド追加だけの移行は救済ではない。既存データは温存される。
    expect(recovered).toBe(false);
    expect(state.user.name).toBe("移行ユーザー");
    expect(state.logs.length).toBe(1);
    expect(state.energyHistory).toEqual([]);
    expect(state.supportNudgeLastShown).toBe("");

    saveCareState(state);
    const persisted = JSON.parse(mockLocalStorage.getItem("carequest-state-v1")!);
    expect(persisted.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
  });

  it("energyHistory 内の不正要素だけ除外し、健全な日は残す", async () => {
    const data = {
      version: 3,
      user: { name: "太郎" },
      logs: [],
      note: "",
      customTasks: [],
      energyHistory: [
        { date: "2024-03-15", energyLevel: "low" },
        { date: "2024/03/14", energyLevel: "low" }, // 日付形式不正 → 除外
        { date: "2024-03-13", energyLevel: "bad" }, // energyLevel 不正 → 除外
        { date: "2024-03-12", energyLevel: "normal" },
        "not-an-object", // → 除外
      ],
      supportNudgeLastShown: "not-a-date", // 日付でない → "" に救済
    };
    mockLocalStorage.setItem("carequest-state-v1", JSON.stringify(data));

    const { loadCareStateWithReport } = await import("@/lib/storage");
    const { state, recovered } = loadCareStateWithReport();

    expect(recovered).toBe(true);
    expect(state.energyHistory.map((e) => e.date)).toEqual(["2024-03-15", "2024-03-12"]);
    expect(state.supportNudgeLastShown).toBe("");
    expect(state.user.name).toBe("太郎");
  });
});
