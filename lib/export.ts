import { loadCareState, getTodayDate } from "@/lib/storage";

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
    },
  };
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
