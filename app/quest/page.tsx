"use client";

import { useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import TaskCard from "@/components/TaskCard";
import EncouragementCard from "@/components/EncouragementCard";
import { careTasks } from "@/lib/tasks";
import { getEncouragementMessage } from "@/lib/messages";
import { loadCareState, saveCareState } from "@/lib/storage";
import { getTodayDate } from "@/lib/date";
import { syncCareLog } from "@/lib/api";
import type { CareLog, CareTask, EnergyLevel } from "@/lib/types";

const CUSTOM_TASK_POINTS = 10;
const CUSTOM_TASK_DESCRIPTION = "あなたにしかできない支えです。";

interface QuestViewState {
  logs: CareLog[];
  energyLevel: EnergyLevel;
  todayPoints: number;
  restMode: boolean;
  customTasks: CareTask[];
  // 保存失敗の通知を表示するかどうか。
  saveFailed: boolean;
}

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
    saveFailed: false,
  };
}

export default function QuestPage() {
  const [viewState, setViewState] = useState<QuestViewState>(() => loadQuestViewState());
  const [message, setMessage] = useState("今日の介護に、ちゃんと意味があります。");
  const [customTaskInput, setCustomTaskInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { logs, energyLevel, todayPoints, restMode, customTasks } = viewState;

  const completedCount = useMemo(() => logs.filter((log) => log.date === getTodayDate()).length, [logs]);

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

  const { saveFailed } = viewState;

  const dismissSaveFailedNotice = () => {
    setViewState((current) => ({ ...current, saveFailed: false }));
  };

  const handleSelectTask = async (task: CareTask) => {
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

    setViewState((current) => ({ ...current, logs: nextLogs, todayPoints: nextPoints }));
    setMessage(getEncouragementMessage(energyLevel, nextPoints, nextLogs.filter((log) => log.date === today).length, task.title));
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
      setViewState((current) => ({ ...current, saveFailed: true }));
    }

    const syncResult = await syncCareLog(nextLog);
    if (syncResult.skipped) {
      // 未サインイン: 端末保存のみで完結するのが正常状態。文言は一切表示しない。
      setSyncStatus("");
    } else if (syncResult.ok) {
      // サインイン済み、同期成功: 控えめに表示
      setSyncStatus("バックアップが完了しました。");
    } else {
      // サインイン済み、同期失敗: 記録はローカルに残っていることを穏やかに伝える
      setSyncStatus("同期できませんでした。記録はこの端末にちゃんと残っています。");
    }
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

  const handleDeleteCustomTask = (task: CareTask) => {
    const nextCustomTasks = customTasks.filter((t) => t.id !== task.id);
    setViewState((current) => ({ ...current, customTasks: nextCustomTasks }));

    const state = loadCareState();
    const ok = saveCareState({
      ...state,
      customTasks: nextCustomTasks,
    });
    if (!ok) {
      setViewState((current) => ({ ...current, saveFailed: true }));
    }
  };

  return (
    <Layout>
      <div className="space-y-4">
        <section className="rounded-[28px] border border-amber-100 bg-white/80 p-4 shadow-sm">
          <p className="text-sm text-stone-500">今日のポイント</p>
          <p className="mt-2 text-4xl font-semibold text-amber-700">{todayPoints}pt</p>
          <p className="mt-2 text-sm text-stone-600">{message}</p>
        </section>

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
              className="min-w-0 flex-1 rounded-[20px] border border-stone-200 bg-white/90 px-4 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
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
      </div>
    </Layout>
  );
}
