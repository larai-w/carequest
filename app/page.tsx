"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import AuthPanel from "@/components/AuthPanel";
import EnergySelector from "@/components/EnergySelector";
import EncouragementCard from "@/components/EncouragementCard";
import StatCard from "@/components/StatCard";
import RestModeCard from "@/components/RestModeCard";
import { getEncouragementMessage } from "@/lib/messages";
import { loadCareState, saveCareState } from "@/lib/storage";
import { getTodayDate } from "@/lib/date";
import type { CareLog, EnergyLevel } from "@/lib/types";

interface HomeViewState {
  energyLevel: EnergyLevel;
  todayPoints: number;
  completedCount: number;
  profileName: string;
  latestTaskTitle: string;
  restMode: boolean;
  todayLogs: CareLog[];
  justExitedRestMode: boolean;
}

function loadHomeViewState(): HomeViewState {
  const state = loadCareState();
  const todayLogs = state.logs.filter((log) => log.date === getTodayDate());

  return {
    energyLevel: state.user.energyLevel,
    todayPoints: todayLogs.reduce((sum, log) => sum + log.points, 0),
    completedCount: todayLogs.length,
    profileName: state.user.name || "あなた",
    latestTaskTitle: todayLogs.at(-1)?.title ?? "",
    restMode: state.user.restMode ?? false,
    todayLogs,
    justExitedRestMode: false,
  };
}

export default function HomePage() {
  const [viewState, setViewState] = useState<HomeViewState>(() => loadHomeViewState());
  const {
    energyLevel,
    todayPoints,
    completedCount,
    profileName,
    latestTaskTitle,
    restMode,
    todayLogs,
    justExitedRestMode,
  } = viewState;

  const message = useMemo(
    () => getEncouragementMessage(energyLevel, todayPoints, completedCount, latestTaskTitle),
    [energyLevel, todayPoints, completedCount, latestTaskTitle],
  );

  const handleEnergyChange = useCallback(
    (value: EnergyLevel) => {
      const state = loadCareState();
      setViewState((current) => ({ ...current, energyLevel: value }));
      saveCareState({
        ...state,
        user: {
          ...state.user,
          energyLevel: value,
          todayPoints,
          lastActiveDate: getTodayDate(),
        },
      });
    },
    [todayPoints],
  );

  const handleProfileNameChange = useCallback((value: string) => {
    setViewState((current) => ({ ...current, profileName: value }));
    const state = loadCareState();
    saveCareState({
      ...state,
      user: {
        ...state.user,
        name: value || "あなた",
      },
    });
  }, []);

  const handleEnterRestMode = useCallback(() => {
    setViewState((current) => ({
      ...current,
      restMode: true,
      justExitedRestMode: false,
    }));
    const state = loadCareState();
    saveCareState({
      ...state,
      user: { ...state.user, restMode: true },
    });
  }, []);

  const handleExitRestMode = useCallback(() => {
    setViewState((current) => ({
      ...current,
      restMode: false,
      justExitedRestMode: true,
    }));
    const state = loadCareState();
    saveCareState({
      ...state,
      user: { ...state.user, restMode: false },
    });
  }, []);

  if (restMode) {
    return (
      <Layout>
        <div className="space-y-4">
          <RestModeCard onExit={handleExitRestMode} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        {justExitedRestMode && (
          <section className="rounded-[28px] border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
            <p className="text-sm leading-6 text-amber-700">
              おかえりなさい。今日もここにいてくれてありがとう。
            </p>
          </section>
        )}

        <section className="rounded-[28px] border border-amber-100 bg-white/80 p-4 shadow-sm">
          <p className="text-sm text-stone-500">今日の自分のポイント</p>
          <p className="mt-2 text-4xl font-semibold text-amber-700">{todayPoints}pt</p>
          <p className="mt-2 text-sm text-stone-600">{completedCount}件の介護を記録しました。</p>
        </section>

        <EncouragementCard title="今日のひとこと" body={message} />

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-800">今日の記録</h2>
              <p className="mt-1 text-sm text-stone-600">今日やったことを、ゆっくり見返せます。</p>
            </div>
            <button
              type="button"
              onClick={handleEnterRestMode}
              className="rounded-full bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-600"
            >
              今日は無理しない
            </button>
          </div>

          {todayLogs.length === 0 ? (
            <p className="mt-3 text-sm text-stone-600">まだ記録はありません。小さな一歩でも大丈夫です。</p>
          ) : (
            <div className="mt-3 space-y-2">
              {todayLogs.map((log) => (
                <div key={log.id} className="rounded-2xl bg-stone-50 px-3 py-2 text-sm text-stone-700">
                  {log.title} <span className="ml-2 text-amber-700">+{log.points}pt</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <AuthPanel />

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-800">プロフィール</h2>
          <p className="mt-1 text-sm text-stone-600">名前を入れて、今日の記録にひとつの安心を添えましょう。</p>
          <input
            value={profileName}
            onChange={(event) => handleProfileNameChange(event.target.value)}
            className="mt-3 w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-700 outline-none"
            placeholder="あなたの名前"
          />
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-800">エネルギーレベル</h2>
          <p className="mt-1 text-sm text-stone-600">今日の気分に合わせて選びましょう。</p>
          <div className="mt-3">
            <EnergySelector value={energyLevel} onChange={handleEnergyChange} />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="今日の達成" value={completedCount} accent="text-amber-700" />
          <StatCard
            label="今日の気持ち"
            value={energyLevel === "low" ? "ゆっくり" : energyLevel === "normal" ? "ふつう" : "やる気"}
            accent="text-stone-800"
          />
        </div>

        <Link
          href="/quest"
          className="flex items-center justify-center rounded-[24px] bg-stone-800 px-4 py-3 text-sm font-semibold text-white shadow-sm"
        >
          今日の介護を記録する
        </Link>
      </div>
    </Layout>
  );
}
