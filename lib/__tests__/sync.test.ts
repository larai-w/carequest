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

    expect(result).toEqual({ skipped: true, restoredCount: 0, backedUp: false });
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
