"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import EncouragementCard from "@/components/EncouragementCard";
import BackupReminderCard from "@/components/BackupReminderCard";
import ResetDataCard from "@/components/ResetDataCard";
import CloudBackupCard from "@/components/CloudBackupCard";
import { loadCareState, saveCareState, resetCareState } from "@/lib/storage";
import { backupCareLogs, fetchCareEntries, isSignedIn } from "@/lib/api";
import { mergeRestoredLogs } from "@/lib/backup";
import { useHydratedState } from "@/lib/useHydratedState";
import { getTodayDate, formatLogWhen } from "@/lib/date";
import { getRecentDaySummaries, type RecentDaySummary } from "@/lib/stats";
import { getTodaySummaryBody } from "@/lib/messages";
import { buildExportPayload, downloadAsJson } from "@/lib/export";
import { parseAndMergeImport } from "@/lib/import";
import { removeLog, recalcTodayStats } from "@/lib/logs";
import { shouldShowBackupReminder } from "@/lib/backup-reminder";
import type { CareLog } from "@/lib/types";

interface ReflectionViewState {
  logs: CareLog[];
  recentDays: RecentDaySummary[];
  note: string;
  goodThings: string[];
  // 保存失敗の通知を表示するかどうか(T31 の saveFailed 通知パターン)。
  saveFailed: boolean;
  // バックアップリマインドカードの throttle 判定に使う「読み込み時点の」値。
  // app/page.tsx の supportNudgeLastShownAtLoad と同じスナップショット方式。
  // セッション中はこれを更新しない(表示中に消えないようにするため)。
  totalLogCount: number;
  lastExportDateAtLoad: string;
  exportReminderLastShownAtLoad: string;
  exportReminderDismissed: boolean;
  // T42: 全削除フロー。showResetConfirm が true のとき ResetDataCard を表示する。
  showResetConfirm: boolean;
  // T42: 削除完了メッセージ。削除後に一度だけ表示し、再アクションで消える。
  resetCompleted: boolean;
  // T42: 削除失敗の通知(T31 の saveFailed パターンと同様)。
  resetFailed: boolean;
}

// サーバー/クライアント初回描画で使う既定状態。localStorage を読まない。
const serverReflectionViewState: ReflectionViewState = {
  logs: [],
  recentDays: [],
  note: "",
  goodThings: [],
  saveFailed: false,
  totalLogCount: 0,
  lastExportDateAtLoad: "",
  exportReminderLastShownAtLoad: "",
  exportReminderDismissed: false,
  showResetConfirm: false,
  resetCompleted: false,
  resetFailed: false,
};

/**
 * goodThingsHistory から今日の items を取り出す純関数。
 * 当日のエントリがなければ空配列(まっさらな状態)を返す。
 */
export function getTodayGoodThings(
  goodThingsHistory: { date: string; items: string[] }[],
  today: string,
): string[] {
  const entry = goodThingsHistory.find((g) => g.date === today);
  return entry ? [...entry.items] : [];
}

/**
 * goodThingsHistory の今日分を更新した新しい配列を返す純関数。
 * items が空になった日はエントリごと削除して空エントリを溜めない。
 */
export function setTodayGoodThings(
  goodThingsHistory: { date: string; items: string[] }[],
  today: string,
  items: string[],
): { date: string; items: string[] }[] {
  const without = goodThingsHistory.filter((g) => g.date !== today);
  if (items.length === 0) {
    // items が空になった日はエントリを残さない
    return without;
  }
  return [...without, { date: today, items }];
}

function loadReflectionViewState(): ReflectionViewState {
  const state = loadCareState();
  const today = getTodayDate();

  return {
    logs: state.logs.filter((log) => log.date === today),
    recentDays: getRecentDaySummaries(state.logs),
    note: state.note,
    goodThings: getTodayGoodThings(state.goodThingsHistory, today),
    saveFailed: false,
    totalLogCount: state.logs.length,
    lastExportDateAtLoad: state.lastExportDate,
    exportReminderLastShownAtLoad: state.exportReminderLastShown,
    exportReminderDismissed: false,
    showResetConfirm: false,
    resetCompleted: false,
    resetFailed: false,
  };
}

export default function ReflectionPage() {
  const [viewState, setViewState] = useHydratedState<ReflectionViewState>(
    serverReflectionViewState,
    loadReflectionViewState,
  );
  const { logs, recentDays, note, goodThings, saveFailed, totalLogCount, lastExportDateAtLoad, exportReminderLastShownAtLoad, exportReminderDismissed, showResetConfirm, resetCompleted, resetFailed } = viewState;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState("");
  // T10 Phase A: クラウドバックアップ/復元の穏やかな結果メッセージと実行中フラグ。
  const [cloudMessage, setCloudMessage] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 同じファイルを続けて選べるよう、input は毎回リセットする。
    event.target.value = "";
    if (!file) {
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      setImportMessage("ファイルを読み込めませんでした。もう一度お試しください。");
      return;
    }

    const result = parseAndMergeImport(text, loadCareState());
    if (!result.ok || !result.state) {
      setImportMessage(result.message);
      return;
    }

    saveCareState(result.state);
    setViewState(loadReflectionViewState());
    setImportMessage(result.message);
  };

  // T10 Phase A: 手動でローカルの全 logs をクラウドへ冪等 PUT する。
  // 失敗しても記録はローカルに残る。文言は責めない・急かさない(design-sync §4)。
  const handleCloudBackup = async () => {
    setCloudBusy(true);
    try {
      const result = await backupCareLogs(loadCareState().logs);
      if (result.skipped) {
        setCloudMessage("サインインすると、この端末の記録をクラウドに控えておけます。");
      } else if (result.total === 0) {
        setCloudMessage("まだ控えておく記録がありません。");
      } else if (result.failed === 0) {
        setCloudMessage("バックアップが完了しました。");
      } else if (result.succeeded > 0) {
        setCloudMessage("一部の記録を控えました。残りはこの端末にちゃんと残っています。");
      } else {
        setCloudMessage("同期できませんでした。記録はこの端末にちゃんと残っています。");
      }
    } catch {
      setCloudMessage("同期できませんでした。記録はこの端末にちゃんと残っています。");
    } finally {
      setCloudBusy(false);
    }
  };

  // T10 Phase A: クラウドの記録を取得し、既存優先でローカルにマージする(上書きしない)。
  const handleCloudRestore = async () => {
    setCloudBusy(true);
    try {
      if (!(await isSignedIn())) {
        setCloudMessage("サインインすると、クラウドの控えから復元できます。");
        return;
      }
      // fetchCareEntries は sanitize 済みの入口(T31)。生 JSON を信用しない。
      const fetched = await fetchCareEntries();
      const { state, importedLogCount } = mergeRestoredLogs(loadCareState(), fetched);
      saveCareState(state);
      setViewState(loadReflectionViewState());
      setCloudMessage(
        importedLogCount > 0
          ? `${importedLogCount}件の記録を読み込みました。`
          : "読み込みは完了しました。新しく増えた記録はありませんでした。",
      );
    } catch {
      setCloudMessage("同期できませんでした。記録はこの端末にちゃんと残っています。");
    } finally {
      setCloudBusy(false);
    }
  };

  const goodThingOptions = [
    "小さな介護ができた",
    "自分の休憩ができた",
    "家族と安心できた",
    "今日の気持ちを整えられた",
  ];

  const totalPoints = useMemo(() => logs.reduce((sum, log) => sum + log.points, 0), [logs]);

  const handleNoteChange = (value: string) => {
    setViewState((current) => ({ ...current, note: value }));
    const state = loadCareState();
    saveCareState({
      ...state,
      note: value,
    });
  };

  const handleGoodThingToggle = (value: string) => {
    const nextGoodThings = goodThings.includes(value)
      ? goodThings.filter((item) => item !== value)
      : [...goodThings, value];

    setViewState((current) => ({ ...current, goodThings: nextGoodThings }));
    const state = loadCareState();
    const today = getTodayDate();
    // goodThingsHistory を今日分だけ更新する。items が空になった日はエントリごと削除。
    // user.goodThings への書き込みは廃止し、goodThingsHistory のみを更新する。
    const nextGoodThingsHistory = setTodayGoodThings(state.goodThingsHistory, today, nextGoodThings);
    saveCareState({
      ...state,
      goodThingsHistory: nextGoodThingsHistory,
    });
  };

  const dismissSaveFailedNotice = useCallback(() => {
    setViewState((current) => ({ ...current, saveFailed: false }));
  }, [setViewState]);

  // バックアップリマインドカードを表示すべきかを判定する。
  // app/page.tsx の showSupportNudge と同じスナップショット方式。
  const showBackupReminder = useMemo(
    () =>
      !exportReminderDismissed &&
      shouldShowBackupReminder(
        {
          logCount: totalLogCount,
          lastExportDate: lastExportDateAtLoad,
          exportReminderLastShown: exportReminderLastShownAtLoad,
        },
        getTodayDate(),
      ),
    [exportReminderDismissed, totalLogCount, lastExportDateAtLoad, exportReminderLastShownAtLoad],
  );

  // カードを表示したら「最終表示日=今日」を保存し、7日は再表示しない。
  // スナップショット(exportReminderLastShownAtLoad)は変えないので、このセッション中は消えない。
  const exportReminderPersistedRef = useRef(false);
  useEffect(() => {
    if (showBackupReminder && !exportReminderPersistedRef.current) {
      exportReminderPersistedRef.current = true;
      const state = loadCareState();
      saveCareState({ ...state, exportReminderLastShown: getTodayDate() });
    }
  }, [showBackupReminder]);

  const dismissExportReminder = useCallback(() => {
    setViewState((current) => ({ ...current, exportReminderDismissed: true }));
  }, [setViewState]);

  // エクスポートボタンのハンドラ。
  // buildExportPayload は純粋なままにし、lastExportDate の更新はここで行う。
  const handleExport = useCallback(() => {
    downloadAsJson(buildExportPayload());
    const today = getTodayDate();
    const state = loadCareState();
    saveCareState({ ...state, lastExportDate: today });
    // エクスポート直後はリマインドカードを非表示にする。
    setViewState((current) => ({ ...current, exportReminderDismissed: true }));
  }, [setViewState]);

  const handleDeleteLog = useCallback(
    (logId: string) => {
      const state = loadCareState();
      const nextLogs = removeLog(state.logs, logId);
      const today = getTodayDate();
      const { todayPoints: nextTodayPoints } = recalcTodayStats(nextLogs, today);
      const nextTodayLogs = nextLogs.filter((log) => log.date === today);

      setViewState((current) => ({
        ...current,
        logs: nextTodayLogs,
        recentDays: getRecentDaySummaries(nextLogs),
      }));

      const ok = saveCareState({
        ...state,
        logs: nextLogs,
        user: {
          ...state.user,
          todayPoints: nextTodayPoints,
        },
      });
      if (!ok) {
        setViewState((current) => ({ ...current, saveFailed: true }));
      }
    },
    [setViewState],
  );

  // T42: 全削除フローのハンドラ群。
  const handleShowResetConfirm = useCallback(() => {
    setViewState((current) => ({ ...current, showResetConfirm: true, resetCompleted: false, resetFailed: false }));
  }, [setViewState]);

  const handleCancelReset = useCallback(() => {
    setViewState((current) => ({ ...current, showResetConfirm: false }));
  }, [setViewState]);

  // エクスポート後に確認カードを閉じず、削除に進めるようにする。
  // エクスポート自体は handleExport を再利用するが、カードはそのまま残す。
  const handleExportFromResetCard = useCallback(() => {
    handleExport();
    // exportReminderDismissed を true にしても showResetConfirm は維持する。
    setViewState((current) => ({ ...current, exportReminderDismissed: true }));
  }, [handleExport, setViewState]);

  const handleConfirmReset = useCallback(() => {
    const ok = resetCareState();
    if (ok) {
      // 削除成功: 画面を初期状態に近い表示へ切り替え、完了メッセージを表示する。
      setViewState({
        ...serverReflectionViewState,
        resetCompleted: true,
      });
    } else {
      // 削除失敗: 画面は継続(T31 の saveFailed パターンと同様)。
      setViewState((current) => ({ ...current, showResetConfirm: false, resetFailed: true }));
    }
  }, [setViewState]);

  return (
    <Layout>
      <div className="space-y-4">
        {saveFailed && (
          <section className="rounded-[28px] border border-stone-200 bg-stone-50/80 p-4 shadow-sm">
            <p className="text-sm leading-6 text-stone-600">
              記録を保存できませんでした。端末の空き容量をご確認ください。今日の記録はこのままご利用いただけます。
            </p>
            <button
              type="button"
              onClick={dismissSaveFailedNotice}
              className="mt-3 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              わかりました
            </button>
          </section>
        )}

        {resetFailed && (
          <section className="rounded-[28px] border border-stone-200 bg-stone-50/80 p-4 shadow-sm">
            <p className="text-sm leading-6 text-stone-600">
              削除ができませんでした。端末の設定をご確認ください。記録はそのままです。
            </p>
            <button
              type="button"
              onClick={() => setViewState((current) => ({ ...current, resetFailed: false }))}
              className="mt-3 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              わかりました
            </button>
          </section>
        )}

        {resetCompleted && (
          <section className="rounded-[28px] border border-stone-200 bg-stone-50/80 p-4 shadow-sm">
            <p className="text-sm leading-6 text-stone-600">
              まっさらになりました。これまでの時間は、ちゃんとあなたのものです。
            </p>
          </section>
        )}

        {showBackupReminder && (
          <BackupReminderCard
            onDismiss={dismissExportReminder}
            onExport={() => {
              handleExport();
            }}
          />
        )}

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <p className="text-sm text-stone-500">今日やったこと</p>
          <div className="mt-3 space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-stone-600">今日の記録はまだありません。小さな一歩でも大丈夫です。</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="relative flex items-center rounded-2xl bg-stone-50 px-3 py-3 pr-12 text-sm text-stone-700">
                  <div className="flex-1">
                    <span>{log.title}</span>
                    {formatLogWhen(log.completedAt, log.date) ? (
                      <span className="mt-0.5 block text-xs text-stone-400">{formatLogWhen(log.completedAt, log.date)}</span>
                    ) : null}
                  </div>
                  <span className="ml-2 text-amber-700">+{log.points}pt</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteLog(log.id)}
                    aria-label={`${log.title}の記録を取り消す`}
                    className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 hover:text-stone-600"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
          <p className="text-sm text-stone-500">今日の合計ポイント</p>
          <p className="mt-2 text-4xl font-semibold text-amber-700">{totalPoints}pt</p>
        </section>

        <EncouragementCard
          title="今日のまとめ"
          body={getTodaySummaryBody(logs)}
        />

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">ここ7日間のあゆみ</h3>
          {recentDays.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-stone-600">
              これからの記録が、ここに少しずつ残っていきます。今日の分だけで十分です。
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {recentDays.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between rounded-2xl bg-stone-50 px-3 py-3 text-sm text-stone-700"
                >
                  <span>{day.label}</span>
                  <span>
                    {day.completedTasks}件の支え
                    <span className="ml-2 text-amber-700">+{day.totalPoints}pt</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">今日のよかったこと</h3>
          <p className="mt-1 text-sm text-stone-600">小さなことでも、ちゃんと残しておきましょう。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {goodThingOptions.map((option) => {
              const active = goodThings.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleGoodThingToggle(option)}
                  className={`rounded-full px-3 py-2 text-sm ${
                    active ? "bg-amber-500 text-white" : "bg-stone-100 text-stone-700"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <label className="text-sm font-semibold text-stone-800" htmlFor="reflection-note">
            今日のひとこと
          </label>
          <textarea
            id="reflection-note"
            value={note}
            onChange={(event) => handleNoteChange(event.target.value)}
            rows={4}
            className="mt-3 w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-700 outline-none"
            placeholder="今日の気持ちや小さなできごとを書いてみましょう。"
          />
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-base font-semibold text-stone-700">自分の記録を手元に残す</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            これまでの記録は、いつでも手元に持ち出せます。
          </p>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            このファイルはあなたの端末に保存されるだけで、どこにも送信されません。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 active:bg-stone-300"
            >
              自分の記録を保存する（JSON）
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 active:bg-stone-300"
            >
              記録を読み込む
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-stone-500">
            別の端末で書き出したファイルを選ぶと、今ある記録に足す形で読み込みます。今の記録が消えることはありません。
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
          {importMessage ? (
            <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-3 text-sm leading-6 text-stone-700">
              {importMessage}
            </p>
          ) : null}

          {!showResetConfirm && !resetCompleted && (
            <div className="mt-4 border-t border-stone-100 pt-4">
              <button
                type="button"
                onClick={handleShowResetConfirm}
                aria-label="すべての記録を削除する"
                className="rounded-full px-3 py-1.5 text-xs text-stone-400 underline-offset-2 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                すべての記録を削除する
              </button>
            </div>
          )}
        </section>

        <CloudBackupCard
          onBackup={handleCloudBackup}
          onRestore={handleCloudRestore}
          message={cloudMessage}
          busy={cloudBusy}
        />

        {showResetConfirm && (
          <ResetDataCard
            onCancel={handleCancelReset}
            onExport={handleExportFromResetCard}
            onConfirmReset={handleConfirmReset}
          />
        )}
      </div>
    </Layout>
  );
}
