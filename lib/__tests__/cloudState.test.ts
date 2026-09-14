import { describe, it, expect, vi, beforeEach } from "vitest";

// クラウド控えの状態(2026-09-14 /hci-check「クラウド控え」)。
// #1 端末の記録の持ち主、#3 最後に控えた日時、#4 削除後に自動で控えるのを止める、#6 ログイン切れ。

function mockLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
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

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("端末の記録の持ち主(#1)", () => {
  it("最初にやりとりしたアカウントを持ち主として覚え、同じアカウントなら ok", async () => {
    mockLocalStorage();
    const { checkDeviceOwner } = await import("@/lib/cloudState");
    await expect(checkDeviceOwner("alice@example.com")).resolves.toBe("ok");
    await expect(checkDeviceOwner("alice@example.com")).resolves.toBe("ok");
  });

  it("別のアカウントなら other-account(持ち主は書き換えない)", async () => {
    mockLocalStorage();
    const { checkDeviceOwner } = await import("@/lib/cloudState");
    await checkDeviceOwner("alice@example.com");
    await expect(checkDeviceOwner("bob@example.com")).resolves.toBe("other-account");
    await expect(checkDeviceOwner("alice@example.com")).resolves.toBe("ok");
  });

  it("アカウント名そのものは端末に残さない(共有端末の次の人に見えないように)", async () => {
    const store = mockLocalStorage();
    const { checkDeviceOwner } = await import("@/lib/cloudState");
    await checkDeviceOwner("alice@example.com");
    expect([...store.values()].join("\n")).not.toContain("alice");
  });

  it("本人が「この端末の記録はこのアカウントのもの」と選んだら持ち主を移す", async () => {
    mockLocalStorage();
    const { checkDeviceOwner, adoptDeviceOwner } = await import("@/lib/cloudState");
    await checkDeviceOwner("alice@example.com");
    await adoptDeviceOwner("bob@example.com");
    await expect(checkDeviceOwner("bob@example.com")).resolves.toBe("ok");
    await expect(checkDeviceOwner("alice@example.com")).resolves.toBe("other-account");
  });

  it("すべての記録を削除したら持ち主も忘れる", async () => {
    mockLocalStorage();
    const { checkDeviceOwner, clearCloudState } = await import("@/lib/cloudState");
    await checkDeviceOwner("alice@example.com");
    clearCloudState();
    await expect(checkDeviceOwner("bob@example.com")).resolves.toBe("ok");
  });
});

describe("最後にクラウドへ控えた日時(#3)", () => {
  it("記録して読み出せる。無ければ null", async () => {
    mockLocalStorage();
    const { getLastCloudBackupAt, setLastCloudBackupAt } = await import("@/lib/cloudState");
    expect(getLastCloudBackupAt()).toBeNull();
    setLastCloudBackupAt("2026-09-14T05:05:00.000Z");
    expect(getLastCloudBackupAt()).toBe("2026-09-14T05:05:00.000Z");
  });
});

describe("自動で控えるのを止める(#4)", () => {
  it("止める・再開する", async () => {
    mockLocalStorage();
    const { isAutoBackupPaused, pauseAutoBackup, resumeAutoBackup } = await import("@/lib/cloudState");
    expect(isAutoBackupPaused()).toBe(false);
    pauseAutoBackup();
    expect(isAutoBackupPaused()).toBe(true);
    resumeAutoBackup();
    expect(isAutoBackupPaused()).toBe(false);
  });

  it("すべての記録を削除したら、止めていた状態と最後の日時も消える", async () => {
    mockLocalStorage();
    const { isAutoBackupPaused, pauseAutoBackup, setLastCloudBackupAt, getLastCloudBackupAt, clearCloudState } =
      await import("@/lib/cloudState");
    pauseAutoBackup();
    setLastCloudBackupAt("2026-09-14T05:05:00.000Z");
    clearCloudState();
    expect(isAutoBackupPaused()).toBe(false);
    expect(getLastCloudBackupAt()).toBeNull();
  });
});

describe("ログインが切れた印(#6)", () => {
  it("付けて、ログインし直したら外す", async () => {
    mockLocalStorage();
    const { hasSessionLost, markSessionLost, clearSessionLost } = await import("@/lib/cloudState");
    expect(hasSessionLost()).toBe(false);
    markSessionLost();
    expect(hasSessionLost()).toBe(true);
    clearSessionLost();
    expect(hasSessionLost()).toBe(false);
  });

  it("localStorage が使えなくても例外を出さない", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      },
    });
    const m = await import("@/lib/cloudState");
    expect(() => m.markSessionLost()).not.toThrow();
    expect(m.hasSessionLost()).toBe(false);
    expect(m.isAutoBackupPaused()).toBe(false);
    expect(m.getLastCloudBackupAt()).toBeNull();
    await expect(m.checkDeviceOwner("a")).resolves.toBe("ok");
  });
});
