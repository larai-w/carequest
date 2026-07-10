"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import AuthPanel from "@/components/AuthPanel";
import EnergySelector from "@/components/EnergySelector";
import EncouragementCard from "@/components/EncouragementCard";
import StatCard from "@/components/StatCard";
import OnboardingCard from "@/components/OnboardingCard";
import RestModeCard from "@/components/RestModeCard";
import SupportNudgeCard from "@/components/SupportNudgeCard";
import { getEncouragementMessage } from "@/lib/messages";
import { loadCareState, loadCareStateWithReport, saveCareState } from "@/lib/storage";
import { recordDailyEnergy, shouldShowSupportNudge } from "@/lib/support";
import { getTodayDate } from "@/lib/date";
import type { CareLog, DailyEnergy, EnergyLevel } from "@/lib/types";

interface HomeViewState {
  energyLevel: EnergyLevel;
  todayPoints: number;
  completedCount: number;
  profileName: string;
  latestTaskTitle: string;
  restMode: boolean;
  todayLogs: CareLog[];
  justExitedRestMode: boolean;
  dataRecovered: boolean;
  energyHistory: DailyEnergy[];
  // 相談窓口カードの throttle 判定に使う「読み込み時点の」最終表示日。
  // セッション中は更新しない。表示中に今日へ書き換えるとカードが即座に
  // 消えてしまうため、スナップショットとして固定する。
  supportNudgeLastShownAtLoad: string;
  supportNudgeDismissed: boolean;
  onboardingShown: boolean;
}

function loadHomeViewState(): HomeViewState {
  const { state, recovered } = loadCareStateWithReport();
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
    dataRecovered: recovered,
    energyHistory: state.energyHistory,
    supportNudgeLastShownAtLoad: state.supportNudgeLastShown,
    supportNudgeDismissed: false,
    onboardingShown: state.onboardingShown,
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
    dataRecovered,
    energyHistory,
    supportNudgeLastShownAtLoad,
    supportNudgeDismissed,
    onboardingShown,
  } = viewState;

  const dismissRecoveryNotice = useCallback(() => {
    setViewState((current) => ({ ...current, dataRecovered: false }));
  }, []);

  // 連続 low + throttle を満たすときだけ相談窓口カードを出す。
  const showSupportNudge = useMemo(
    () =>
      !supportNudgeDismissed &&
      shouldShowSupportNudge(
        { energyHistory, supportNudgeLastShown: supportNudgeLastShownAtLoad },
        getTodayDate(),
      ),
    [supportNudgeDismissed, energyHistory, supportNudgeLastShownAtLoad],
  );

  // カードを表示したら「最終表示日=今日」を保存し、数日は再表示しない。
  // 保存しても supportNudgeLastShownAtLoad(スナップショット)は変えないので、
  // このセッションの表示は消えない。1度だけ保存する。
  const nudgePersistedRef = useRef(false);
  useEffect(() => {
    if (showSupportNudge && !nudgePersistedRef.current) {
      nudgePersistedRef.current = true;
      const state = loadCareState();
      saveCareState({ ...state, supportNudgeLastShown: getTodayDate() });
    }
  }, [showSupportNudge]);

  const dismissSupportNudge = useCallback(() => {
    setViewState((current) => ({ ...current, supportNudgeDismissed: true }));
  }, []);

  const handleOnboardingStart = useCallback(() => {
    setViewState((current) => ({ ...current, onboardingShown: true }));
    const state = loadCareState();
    saveCareState({ ...state, onboardingShown: true });
  }, []);

  const message = useMemo(
    () => getEncouragementMessage(energyLevel, todayPoints, completedCount, latestTaskTitle),
    [energyLevel, todayPoints, completedCount, latestTaskTitle],
  );

  const handleEnergyChange = useCallback(
    (value: EnergyLevel) => {
      const state = loadCareState();
      const today = getTodayDate();
      // 今日のエネルギーレベルを日別履歴に記録する(同日は上書き)。
      // これが「low が続いたら相談窓口をそっと出す」判定の元データになる。
      const nextEnergyHistory = recordDailyEnergy(state.energyHistory, today, value);
      setViewState((current) => ({
        ...current,
        energyLevel: value,
        energyHistory: nextEnergyHistory,
      }));
      saveCareState({
        ...state,
        user: {
          ...state.user,
          energyLevel: value,
          todayPoints,
          lastActiveDate: today,
        },
        energyHistory: nextEnergyHistory,
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
        {!onboardingShown && <OnboardingCard onStart={handleOnboardingStart} />}

        {dataRecovered && (
          <section className="rounded-[28px] border border-stone-200 bg-stone-50/80 p-4 shadow-sm">
            <p className="text-sm leading-6 text-stone-600">
              一部のデータを読み込めなかったため、整えて復元しました。これまでの記録はちゃんと残っています。
            </p>
            <button
              type="button"
              onClick={dismissRecoveryNotice}
              className="mt-3 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              わかりました
            </button>
          </section>
        )}

        {justExitedRestMode && (
          <section className="rounded-[28px] border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
            <p className="text-sm leading-6 text-amber-700">
              おかえりなさい。今日もここにいてくれてありがとう。
            </p>
          </section>
        )}

        {showSupportNudge && <SupportNudgeCard onDismiss={dismissSupportNudge} />}

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
              className="min-h-[44px] rounded-full bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
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
          <label htmlFor="profile-name" className="text-lg font-semibold text-stone-800">
            プロフィール
          </label>
          <p className="mt-1 text-sm text-stone-600">名前を入れて、今日の記録にひとつの安心を添えましょう。</p>
          <input
            id="profile-name"
            value={profileName}
            onChange={(event) => handleProfileNameChange(event.target.value)}
            className="mt-3 w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-700 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
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
