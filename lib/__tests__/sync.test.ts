import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAuthSession } from "@aws-amplify/auth";
import { createInitialState } from "@/lib/storage";
import type { CareLog } from "@/lib/types";

// api.test.ts と同じ方針: Amplify と認証モジュールをモックする。
vi.mock("@/lib/amplify", () => ({
  ensureAmplifyConfigured: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({ tokens: undefined }),
  getCurrentUser: vi.fn().mockResolvedValue({ username: "demo" }),
}));

const SIGNED_IN_FLAG_KEY = "carequest-signed-in-v1";
const STORAGE_KEY = "carequest-state-v1";

// window.localStorage(フラグ + 保存状態)と dispatchEvent を備えた簡易 window モック。
function mockWindow(flag: string | null, logs: CareLog[] = []): Map<string, string> {
  const store = new Map<string, string>();
  if (flag !== null) {
    store.set(SIGNED_IN_FLAG_KEY, flag);
  }
  store.set(STORAGE_KEY, JSON.stringify({ version: 6, ...createInitialState(), logs }));
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
    dispatchEvent: vi.fn(),
  });
  return store;
}

type Session = Awaited<ReturnType<typeof fetchAuthSession>>;

function signedInSession(): Session {
  return {
    tokens: {
      idToken: { toString: () => "valid-token" } as unknown as NonNullable<Session["tokens"]>["idToken"],
      accessToken: undefined as unknown as NonNullable<Session["tokens"]>["accessToken"],
    },
    credentials: undefined,
    identityId: undefined,
    userSub: undefined,
  };
}

function makeLog(id: string): CareLog {
  return {
    id,
    taskId: "medicine",
    title: "薬を渡した",
    points: 5,
    completedAt: "2024-03-15T10:00:00",
    date: "2024-03-15",
    energyLevel: "normal",
  };
}

describe("syncOnSignIn", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://example.com/api");
  });

  it("未サインインなら skipped を返し、ネットワークに触れない", async () => {
    mockWindow(null); // フラグなし = 未サインイン
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { syncOnSignIn } = await import("@/lib/sync");
    const result = await syncOnSignIn();

    expect(result).toEqual({ skipped: true, restoredCount: 0, backedUp: false, backupTotal: 0, paused: false, blocked: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("サインイン済み: サーバーの新しい記録を復元し、和集合をバックアップする", async () => {
    const store = mockWindow("1", [makeLog("local-1")]);
    vi.mocked(fetchAuthSession).mockResolvedValue(signedInSession());
    // GET(復元)はサーバーの記録、POST(バックアップ)は ok:true。同一 fetch で両方に応える。
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([makeLog("server-1")]) }),
    );

    const { syncOnSignIn } = await import("@/lib/sync");
    const result = await syncOnSignIn();

    expect(result.skipped).toBe(false);
    // server-1 がローカルに無い → 1 件復元
    expect(result.restoredCount).toBe(1);
    // 復元後の 2 件(local-1 + server-1)を全件 PUT して成功
    expect(result.backedUp).toBe(true);
    // ローカルにも server-1 がマージされて保存されている
    const saved = JSON.parse(store.get(STORAGE_KEY)!);
    expect(saved.logs.map((l: CareLog) => l.id)).toEqual(["local-1", "server-1"]);
  });

  it("復元の保存に失敗したら件数を増やさず、同期通知も送らない", async () => {
    const store = mockWindow("1", [makeLog("local-1")]);
    const before = store.get(STORAGE_KEY);
    vi.mocked(fetchAuthSession).mockResolvedValue(signedInSession());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: vi.fn().mockResolvedValue([makeLog("server-1")]),
    }));
    window.localStorage.setItem = () => { throw new Error("quota"); };
    const { syncOnSignIn } = await import("@/lib/sync");
    const result = await syncOnSignIn();
    expect(result.restoredCount).toBe(0);
    expect(window.dispatchEvent).not.toHaveBeenCalled();
    expect(store.get(STORAGE_KEY)).toBe(before);
  });

  it("サインイン済みでサーバーに新規が無ければ restoredCount 0(既存は保持)", async () => {
    mockWindow("1", [makeLog("same")]);
    vi.mocked(fetchAuthSession).mockResolvedValue(signedInSession());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([makeLog("same")]) }),
    );

    const { syncOnSignIn } = await import("@/lib/sync");
    const result = await syncOnSignIn();

    expect(result.skipped).toBe(false);
    expect(result.restoredCount).toBe(0);
    expect(result.backedUp).toBe(true);
  });
});

// 2026-09-14 /hci-check 候補 #3: 端末で取り消した記録を、同期でクラウドから戻さず、クラウドからも消す。
describe("syncOnSignIn と取り消した記録", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://example.com/api");
  });

  it("取り消した記録はクラウドに残っていても戻さず、クラウドから消して控えを外す", async () => {
    const store = mockWindow("1", [makeLog("local-1")]);
    store.set("carequest-pending-cloud-deletes-v1", JSON.stringify(["undone-1"]));
    vi.mocked(fetchAuthSession).mockResolvedValue(signedInSession());
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([makeLog("undone-1"), makeLog("server-1")]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { syncOnSignIn } = await import("@/lib/sync");
    const result = await syncOnSignIn();

    expect(result.restoredCount).toBe(1);
    const saved = JSON.parse(store.get(STORAGE_KEY)!);
    expect(saved.logs.map((l: CareLog) => l.id)).toEqual(["local-1", "server-1"]);

    const deletes = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "DELETE");
    expect(deletes.map(([url]) => url)).toEqual(["https://example.com/api/entries/undone-1"]);
    expect(store.has("carequest-pending-cloud-deletes-v1")).toBe(false);
  });

  it("クラウドから消せなければ控えを残す(次の同期でまた消す)", async () => {
    const store = mockWindow("1", []);
    store.set("carequest-pending-cloud-deletes-v1", JSON.stringify(["undone-1"]));
    vi.mocked(fetchAuthSession).mockResolvedValue(signedInSession());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url: string, init?: RequestInit) =>
        init?.method === "DELETE"
          ? { ok: false, json: vi.fn().mockResolvedValue({}) }
          : { ok: true, json: vi.fn().mockResolvedValue([]) },
      ),
    );

    const { syncOnSignIn } = await import("@/lib/sync");
    await syncOnSignIn();

    expect(JSON.parse(store.get("carequest-pending-cloud-deletes-v1")!)).toEqual(["undone-1"]);
  });
});

// 2026-09-14 /hci-check「クラウド控え」#1・#2・#4
describe("syncOnSignIn の結果を事実どおりに返す", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://example.com/api");
  });

  it("バックアップが失敗したら backedUp は false、件数は返す(#2)", async () => {
    mockWindow("1", [makeLog("local-1")]);
    vi.mocked(fetchAuthSession).mockResolvedValue(signedInSession());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url: string, init?: RequestInit) =>
        init?.method === "POST"
          ? { ok: false, json: vi.fn().mockResolvedValue({}) }
          : { ok: true, json: vi.fn().mockResolvedValue([]) },
      ),
    );
    const { syncOnSignIn } = await import("@/lib/sync");
    const result = await syncOnSignIn();
    expect(result.backedUp).toBe(false);
    expect(result.backupTotal).toBe(1);
    expect(result.blocked).toBeNull();
  });

  it("別のアカウントの記録がある端末では、読み込みも送信もしない(#1)", async () => {
    const store = mockWindow("1", [makeLog("local-1")]);
    const before = store.get(STORAGE_KEY);
    vi.mocked(fetchAuthSession).mockResolvedValue(signedInSession());
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([makeLog("server-1")]) });
    vi.stubGlobal("fetch", fetchSpy);
    const { adoptDeviceOwner } = await import("@/lib/cloudState");
    await adoptDeviceOwner("someone-else");

    const { syncOnSignIn } = await import("@/lib/sync");
    const result = await syncOnSignIn();

    expect(result.blocked).toBe("other-account");
    expect(result.restoredCount).toBe(0);
    expect(result.backedUp).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(store.get(STORAGE_KEY)).toBe(before);
  });

  it("自動で控えるのを止めているなら、読み込みはするが送らない(#4)", async () => {
    mockWindow("1", [makeLog("local-1")]);
    vi.mocked(fetchAuthSession).mockResolvedValue(signedInSession());
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([makeLog("server-1")]) });
    vi.stubGlobal("fetch", fetchSpy);
    const { pauseAutoBackup } = await import("@/lib/cloudState");
    pauseAutoBackup();

    const { syncOnSignIn } = await import("@/lib/sync");
    const result = await syncOnSignIn();

    expect(result.paused).toBe(true);
    expect(result.restoredCount).toBe(1);
    expect(result.backedUp).toBe(false);
    expect(fetchSpy.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toHaveLength(0);
  });
});

// 2026-09-14 /hci-check「直した後」#1: 通信できないだけで、ログアウト扱い・「切れた」扱いにしない。
describe("syncOnSignIn と通信できないとき", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://example.com/api");
  });

  it("ログインを確かめられなければ unreachable を返し、フラグを残して通信しない", async () => {
    const store = mockWindow("1", [makeLog("local-1")]);
    vi.mocked(fetchAuthSession).mockRejectedValue(Object.assign(new Error("Network error"), { name: "NetworkError" }));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { syncOnSignIn } = await import("@/lib/sync");
    const result = await syncOnSignIn();

    expect(result).toEqual({ skipped: false, restoredCount: 0, backedUp: false, backupTotal: 0, paused: false, blocked: "unreachable" });
    expect(store.get(SIGNED_IN_FLAG_KEY)).toBe("1");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
