"use client";

import { useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import TaskCard from "@/components/TaskCard";
import EncouragementCard from "@/components/EncouragementCard";
import { careTasks } from "@/lib/tasks";
import { getEncouragementMessage } from "@/lib/messages";
import { getTodayDate, loadCareState, saveCareState } from "@/lib/storage";
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
  };
}

export default function QuestPage() {
  const [viewState, setViewState] = useState<QuestViewState>(() => loadQuestViewState());
  const [message, setMessage] = useState("今日の介護に、ちゃんと意味があります。");
  const [customTaskInput, setCustomTaskInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { logs, energyLevel, todayPoints, restMode, customTasks } = viewState;

  const allTasks = useMemo(() => [...careTasks, ...customTasks], [customTasks]);

  const completedCount = useMemo(() => logs.filter((log) => log.date === getTodayDate()).length, [logs]);

  const handleRestModeToggle = () => {
    const nextRestMode = !restMode;
    setViewState((current) => ({ ...current, restMode: nextRestMode }));
    const state = loadCareState();
    saveCareState({
      ...state,
      user: {
        ...state.user,
        restMode: nextRestMode,
      },
    });
  };

  const [syncStatus, setSyncStatus] = useState("");

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
    setSyncStatus("クラウド同期中...");

    const state = loadCareState();
    saveCareState({
      ...state,
      user: {
        ...state.user,
        energyLevel,
        todayPoints: nextPoints,
        lastActiveDate: today,
      },
      logs: nextLogs,
    });

    const synced = await syncCareLog(nextLog);
    setSyncStatus(synced ? "クラウド同期に成功しました。" : "クラウド同期に失敗しました。オフラインか認証が必要かもしれません。");
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
    saveCareState({
      ...state,
      customTasks: nextCustomTasks,
    });
  };

  const handleCustomTaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddCustomTask();
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
            {allTasks.map((task) => (
              <TaskCard key={task.id} task={task} onSelect={handleSelectTask} />
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={customTaskInput}
              onChange={(e) => setCustomTaskInput(e.target.value)}
              onKeyDown={handleCustomTaskKeyDown}
              placeholder="自分のケアを追加する（例: 夜中に3回起きた）"
              className="min-w-0 flex-1 rounded-[20px] border border-stone-200 bg-white/90 px-4 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-300 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddCustomTask}
              className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 active:scale-[0.97]"
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
      </div>
    </Layout>
  );
}
