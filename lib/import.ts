import type { CareStorageState } from "@/lib/storage";
import { sanitizeRawState } from "@/lib/storage";

// エクスポートファイルが Care Quest のものか判定するための識別子。
// lib/export.ts の buildExportPayload と対応している。
const APP_NAME = "Care Quest";

export interface ImportResult {
  ok: boolean;
  // ユーザーにそのまま見せられる穏やかなメッセージ(赤い警告にはしない)。
  message: string;
  // ok のときだけ入るマージ後の状態。呼び出し側が saveCareState する。
  state?: CareStorageState;
  // 新しく取り込んだ記録の件数。
  importedLogCount?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// マージ方針(「データを壊さない」を最優先):
// - logs: id で重複排除して統合する。既存の記録は必ず残し、まだ無い id の
//   インポート記録だけを後ろに足す。上書き・全消しはしない。
// - customTasks: 同様に id で重複排除して統合する。
// - note: 既存が空のときだけインポートの note を取り込む。今書いてある内心を
//   黙って上書きしない。
// - user.goodThings: 和集合。その他の user フィールド(名前や設定など、この端末の
//   プロフィール)は既存を維持する。インポートは「記録を足す」もので、
//   端末の設定を乗っ取るものではないという考え方。
function mergeStates(
  existing: CareStorageState,
  imported: CareStorageState,
): { state: CareStorageState; importedLogCount: number } {
  const existingLogIds = new Set(existing.logs.map((log) => log.id));
  const newLogs = imported.logs.filter((log) => !existingLogIds.has(log.id));
  const logs = [...existing.logs, ...newLogs];

  const existingTaskIds = new Set(existing.customTasks.map((task) => task.id));
  const newTasks = imported.customTasks.filter((task) => !existingTaskIds.has(task.id));
  const customTasks = [...existing.customTasks, ...newTasks];

  const note = existing.note.trim() === "" ? imported.note : existing.note;

  const goodThings = Array.from(
    new Set([...existing.user.goodThings, ...imported.user.goodThings]),
  );
  const user = { ...existing.user, goodThings };

  // energyHistory: 日付で重複排除して統合。既存の端末の記録を優先して残す。
  const existingEnergyDates = new Set(existing.energyHistory.map((e) => e.date));
  const newEnergy = imported.energyHistory.filter((e) => !existingEnergyDates.has(e.date));
  const energyHistory = [...existing.energyHistory, ...newEnergy];

  // supportNudgeLastShown はこの端末の表示履歴を維持する(インポートで乱さない)。
  const supportNudgeLastShown = existing.supportNudgeLastShown;

  return {
    state: { user, logs, note, customTasks, energyHistory, supportNudgeLastShown },
    importedLogCount: newLogs.length,
  };
}

/**
 * インポートファイルの中身(文字列)を検証・sanitize し、既存の状態にマージする。
 * DOM に依存しない純関数なのでユニットテストできる。
 * 実際の localStorage 保存は呼び出し側(UI)が saveCareState で行う。
 */
export function parseAndMergeImport(
  fileText: string,
  existing: CareStorageState,
): ImportResult {
  const notCareQuestMessage =
    "このファイルは Care Quest の記録ではないようです。書き出したファイルをもう一度ご確認ください。";

  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    return {
      ok: false,
      message: "ファイルを読み込めませんでした。Care Quest から書き出した JSON ファイルか、ご確認ください。",
    };
  }

  if (!isRecord(parsed)) {
    return { ok: false, message: notCareQuestMessage };
  }

  // 他アプリ・別形式の JSON を弾く。app.name で Care Quest のエクスポートか確認する。
  const app = parsed.app;
  if (!isRecord(app) || app.name !== APP_NAME) {
    return { ok: false, message: notCareQuestMessage };
  }

  const data = parsed.data;
  if (!isRecord(data)) {
    return { ok: false, message: notCareQuestMessage };
  }

  // ★重要: 取り込んだデータは必ず sanitize/migration パイプラインを通す。
  // 生 JSON を直接マージ・保存しない(壊れた・悪意ある要素の混入を防ぐ)。
  const imported = sanitizeRawState(data);

  const { state, importedLogCount } = mergeStates(existing, imported);

  return {
    ok: true,
    state,
    importedLogCount,
    message:
      importedLogCount > 0
        ? `${importedLogCount}件の記録を読み込みました。`
        : "読み込みは完了しました。新しく増えた記録はありませんでした。",
  };
}
