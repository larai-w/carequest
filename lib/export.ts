import { loadCareState } from "@/lib/storage";
import { getTodayDate } from "@/lib/date";
import type { CareLog } from "@/lib/types";

export interface CareQuestExport {
  exportedAt: string;
  app: {
    name: string;
    version: string;
  };
  data: {
    user: ReturnType<typeof loadCareState>["user"];
    logs: ReturnType<typeof loadCareState>["logs"];
    note: ReturnType<typeof loadCareState>["note"];
    customTasks: ReturnType<typeof loadCareState>["customTasks"];
    energyHistory: ReturnType<typeof loadCareState>["energyHistory"];
    supportNudgeLastShown: ReturnType<typeof loadCareState>["supportNudgeLastShown"];
    onboardingShown: ReturnType<typeof loadCareState>["onboardingShown"];
    goodThingsHistory: ReturnType<typeof loadCareState>["goodThingsHistory"];
    // v6: バックアップリマインド関連フィールド。
    // lastExportDate / exportReminderLastShown はこの端末の状態を示すフィールドで、
    // supportNudgeLastShown と同じ「この端末の状態」扱い。
    // エクスポートには含めるが、インポート時は端末側の値を維持する(lib/import.ts 参照)。
    lastExportDate: ReturnType<typeof loadCareState>["lastExportDate"];
    exportReminderLastShown: ReturnType<typeof loadCareState>["exportReminderLastShown"];
  };
}

export function buildExportPayload(): CareQuestExport {
  const state = loadCareState();
  return {
    exportedAt: new Date().toISOString(),
    app: {
      name: "Care Quest",
      version: "0.1.0",
    },
    data: {
      user: state.user,
      logs: state.logs,
      note: state.note,
      customTasks: state.customTasks,
      energyHistory: state.energyHistory,
      supportNudgeLastShown: state.supportNudgeLastShown,
      onboardingShown: state.onboardingShown,
      goodThingsHistory: state.goodThingsHistory,
      lastExportDate: state.lastExportDate,
      exportReminderLastShown: state.exportReminderLastShown,
    },
  };
}

// ─── CSV エクスポート(US-503)─────────────────────────────────────────────
// 表計算ソフトで開いたり、家族・ケアマネに共有・印刷できる人間向けの形式。
// JSON(復元用の完全バックアップ)とは役割が別なので、CSV はバックアップ扱いにしない。

// CSV の1フィールドをエスケープする。カンマ・引用符・改行を含む場合は
// ダブルクオートで囲み、内部の引用符は2重にする(RFC 4180)。
function csvEscape(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * 記録(logs)を人間向けの CSV 文字列にする純関数(DOM 非依存 = テスト可能)。
 * 列: 日付 / 時刻 / 記録 / ポイント。日付→時刻の昇順に並べる。
 * BOM は付けない(付与は downloadLogsCsv 側。テストは素の CSV を検証する)。
 */
export function buildLogsCsv(logs: CareLog[]): string {
  const header = ["日付", "時刻", "記録", "ポイント"];
  const sorted = [...logs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.completedAt || "") < (b.completedAt || "") ? -1 : 1;
  });
  const rows = sorted.map((log) => {
    let time = "";
    if (log.completedAt) {
      const d = new Date(log.completedAt);
      if (!Number.isNaN(d.getTime())) {
        time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
    }
    return [log.date, time, log.title, String(log.points)].map(csvEscape).join(",");
  });
  return [header.join(","), ...rows].join("\r\n");
}

export function downloadLogsCsv(logs: CareLog[]): void {
  const csv = buildLogsCsv(logs);
  // UTF-8 BOM を先頭に付けて、Excel で日本語が文字化けしないようにする。
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const filename = `carequest-records-${getTodayDate()}.csv`;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

export function downloadAsJson(payload: CareQuestExport): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const filename = `carequest-export-${getTodayDate()}.json`;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}
