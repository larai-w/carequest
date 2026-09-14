import { describe, it, expect, vi, beforeEach } from "vitest";

// 端末で取り消した記録を、クラウドのバックアップからも消すための「消し残し」控え。
// 2026-09-14 /hci-check 候補 #3: 取り消しても、バックアップ済みの記録はクラウドに残り続けていた。
// 通信できないときに控えを残し、次の同期で消す。復元で取り消した記録を戻さない。

const PENDING_KEY = "carequest-pending-cloud-deletes-v1";

function mockLocalStorage(initial: Record<string, string> = {}, { throwOnSet = false } = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (throwOnSet) throw new DOMException("quota", "QuotaExceededError");
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
  return store;
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("markDeletedForCloud / pendingCloudDeletes", () => {
  it("取り消した id を控え、同じ id は二重に控えない", async () => {
    mockLocalStorage();
    const { markDeletedForCloud, pendingCloudDeletes } = await import("@/lib/cloudDeletes");
    markDeletedForCloud("a");
    markDeletedForCloud("b");
    markDeletedForCloud("a");
    expect(pendingCloudDeletes()).toEqual(["a", "b"]);
  });

  it("「元に戻す」で控えから外す", async () => {
    mockLocalStorage();
    const { markDeletedForCloud, unmarkDeletedForCloud, pendingCloudDeletes } = await import("@/lib/cloudDeletes");
    markDeletedForCloud("a");
    markDeletedForCloud("b");
    unmarkDeletedForCloud("a");
    expect(pendingCloudDeletes()).toEqual(["b"]);
  });

  it("壊れた値が入っていても例外を出さず空として扱う", async () => {
    mockLocalStorage({ [PENDING_KEY]: "{broken" });
    const { pendingCloudDeletes } = await import("@/lib/cloudDeletes");
    expect(pendingCloudDeletes()).toEqual([]);
  });

  it("localStorage が使えなくても例外を出さない(記録の操作を止めない)", async () => {
    mockLocalStorage({}, { throwOnSet: true });
    const { markDeletedForCloud } = await import("@/lib/cloudDeletes");
    expect(() => markDeletedForCloud("a")).not.toThrow();
  });
});

describe("flushPendingCloudDeletes", () => {
  it("消せた id は控えから外し、失敗した id は次に回す", async () => {
    mockLocalStorage();
    const { markDeletedForCloud, flushPendingCloudDeletes, pendingCloudDeletes } = await import("@/lib/cloudDeletes");
    markDeletedForCloud("ok-1");
    markDeletedForCloud("fail-1");
    const del = vi.fn(async (id: string) => ({ skipped: false as const, ok: id.startsWith("ok") }));
    const result = await flushPendingCloudDeletes(del);
    expect(result).toEqual({ skipped: false, deleted: 1, failed: 1 });
    expect(pendingCloudDeletes()).toEqual(["fail-1"]);
  });

  it("未サインイン(skipped)なら控えをそのまま残す", async () => {
    mockLocalStorage();
    const { markDeletedForCloud, flushPendingCloudDeletes, pendingCloudDeletes } = await import("@/lib/cloudDeletes");
    markDeletedForCloud("a");
    const del = vi.fn(async () => ({ skipped: true as const }));
    const result = await flushPendingCloudDeletes(del);
    expect(result).toEqual({ skipped: true, deleted: 0, failed: 0 });
    expect(pendingCloudDeletes()).toEqual(["a"]);
  });

  it("消している途中で「元に戻す」された id は、控えに戻さない", async () => {
    mockLocalStorage();
    const { markDeletedForCloud, unmarkDeletedForCloud, flushPendingCloudDeletes, pendingCloudDeletes } = await import("@/lib/cloudDeletes");
    markDeletedForCloud("a");
    const del = vi.fn(async () => {
      unmarkDeletedForCloud("a");
      return { skipped: false as const, ok: false };
    });
    await flushPendingCloudDeletes(del);
    expect(pendingCloudDeletes()).toEqual([]);
  });

  it("控えが無ければ通信しない", async () => {
    mockLocalStorage();
    const { flushPendingCloudDeletes } = await import("@/lib/cloudDeletes");
    const del = vi.fn();
    await expect(flushPendingCloudDeletes(del)).resolves.toEqual({ skipped: false, deleted: 0, failed: 0 });
    expect(del).not.toHaveBeenCalled();
  });
});

describe("withoutPendingDeletes", () => {
  it("クラウドから戻ってきた記録のうち、取り消し済み(控えにある)ものを除く", async () => {
    mockLocalStorage();
    const { markDeletedForCloud, withoutPendingDeletes } = await import("@/lib/cloudDeletes");
    markDeletedForCloud("b");
    const fetched = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(withoutPendingDeletes(fetched).map((l) => l.id)).toEqual(["a", "c"]);
  });
});
