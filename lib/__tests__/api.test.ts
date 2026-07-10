import { describe, it, expect, vi, beforeEach } from "vitest";

// Amplify の初期化と認証モジュールをモックする。
// テスト環境ではブラウザ API も Cognito も利用できないため。
vi.mock("@/lib/amplify", () => ({}));
vi.mock("@aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({ tokens: undefined }),
  getCurrentUser: vi.fn().mockRejectedValue(new Error("not authenticated")),
}));

// グローバル fetch をモックする関数
function mockFetch(body: unknown, ok = true) {
  const response = {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

describe("fetchCareEntries", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    // NEXT_PUBLIC_API_URL を設定して entriesEndpoint が空でないようにする
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://example.com/api");
  });

  it("正常なレスポンスをそのまま返す", async () => {
    const validLogs = [
      {
        id: "log-1",
        taskId: "medicine",
        title: "薬を渡した",
        points: 5,
        completedAt: "2024-03-15T10:00:00",
        date: "2024-03-15",
        energyLevel: "normal",
      },
      {
        id: "log-2",
        taskId: "meal",
        title: "食事を手伝った",
        points: 10,
        completedAt: "2024-03-15T12:00:00",
        date: "2024-03-15",
        energyLevel: "energetic",
      },
    ];
    mockFetch(validLogs);

    const { fetchCareEntries } = await import("@/lib/api");
    const result = await fetchCareEntries();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("log-1");
    expect(result[1].id).toBe("log-2");
  });

  it("points が文字列の不正要素を静かに除外する", async () => {
    const mixed = [
      {
        id: "log-ok",
        taskId: "medicine",
        title: "薬を渡した",
        points: 5,
        completedAt: "2024-03-15T10:00:00",
        date: "2024-03-15",
        energyLevel: "normal",
      },
      {
        id: "log-bad-points",
        taskId: "meal",
        title: "食事",
        points: "ten",   // 数値でない → 除外
        completedAt: "2024-03-15T12:00:00",
        date: "2024-03-15",
        energyLevel: "normal",
      },
    ];
    mockFetch(mixed);

    const { fetchCareEntries } = await import("@/lib/api");
    const result = await fetchCareEntries();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("log-ok");
  });

  it("date 形式が不正な要素を静かに除外する", async () => {
    const mixed = [
      {
        id: "log-ok",
        taskId: "medicine",
        title: "薬を渡した",
        points: 5,
        completedAt: "2024-03-15T10:00:00",
        date: "2024-03-15",
        energyLevel: "normal",
      },
      {
        id: "log-bad-date",
        taskId: "meal",
        title: "食事",
        points: 10,
        completedAt: "2024-03-15T12:00:00",
        date: "2024/03/15",   // スラッシュ区切り → 除外
        energyLevel: "normal",
      },
    ];
    mockFetch(mixed);

    const { fetchCareEntries } = await import("@/lib/api");
    const result = await fetchCareEntries();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("log-ok");
  });

  it("配列に文字列・null・非オブジェクト要素が混ざっていても除外して健全要素を返す", async () => {
    const mixed = [
      {
        id: "log-ok",
        taskId: "medicine",
        title: "薬を渡した",
        points: 5,
        completedAt: "2024-03-15T10:00:00",
        date: "2024-03-15",
        energyLevel: "normal",
      },
      "not-an-object",   // 文字列 → 除外
      null,              // null → 除外
      42,                // 数値 → 除外
      [],                // 配列 → 除外
    ];
    mockFetch(mixed);

    const { fetchCareEntries } = await import("@/lib/api");
    const result = await fetchCareEntries();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("log-ok");
  });

  it("レスポンスが配列でない場合は空配列を返す", async () => {
    mockFetch({ items: [] });  // オブジェクト → 空配列

    const { fetchCareEntries } = await import("@/lib/api");
    const result = await fetchCareEntries();
    expect(result).toEqual([]);
  });

  it("レスポンスが null の場合は空配列を返す", async () => {
    mockFetch(null);

    const { fetchCareEntries } = await import("@/lib/api");
    const result = await fetchCareEntries();
    expect(result).toEqual([]);
  });

  it("レスポンスが ok でない場合は空配列を返す", async () => {
    mockFetch([], false);  // ok=false

    const { fetchCareEntries } = await import("@/lib/api");
    const result = await fetchCareEntries();
    expect(result).toEqual([]);
  });

  it("全要素が不正でも空配列を返し例外を出さない", async () => {
    const allInvalid = [
      { id: "bad1", points: "x", date: "2024-03-15" },
      { id: "bad2", points: 5, date: "not-a-date" },
      "string-entry",
    ];
    mockFetch(allInvalid);

    const { fetchCareEntries } = await import("@/lib/api");
    await expect(fetchCareEntries()).resolves.toEqual([]);
  });
});
