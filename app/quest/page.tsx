"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import TaskReadingCard from "@/components/TaskReadingCard";
import { readingForTask, alreadyShownToday, markShownToday, type Reading } from "@/lib/taskReading";
import TaskCard from "@/components/TaskCard";
import EncouragementCard from "@/components/EncouragementCard";
import UndoNotice from "@/components/UndoNotice";
import { careTasks } from "@/lib/tasks";
import { getEncouragementMessage } from "@/lib/messages";
import { loadCareState, saveCareState } from "@/lib/storage";
import { removeLog, recalcTodayStats, recentDuplicateCount, restoreLog } from "@/lib/logs";
import { useHydratedState } from "@/lib/useHydratedState";
import { formatLogWhen, getTodayDate } from "@/lib/date";
import { backupCareLogs, deleteCloudEntry } from "@/lib/api";
import { flushPendingCloudDeletes, markDeletedForCloud, unmarkDeletedForCloud } from "@/lib/cloudDeletes";
import { hasSessionLost } from "@/lib/cloudState";
import { backupStatusMessage, SESSION_LOST_MESSAGE } from "@/lib/cloudMessages";
import type { CareLog, CareTask, EnergyLevel } from "@/lib/types";

const CUSTOM_TASK_POINTS = 10;
const CUSTOM_TASK_DESCRIPTION = "あなたにしかできない支えです。";
// 記録後の自動バックアップのデバウンス間隔(Phase B)。連続記録を1回の背景
// バックアップにまとめ、記録完了の体験に同期を割り込ませない(10秒ルール)。
const RECORD_BACKUP_DEBOUNCE_MS = 1500;

interface QuestViewState {
  logs: CareLog[];
  energyLevel: EnergyLevel;
  todayPoints: number;
  restMode: boolean;
  customTasks: CareTask[];
  // この画面で保存に成功した直前の記録。確認と取り消しだけに使う。
  lastRecordedLog: CareLog | null;
  // 「取り消す」で消した直前の記録(元に戻す用。候補 #7)。
  undoneRecord: CareLog | null;
  // 保存失敗の通知を表示するかどうか(記録以外の操作用)。
  saveFailed: boolean;
  // 保存できなかった記録のタイトル。成功したように見せず、確認カードの位置で知らせる。
  recordSaveFailedTitle: string | null;
  // クエストから外した自作ケアと、外す前の位置(元に戻す用)。
  removedCustomTask: { task: CareTask; index: number } | null;
}

// サーバー/クライアント初回描画で使う既定状態。localStorage を読まない。
const serverQuestViewState: QuestViewState = {
  logs: [],
  energyLevel: "normal",
  todayPoints: 0,
  restMode: false,
  customTasks: [],
  lastRecordedLog: null,
  undoneRecord: null,
  saveFailed: false,
  recordSaveFailedTitle: null,
  removedCustomTask: null,
};

function loadQuestViewState(): QuestViewState {
  const state = loadCareState();

  return {
    logs: state.logs,
    energyLevel: state.user.energyLevel,
    restMode: state.user.restMode ?? false,
    todayPoints: state.logs
      .filter((log) => log.date === getTodayDate())
      .reduce((sum, log) => sum + log.points, 0),
    customTasks: state.customTasks ?? [],
    lastRecordedLog: null,
    undoneRecord: null,
    saveFailed: false,
    recordSaveFailedTitle: null,
    removedCustomTask: null,
  };
}

export default function QuestPage() {
  const [viewState, setViewState] = useHydratedState<QuestViewState>(
    serverQuestViewState,
    loadQuestViewState,
  );
  const [message, setMessage] = useState("今日の介護に、ちゃんと意味があります。");
  const [customTaskInput, setCustomTaskInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // 同一タスクの連打ガード: 最後に記録した { taskId, 時刻 } を保持し、
  // 500ms 以内の同一タスク再タップを無視する(誤操作による重複記録・バースト送信の防止)。
  const lastTapRef = useRef<{ taskId: string; at: number } | null>(null);
  const { logs, energyLevel, todayPoints, restMode, customTasks, lastRecordedLog, undoneRecord, recordSaveFailedTitle, removedCustomTask } = viewState;

  const completedCount = useMemo(() => logs.filter((log) => log.date === getTodayDate()).length, [logs]);
  // 直前の記録と同じケアが少し前にもあるか(候補 #6)。重なって押したときに気づけるようにする。
  const duplicateCount = useMemo(
    () => (lastRecordedLog ? recentDuplicateCount(logs, lastRecordedLog) : 0),
    [logs, lastRecordedLog],
  );

  const [reading, setReading] = useState<Reading | null>(null);

  const handleRestModeToggle = () => {
    const nextRestMode = !restMode;
    setViewState((current) => ({ ...current, restMode: nextRestMode }));
    const state = loadCareState();
    const ok = saveCareState({
      ...state,
      user: {
        ...state.user,
        restMode: nextRestMode,
      },
    });
    if (!ok) {
      setViewState((current) => ({ ...current, saveFailed: true }));
    }
  };

  const [syncStatus, setSyncStatus] = useState("");
  const backupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupChainRef = useRef<Promise<void>>(Promise.resolve());

  // 記録後にデバウンスして、ローカルの全 logs を背景で冪等バックアップする(Phase B)。
  // 全件 PUT なので、以前に送れなかった記録もここでまとめて再送される(§4.3 再送)。
  // 未サインインなら backupCareLogs が { skipped: true } を返し、文言は出さない。
  // 続けて、取り消した記録をクラウドからも消す(候補 #3)。
  // 送信中のバックアップが取り消した記録を後から書き戻さないよう、1本ずつ順に流す。
  const scheduleBackup = useCallback(() => {
    if (backupTimerRef.current) {
      clearTimeout(backupTimerRef.current);
    }
    backupTimerRef.current = setTimeout(() => {
      backupChainRef.current = backupChainRef.current.then(runBackup);
    }, RECORD_BACKUP_DEBOUNCE_MS);

    async function runBackup() {
      try {
        // 自動バックアップ。クラウドの記録を削除した後など、止めている間は送らない(2026-09-14 /hci-check クラウド控え #4)。
        const result = await backupCareLogs(loadCareState().logs, { auto: true });
        await flushPendingCloudDeletes(deleteCloudEntry).catch(() => undefined);
        if (result.skipped && !result.reason && hasSessionLost()) {
          // ログインが切れて止まったことを黙らない(#6)。
          setSyncStatus(SESSION_LOST_MESSAGE);
        } else {
          setSyncStatus(backupStatusMessage(result, "auto"));
        }
      } catch {
        setSyncStatus("同期できませんでした。記録はこの端末にちゃんと残っています。");
      }
    }
  }, []);

  // アンマウント時に保留中のタイマーを片づける。
  useEffect(
    () => () => {
      if (backupTimerRef.current) {
        clearTimeout(backupTimerRef.current);
      }
    },
    [],
  );

  const { saveFailed } = viewState;

  const dismissSaveFailedNotice = () => {
    setViewState((current) => ({ ...current, saveFailed: false }));
  };

  const dismissRecordSaveFailedNotice = () => {
    setViewState((current) => ({ ...current, recordSaveFailedTitle: null }));
  };

  const handleSelectTask = (task: CareTask) => {
    // 連打ガード: 同一タスクを 500ms 以内に再タップしたら無視する。
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.taskId === task.id && now - last.at < 500) {
      return;
    }
    lastTapRef.current = { taskId: task.id, at: now };

    const today = getTodayDate();
    const nextLog: CareLog = {
      id: `${task.id}-${Date.now()}`,
      taskId: task.id,
      title: task.title,
      points: task.points,
      completedAt: new Date().toISOString(),
      date: today,
      energyLevel,
    };

    const nextLogs = [...logs, nextLog];
    const nextPoints = todayPoints + task.points;

    const state = loadCareState();
    const saveOk = saveCareState({
      ...state,
      user: {
        ...state.user,
        energyLevel,
        todayPoints: nextPoints,
        lastActiveDate: today,
      },
      logs: nextLogs,
    });

    if (!saveOk) {
      // **保存できなかった記録を、できたように見せない。**(2026-09-14 /hci-check 候補 #2)
      // 以前はポイントと励ましを先に更新し、失敗の知らせはページ最下部だった。
      // 上を見ている人には成功に見え、再読み込みで記録が消えていた。
      setViewState((current) => ({
        ...current,
        lastRecordedLog: null,
        recordSaveFailedTitle: task.title,
      }));
      return;
    }

    setViewState((current) => ({
      ...current,
      logs: nextLogs,
      todayPoints: nextPoints,
      lastRecordedLog: nextLog,
      undoneRecord: null,
      recordSaveFailedTitle: null,
    }));
    setMessage(getEncouragementMessage(energyLevel, nextPoints, nextLogs.filter((log) => log.date === today).length, task.title));

    // 記録は上で確定済み。バックアップはデバウンスして背景で行う(10秒ルール)。
    scheduleBackup();

    // 関連する読みものを、**1日1回まで**そっと出す。
    // ⚠️ 記録の成否には一切関わらせない。ここで例外が出ても記録は済んでいる。
    if (!alreadyShownToday(today)) {
      const r = readingForTask(task.title, today);
      if (r) {
        setReading(r);
        markShownToday(today);
      }
    }

  };

  const handleUndoLastRecord = () => {
    if (!lastRecordedLog) {
      return;
    }

    const state = loadCareState();
    const nextLogs = removeLog(state.logs, lastRecordedLog.id);
    const { todayPoints: nextPoints } = recalcTodayStats(nextLogs, getTodayDate());
    const saveOk = saveCareState({
      ...state,
      logs: nextLogs,
      user: { ...state.user, todayPoints: nextPoints },
    });

    if (!saveOk) {
      setViewState((current) => ({ ...current, saveFailed: true }));
      return;
    }

    setViewState((current) => ({
      ...current,
      logs: nextLogs,
      todayPoints: nextPoints,
      lastRecordedLog: null,
      undoneRecord: lastRecordedLog,
    }));
    setMessage("記録を取り消しました。今日のことは、必要なときにまた残せます。");
    // クラウドに控えていた分も消す(候補 #3)。消すのは scheduleBackup の中で順に行う。
    markDeletedForCloud(lastRecordedLog.id);
    scheduleBackup();
  };

  // 取り消した直後に「元に戻す」(候補 #7)。記録し直すと時刻が今になってしまうため、元の記録をそのまま戻す。
  const handleRestoreUndoneRecord = () => {
    if (!undoneRecord) {
      return;
    }
    const state = loadCareState();
    const nextLogs = restoreLog(state.logs, undoneRecord);
    const { todayPoints: nextPoints } = recalcTodayStats(nextLogs, getTodayDate());
    const saveOk = saveCareState({
      ...state,
      logs: nextLogs,
      user: { ...state.user, todayPoints: nextPoints },
    });
    if (!saveOk) {
      setViewState((current) => ({ ...current, saveFailed: true }));
      return;
    }
    setViewState((current) => ({
      ...current,
      logs: nextLogs,
      todayPoints: nextPoints,
      lastRecordedLog: undoneRecord,
      undoneRecord: null,
    }));
    setMessage("記録を元に戻しました。");
    // 戻した記録はクラウドから消しに行かず、送り直す。
    unmarkDeletedForCloud(undoneRecord.id);
    scheduleBackup();
  };

  const handleAddCustomTask = () => {
    const trimmed = customTaskInput.trim();
    // 空文字・空白のみは静かに無視する
    if (!trimmed) {
      setCustomTaskInput("");
      return;
    }

    const newTask: CareTask = {
      id: `custom-${Date.now()}`,
      title: trimmed,
      points: CUSTOM_TASK_POINTS,
      description: CUSTOM_TASK_DESCRIPTION,
    };

    const nextCustomTasks = [...customTasks, newTask];
    setViewState((current) => ({ ...current, customTasks: nextCustomTasks }));
    setCustomTaskInput("");
    inputRef.current?.blur();

    const state = loadCareState();
    const ok = saveCareState({
      ...state,
      customTasks: nextCustomTasks,
    });
    if (!ok) {
      setViewState((current) => ({ ...current, saveFailed: true }));
    }
  };

  const handleCustomTaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddCustomTask();
    }
  };

  // 自作ケアを外す。確認は挟まず、外した直後に「元に戻す」を出す(2026-09-14 /hci-check 候補 #4)。
  // 保存できてから画面を変える。
  const handleDeleteCustomTask = (task: CareTask) => {
    const index = customTasks.findIndex((t) => t.id === task.id);
    const nextCustomTasks = customTasks.filter((t) => t.id !== task.id);

    const state = loadCareState();
    const ok = saveCareState({
      ...state,
      customTasks: nextCustomTasks,
    });
    if (!ok) {
      setViewState((current) => ({ ...current, saveFailed: true }));
      return;
    }
    setViewState((current) => ({
      ...current,
      customTasks: nextCustomTasks,
      removedCustomTask: { task, index: index === -1 ? nextCustomTasks.length : index },
    }));
  };

  const handleUndoRemoveCustomTask = () => {
    if (!removedCustomTask) {
      return;
    }
    const state = loadCareState();
    const current = state.customTasks ?? [];
    if (current.some((t) => t.id === removedCustomTask.task.id)) {
      setViewState((view) => ({ ...view, removedCustomTask: null }));
      return;
    }
    const nextCustomTasks = [...current];
    nextCustomTasks.splice(Math.min(removedCustomTask.index, nextCustomTasks.length), 0, removedCustomTask.task);
    const ok = saveCareState({
      ...state,
      customTasks: nextCustomTasks,
    });
    if (!ok) {
      setViewState((view) => ({ ...view, saveFailed: true }));
      return;
    }
    setViewState((view) => ({ ...view, customTasks: nextCustomTasks, removedCustomTask: null }));
  };

  return (
    <Layout>
      <div className="space-y-4">
        <section className="rounded-[28px] border border-amber-100 bg-white/80 p-4 shadow-sm">
          <p className="text-sm text-stone-500">今日のポイント</p>
          <p className="mt-2 text-4xl font-semibold text-amber-700">{todayPoints}pt</p>
          <p className="mt-2 text-sm text-stone-600">{message}</p>
        </section>

        {recordSaveFailedTitle && (
          <section
            aria-label="記録を保存できませんでした"
            aria-live="polite"
            className="rounded-[28px] border border-stone-300 bg-stone-50/90 p-4 shadow-sm"
          >
            <p className="text-sm font-semibold text-stone-800">記録を保存できませんでした</p>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              「{recordSaveFailedTitle}」は、まだ記録に残っていません。端末の空き容量をご確認のうえ、もう一度タップしてください。
            </p>
            <button
              type="button"
              onClick={dismissRecordSaveFailedNotice}
              className="mt-3 min-h-[44px] rounded-full bg-white px-3 py-2 text-sm font-semibold text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              わかりました
            </button>
          </section>
        )}

        {lastRecordedLog && (
          <section
            aria-label="直前に記録した内容"
            aria-live="polite"
            className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-4 shadow-sm"
          >
            <p className="text-sm font-semibold text-amber-800">記録しました</p>
            <p className="mt-1 text-base font-semibold text-stone-800">{lastRecordedLog.title}</p>
            <p className="mt-1 text-sm text-stone-600">
              {formatLogWhen(lastRecordedLog.completedAt, lastRecordedLog.date)}に、この端末へ保存しました。
            </p>
            {duplicateCount > 0 && (
              <p className="mt-2 text-sm leading-6 text-stone-700">
                少し前にも同じ記録が{duplicateCount}件あります。重なって押していたら「取り消す」で1件消せます。
              </p>
            )}
            <button
              type="button"
              onClick={handleUndoLastRecord}
              aria-label="直前の記録を取り消す"
              className="mt-3 min-h-[44px] rounded-full bg-white px-3 py-2 text-sm font-semibold text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              取り消す
            </button>
          </section>
        )}

        {undoneRecord && (
          <UndoNotice
            message={`「${undoneRecord.title}」の記録を取り消しました。`}
            onUndo={handleRestoreUndoneRecord}
          />
        )}

        {reading && <TaskReadingCard reading={reading} onDismiss={() => setReading(null)} />}

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-800">おやすみモード</h2>
              <p className="mt-1 text-sm text-stone-600">今日は無理をしなくても大丈夫です。</p>
            </div>
            <button
              type="button"
              onClick={handleRestModeToggle}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${
                restMode ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-700"
              }`}
            >
              {restMode ? "オン中" : "オンにする"}
            </button>
          </div>
        </section>

        <EncouragementCard
          title="今日の気分"
          body={energyLevel === "low" ? "今日は5ポイントだけでも十分です。あなたはもう支えています。" : "少しずつでも大丈夫です。今日できたことが、ちゃんと積み上がります。"}
        />

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-800">今日のクエスト</h2>
          <p className="mt-1 text-sm text-stone-600">
            {restMode
              ? "おやすみモード中です。記録してもしなくても、どちらでも大丈夫です。"
              : "タップすると今日の記録に追加されます。"}
          </p>
          <div className="mt-4 space-y-3">
            {careTasks.map((task) => (
              <TaskCard key={task.id} task={task} onSelect={handleSelectTask} />
            ))}
            {customTasks.map((task) => (
              <TaskCard key={task.id} task={task} onSelect={handleSelectTask} onDelete={handleDeleteCustomTask} />
            ))}
          </div>

          {removedCustomTask && (
            <div className="mt-4">
              <UndoNotice
                message={`「${removedCustomTask.task.title}」をクエストから外しました。これまでの記録は残っています。`}
                onUndo={handleUndoRemoveCustomTask}
              />
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <label htmlFor="custom-task-input" className="sr-only">
              自分のケアを追加する
            </label>
            <input
              id="custom-task-input"
              ref={inputRef}
              type="text"
              value={customTaskInput}
              onChange={(e) => setCustomTaskInput(e.target.value)}
              onKeyDown={handleCustomTaskKeyDown}
              placeholder="自分のケアを追加する（例: 夜中に3回起きた）"
              className="min-w-0 flex-1 rounded-[20px] border border-stone-200 bg-white/90 px-4 py-2 text-sm text-stone-800 placeholder:text-stone-600 focus:border-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            />
            <button
              type="button"
              onClick={handleAddCustomTask}
              className="min-h-[44px] rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 active:scale-[0.97]"
            >
              追加
            </button>
          </div>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-800">今日の記録</h2>
          <p className="mt-1 text-sm text-stone-600">{completedCount}件の介護を記録しました。</p>
          {syncStatus ? <p className="mt-2 text-sm text-stone-500">{syncStatus}</p> : null}
        </section>

        {saveFailed && (
          <section className="rounded-[28px] border border-stone-200 bg-stone-50/80 p-4 shadow-sm">
            <p className="text-sm leading-6 text-stone-600">
              端末に保存できませんでした。端末の空き容量をご確認のうえ、もう一度お試しください。
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
      </div>
    </Layout>
  );
}
