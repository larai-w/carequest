import { describe, it, expect } from "vitest";
import {
  shouldShowBackupReminder,
  BACKUP_REMINDER_MIN_LOGS,
  BACKUP_REMINDER_STALE_DAYS,
  BACKUP_REMINDER_MIN_GAP_DAYS,
} from "@/lib/backup-reminder";

const TODAY = "2026-07-11";

// 件数がちょうど閾値のときのヘルパー。
function makeInput(overrides: {
  logCount?: number;
  lastExportDate?: string;
  exportReminderLastShown?: string;
}) {
  return {
    logCount: overrides.logCount ?? BACKUP_REMINDER_MIN_LOGS,
    lastExportDate: overrides.lastExportDate ?? "",
    exportReminderLastShown: overrides.exportReminderLastShown ?? "",
  };
}

describe("shouldShowBackupReminder — 件数境界", () => {
  it("記録が 0 件のときは false", () => {
    expect(shouldShowBackupReminder(makeInput({ logCount: 0 }), TODAY)).toBe(false);
  });

  it(`記録が ${BACKUP_REMINDER_MIN_LOGS - 1} 件のときは false`, () => {
    expect(shouldShowBackupReminder(makeInput({ logCount: BACKUP_REMINDER_MIN_LOGS - 1 }), TODAY)).toBe(false);
  });

  it(`記録がちょうど ${BACKUP_REMINDER_MIN_LOGS} 件のときは true(未エクスポート・未表示)`, () => {
    expect(shouldShowBackupReminder(makeInput({ logCount: BACKUP_REMINDER_MIN_LOGS }), TODAY)).toBe(true);
  });

  it(`記録が ${BACKUP_REMINDER_MIN_LOGS + 1} 件以上でも true`, () => {
    expect(shouldShowBackupReminder(makeInput({ logCount: BACKUP_REMINDER_MIN_LOGS + 100 }), TODAY)).toBe(true);
  });
});

describe("shouldShowBackupReminder — 30日境界(lastExportDate あり)", () => {
  // TODAY = 2026-07-11。30日前 = 2026-06-11。

  it("lastExportDate が今日なら false(まだ新鮮)", () => {
    expect(shouldShowBackupReminder(makeInput({ lastExportDate: TODAY }), TODAY)).toBe(false);
  });

  it(`lastExportDate がちょうど ${BACKUP_REMINDER_STALE_DAYS - 1} 日前なら false`, () => {
    // 30日未満 → まだ新鮮
    const recentExport = "2026-06-12"; // 29日前
    expect(shouldShowBackupReminder(makeInput({ lastExportDate: recentExport }), TODAY)).toBe(false);
  });

  it(`lastExportDate がちょうど ${BACKUP_REMINDER_STALE_DAYS} 日前なら true`, () => {
    // 2026-07-11 の 30日前 = 2026-06-11
    const staleExport = "2026-06-11";
    expect(shouldShowBackupReminder(makeInput({ lastExportDate: staleExport }), TODAY)).toBe(true);
  });

  it(`lastExportDate が ${BACKUP_REMINDER_STALE_DAYS} 日より前なら true`, () => {
    const oldExport = "2026-05-01";
    expect(shouldShowBackupReminder(makeInput({ lastExportDate: oldExport }), TODAY)).toBe(true);
  });
});

describe("shouldShowBackupReminder — 未エクスポート(lastExportDate 空)", () => {
  it("一度もエクスポートしていない場合、件数条件のみで判定(空文字は催促しない特例ではなく件数条件を満たせば出る)", () => {
    // 20件以上 + 未エクスポート → true
    expect(shouldShowBackupReminder(makeInput({ lastExportDate: "" }), TODAY)).toBe(true);
  });

  it("件数不足なら未エクスポートでも false", () => {
    expect(shouldShowBackupReminder(makeInput({ logCount: 5, lastExportDate: "" }), TODAY)).toBe(false);
  });
});

describe("shouldShowBackupReminder — throttle(exportReminderLastShown)", () => {
  it("未表示(空文字)なら throttle なし", () => {
    expect(shouldShowBackupReminder(makeInput({ exportReminderLastShown: "" }), TODAY)).toBe(true);
  });

  it(`最終表示が ${BACKUP_REMINDER_MIN_GAP_DAYS - 1} 日前なら throttle で false`, () => {
    // 7日未満 → まだ表示しない
    const recentShown = "2026-07-05"; // 6日前
    expect(shouldShowBackupReminder(makeInput({ exportReminderLastShown: recentShown }), TODAY)).toBe(false);
  });

  it(`最終表示がちょうど ${BACKUP_REMINDER_MIN_GAP_DAYS} 日前なら表示する`, () => {
    // 2026-07-11 の 7日前 = 2026-07-04
    const oldShown = "2026-07-04";
    expect(shouldShowBackupReminder(makeInput({ exportReminderLastShown: oldShown }), TODAY)).toBe(true);
  });

  it("最終表示が十分昔なら true", () => {
    const veryOldShown = "2026-01-01";
    expect(shouldShowBackupReminder(makeInput({ exportReminderLastShown: veryOldShown }), TODAY)).toBe(true);
  });
});

describe("shouldShowBackupReminder — 未来日付のエッジケース", () => {
  it("lastExportDate が未来日付でもクラッシュしない", () => {
    expect(() =>
      shouldShowBackupReminder(makeInput({ lastExportDate: "2099-12-31" }), TODAY),
    ).not.toThrow();
  });

  it("lastExportDate が未来日付なら「まだ新鮮」として false(常時表示にならない)", () => {
    // 未来日付は today より新しい → "last > staleThreshold" が true → false を返す。
    expect(shouldShowBackupReminder(makeInput({ lastExportDate: "2099-12-31" }), TODAY)).toBe(false);
  });

  it("exportReminderLastShown が未来日付でもクラッシュしない", () => {
    expect(() =>
      shouldShowBackupReminder(makeInput({ exportReminderLastShown: "2099-12-31" }), TODAY),
    ).not.toThrow();
  });

  it("exportReminderLastShown が未来日付なら throttle が効いて false(安全側)", () => {
    expect(shouldShowBackupReminder(makeInput({ exportReminderLastShown: "2099-12-31" }), TODAY)).toBe(false);
  });
});

describe("shouldShowBackupReminder — 定数を外部から上書き可能", () => {
  it("minLogs=5 で上書きすると 5 件でも出る", () => {
    expect(
      shouldShowBackupReminder(makeInput({ logCount: 5 }), TODAY, 5, BACKUP_REMINDER_STALE_DAYS, BACKUP_REMINDER_MIN_GAP_DAYS),
    ).toBe(true);
  });

  it("staleDays=7 で上書きすると 8 日前のエクスポートでも out", () => {
    const export8daysAgo = "2026-07-03"; // 8日前
    expect(
      shouldShowBackupReminder(
        makeInput({ lastExportDate: export8daysAgo }),
        TODAY,
        BACKUP_REMINDER_MIN_LOGS,
        7,
        BACKUP_REMINDER_MIN_GAP_DAYS,
      ),
    ).toBe(true);
  });
});
