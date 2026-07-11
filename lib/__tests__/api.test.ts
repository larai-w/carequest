import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAuthSession } from "@aws-amplify/auth";

// Amplify の初期化と認証モジュールをモックする。
// テスト環境ではブラウザ API も Cognito も利用できないため。
// T45 で lib/amplify は副作用 configure から ensureAmplifyConfigured(動的 import 前提)に変わった。
vi.mock("@/lib/amplify", () => ({
  ensureAmplifyConfigured: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({ tokens: undefined }),
  getCurrentUser: vi.fn().mockRejectedValue(new Error("not authenticated")),
}));

// SIGNED_IN_FLAG_KEY と揃える(lib/api の軽量フラグの localStorage キー)。
const SIGNED_IN_FLAG_KEY = "carequest-signed-in-v1";

// localStorage の簡易モック。二段判定の第一段(フラグ)を制御するために使う。
function mockLocalStorage(flag: string | null) {
  const store = new Map<string, string>();
  if (flag !== null) {
    store.set(SIGNED_IN_FLAG_KEY, flag);
  }
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
  return store;
}

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

// isSignedIn のテスト(T45: 二段判定)
// 第一段: 軽量フラグ(localStorage)。第二段: amplify 動的 import + fetchAuthSession。
describe("isSignedIn", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("フラグが無ければ amplify を一切読み込まず即 false を返す", async () => {
    mockLocalStorage(null); // フラグなし
    const amplify = await import("@/lib/amplify");

    const { isSignedIn } = await import("@/lib/api");
    await expect(isSignedIn()).resolves.toBe(false);

    // 第一段で確定 → amplify も fetchAuthSession も呼ばれていないこと
    expect(vi.mocked(amplify.ensureAmplifyConfigured)).not.toHaveBeenCalled();
    expect(vi.mocked(fetchAuthSession)).not.toHaveBeenCalled();
  });

  it("フラグがあり有効なトークンがある場合は true を返す", async () => {
    mockLocalStorage("1"); // フラグあり → 第二段へ
    // idToken が存在するセッションを返す
    vi.mocked(fetchAuthSession).mockResolvedValueOnce({
      tokens: {
        idToken: { toString: () => "valid-token" } as unknown as NonNullable<Awaited<ReturnType<typeof fetchAuthSession>>["tokens"]>["idToken"],
        accessToken: undefined as unknown as NonNullable<Awaited<ReturnType<typeof fetchAuthSession>>["tokens"]>["accessToken"],
      },
      credentials: undefined,
      identityId: undefined,
      userSub: undefined,
    });

    const { isSignedIn } = await import("@/lib/api");
    await expect(isSignedIn()).resolves.toBe(true);
    expect(vi.mocked(fetchAuthSession)).toHaveBeenCalled();
  });

  it("フラグはあるがトークンが undefined の場合は false を返し、フラグを掃除する", async () => {
    const store = mockLocalStorage("1");
    vi.mocked(fetchAuthSession).mockResolvedValueOnce({
      tokens: undefined,
      credentials: undefined,
      identityId: undefined,
      userSub: undefined,
    });

    const { isSignedIn } = await import("@/lib/api");
    await expect(isSignedIn()).resolves.toBe(false);
    // 不整合フラグが掃除されていること
    expect(store.has(SIGNED_IN_FLAG_KEY)).toBe(false);
  });

  it("フラグはあるが idToken が存在しない場合は false を返す", async () => {
    mockLocalStorage("1");
    vi.mocked(fetchAuthSession).mockResolvedValueOnce({
      tokens: {
        idToken: undefined,
        accessToken: undefined as unknown as NonNullable<Awaited<ReturnType<typeof fetchAuthSession>>["tokens"]>["accessToken"],
      },
      credentials: undefined,
      identityId: undefined,
      userSub: undefined,
    });

    const { isSignedIn } = await import("@/lib/api");
    await expect(isSignedIn()).resolves.toBe(false);
  });

  it("フラグはあるが fetchAuthSession が例外を投げた場合は安全側(false)に倒れ、フラグを掃除する", async () => {
    // ネットワーク障害・セッション切れ・設定なし等を想定
    const store = mockLocalStorage("1");
    vi.mocked(fetchAuthSession).mockRejectedValueOnce(new Error("Network error"));

    const { isSignedIn } = await import("@/lib/api");
    await expect(isSignedIn()).resolves.toBe(false);
    expect(store.has(SIGNED_IN_FLAG_KEY)).toBe(false);
  });

  it("セッション切れ(TokenExpiredException 相当)でも安全側に倒れる", async () => {
    mockLocalStorage("1");
    const expiredError = new Error("TokenExpiredException: Token has expired");
    vi.mocked(fetchAuthSession).mockRejectedValueOnce(expiredError);

    const { isSignedIn } = await import("@/lib/api");
    await expect(isSignedIn()).resolves.toBe(false);
  });
});

// syncCareLog のテスト(T45: 未サインインフラグなしなら amplify を読まずスキップ)
describe("syncCareLog", () => {
  const sampleLog = {
    id: "log-1",
    taskId: "medicine",
    title: "薬を渡した",
    points: 5,
    completedAt: "2024-03-15T10:00:00",
    date: "2024-03-15",
    energyLevel: "normal" as const,
  };

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://example.com/api");
  });

  it("フラグが無ければ amplify を読まずに { skipped: true } を返す", async () => {
    mockLocalStorage(null); // 未サインイン
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const amplify = await import("@/lib/amplify");

    const { syncCareLog } = await import("@/lib/api");
    await expect(syncCareLog(sampleLog)).resolves.toEqual({ skipped: true });

    // 認証 SDK も同期 fetch も呼ばれない
    expect(vi.mocked(amplify.ensureAmplifyConfigured)).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("フラグがあり有効セッションなら同期を実行し成功を返す", async () => {
    // isSignedIn(第二段)と getAuthHeaders 用にトークンを返す
    mockLocalStorage("1");
    vi.mocked(fetchAuthSession).mockResolvedValue({
      tokens: {
        idToken: { toString: () => "valid-token" } as unknown as NonNullable<Awaited<ReturnType<typeof fetchAuthSession>>["tokens"]>["idToken"],
        accessToken: undefined as unknown as NonNullable<Awaited<ReturnType<typeof fetchAuthSession>>["tokens"]>["accessToken"],
      },
      credentials: undefined,
      identityId: undefined,
      userSub: undefined,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const { syncCareLog } = await import("@/lib/api");
    await expect(syncCareLog(sampleLog)).resolves.toEqual({ skipped: false, ok: true });
  });
});
