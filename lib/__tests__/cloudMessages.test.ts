import { describe, it, expect } from "vitest";
import {
  backupStatusMessage,
  cloudDeletedMessage,
  lastBackupLine,
  signInSyncMessage,
} from "@/lib/cloudMessages";

// クラウド控えの知らせ(2026-09-14 /hci-check「クラウド控え」)。
// 「試みた」を「できた」と同じ言い方にしない。

const base = { skipped: false, restoredCount: 0, backedUp: false, backupTotal: 0, paused: false, blocked: null } as const;

describe("signInSyncMessage(#2)", () => {
  it("控えられたときだけ「控えました」と言う", () => {
    expect(signInSyncMessage({ ...base, backedUp: true, backupTotal: 3 })).toBe("記録をクラウドに控えました。");
  });

  it("控えられなかったら、成功と違う言い方で、記録が端末に残っていると言う", () => {
    const message = signInSyncMessage({ ...base, backedUp: false, backupTotal: 3 });
    expect(message).not.toContain("控えました");
    expect(message).toContain("控えられませんでした");
    expect(message).toContain("この端末に残っています");
  });

  it("記録が0件なら「控えました」と言わない", () => {
    const message = signInSyncMessage({ ...base, backupTotal: 0 });
    expect(message).not.toContain("控えました");
    expect(message).toContain("まだありません");
  });

  it("読み込んだが控えられなかったら、両方を事実どおりに言う", () => {
    const message = signInSyncMessage({ ...base, restoredCount: 2, backedUp: false, backupTotal: 5 });
    expect(message).toContain("2件の記録を読み込みました");
    expect(message).toContain("控えられませんでした");
  });

  it("読み込んで控えられたら、両方を言う", () => {
    expect(signInSyncMessage({ ...base, restoredCount: 2, backedUp: true, backupTotal: 5 })).toBe(
      "クラウドから2件の記録を読み込み、クラウドに控えました。",
    );
  });

  it("自動で控えるのを止めているなら、そう言う(#4)", () => {
    const message = signInSyncMessage({ ...base, paused: true, backupTotal: 3 });
    expect(message).toContain("止めています");
    expect(message).not.toContain("控えました");
  });

  it("別のアカウントの記録がある端末では、止めたことを言う(#1)", () => {
    const message = signInSyncMessage({ ...base, blocked: "other-account" });
    expect(message).toContain("別のアカウント");
    expect(message).toContain("止めました");
  });

  it("誰のログインか確かめられなかったときも、止めたことを言う(#1)", () => {
    expect(signInSyncMessage({ ...base, blocked: "unknown" })).toContain("止めました");
  });
});

describe("signInSyncMessage と通信できないとき", () => {
  it("ログインが切れたとは言わず、通信できなかったと言う", () => {
    const message = signInSyncMessage({ ...base, blocked: "unreachable" });
    expect(message).toContain("通信");
    expect(message).toContain("この端末に残っています");
    expect(message).not.toContain("切れ");
    expect(message).not.toContain("控えました");
  });
});

describe("cloudDeletedMessage(#4)", () => {
  it("成功したら、自動で控えるのも止めたことと、再開のしかたを言う", () => {
    const message = cloudDeletedMessage(true);
    expect(message).toContain("クラウドの記録を削除しました");
    expect(message).toContain("この端末の記録は残っています");
    expect(message).toContain("自動でクラウドへ控えるのも止めました");
    expect(message).toContain("クラウドにバックアップ");
  });

  it("失敗したら、削除したとは言わない", () => {
    expect(cloudDeletedMessage(false)).not.toContain("削除しました");
  });
});

describe("lastBackupLine(#3)", () => {
  it("まだ控えていなければ、そう言う", () => {
    expect(lastBackupLine(null, false)).toBe("この端末から、まだクラウドへ控えていません。");
  });

  it("最後に控えた日時を、端末の時刻で言う", () => {
    const iso = new Date(2026, 8, 14, 14, 5).toISOString();
    expect(lastBackupLine(iso, false)).toBe("この端末から最後にクラウドへ控えたのは 9月14日 14:05 です。");
  });

  it("止めているなら、そのことも言う", () => {
    const iso = new Date(2026, 8, 14, 9, 30).toISOString();
    const line = lastBackupLine(iso, true);
    expect(line).toContain("9月14日 9:30");
    expect(line).toContain("自動でクラウドへ控えるのは止めています");
  });

  it("日時が読めなければ「まだ」と同じ扱い", () => {
    expect(lastBackupLine("not-a-date", false)).toBe("この端末から、まだクラウドへ控えていません。");
  });
});

describe("backupStatusMessage", () => {
  it("手動で未ログインなら、ログインで控えられると言う(ログインに統一 #8)", () => {
    const message = backupStatusMessage({ skipped: true }, "manual");
    expect(message).toContain("ログイン");
    expect(message).not.toContain("サインイン");
  });

  it("自動で未ログイン・止めているときは何も言わない", () => {
    expect(backupStatusMessage({ skipped: true }, "auto")).toBe("");
    expect(backupStatusMessage({ skipped: true, reason: "paused" }, "auto")).toBe("");
  });

  it("別のアカウントの記録がある端末では、止めたことと確かめる場所を言う(#1)", () => {
    const message = backupStatusMessage({ skipped: true, reason: "other-account" }, "auto");
    expect(message).toContain("別のアカウント");
    expect(message).toContain("アカウント");
  });

  it("成功・一部・失敗を言い分ける", () => {
    expect(backupStatusMessage({ skipped: false, total: 2, succeeded: 2, failed: 0 }, "manual")).toBe("バックアップが完了しました。");
    expect(backupStatusMessage({ skipped: false, total: 2, succeeded: 1, failed: 1 }, "auto")).toContain("一部");
    expect(backupStatusMessage({ skipped: false, total: 2, succeeded: 0, failed: 2 }, "auto")).toContain("できませんでした");
  });

  // 2026-09-14 /hci-check「直した後」#1: 通信できないことを、未ログインや成功と同じ言い方にしない。
  it("通信できずログインを確かめられなかったら、自動でも手動でも、そう言う", () => {
    for (const mode of ["auto", "manual"] as const) {
      const message = backupStatusMessage({ skipped: true, reason: "unreachable" }, mode);
      expect(message).toContain("通信");
      expect(message).toContain("この端末に残っています");
      expect(message).not.toContain("ログインすると");
      expect(message).not.toContain("完了");
    }
  });

  it("手動で0件なら、控える記録が無いと言う", () => {
    expect(backupStatusMessage({ skipped: false, total: 0, succeeded: 0, failed: 0 }, "manual")).toBe("まだ控えておく記録がありません。");
  });
});
