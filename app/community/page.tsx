"use client";

/**
 * あゆみ画面 (/community)
 *
 * 「これまでのあなたのあゆみ」として、ユーザー自身の実データだけを正直に見せる。
 * 偽の「みんな」表現(他者との比較・架空の参加者数)はすべて廃止。
 * - 「競わせない」原則(docs/design-principles.md)と整合
 * - ルート(/community)は変更しない:
 *   URL の変更はブックマーク・SW キャッシュに影響するため据え置き。
 *   Phase 2 で本物のコミュニティ(US-401)を設計する際に見直す。
 */

import { useMemo } from "react";
import Layout from "@/components/Layout";
import EncouragementCard from "@/components/EncouragementCard";
import StatCard from "@/components/StatCard";
import { careTasks } from "@/lib/tasks";
import { getJourneyMessage } from "@/lib/messages";
import { loadCareState } from "@/lib/storage";
import { useHydratedState } from "@/lib/useHydratedState";
import { getJourneyStats } from "@/lib/stats";
import type { CareLog } from "@/lib/types";

export default function CommunityPage() {
  // サーバー/クライアント初回描画は空配列で一致させ、マウント後に localStorage から読む。
  const [logs] = useHydratedState<CareLog[]>([], () => loadCareState().logs);

  const stats = useMemo(() => getJourneyStats(logs), [logs]);

  const topTask = useMemo(() => {
    const entries = Object.entries(stats.taskCounts).filter(([, count]) => count > 0);
    if (entries.length === 0) return null;
    const [taskId] = entries.sort((a, b) => b[1] - a[1])[0];
    return careTasks.find((task) => task.id === taskId) ?? null;
  }, [stats.taskCounts]);

  return (
    <Layout>
      <div className="space-y-4">
        <section className="rounded-[28px] border border-amber-100 bg-white/80 p-4 shadow-sm">
          <p className="text-sm text-stone-500">これまでの累計ポイント</p>
          <p className="mt-2 text-4xl font-semibold text-amber-700">{stats.totalPoints}pt</p>
        </section>

        <EncouragementCard
          title="あなたのあゆみ"
          body={getJourneyMessage(stats.totalLogs, stats.recordedDays)}
        />

        {topTask && (
          <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-800">よく記録している支え</h2>
            <p className="mt-2 text-sm text-stone-600">
              {topTask.title} をいちばん多く記録しています。
              小さな積み重ねが、ここにちゃんと残っています。
            </p>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="累計記録件数" value={stats.totalLogs} accent="text-amber-700" />
          <StatCard label="記録した日数" value={stats.recordedDays} accent="text-stone-800" />
        </div>

        {stats.daysSinceFirst > 0 && (
          <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
            <p className="text-sm text-stone-500">はじめてから</p>
            <p className="mt-1 text-2xl font-semibold text-stone-800">
              {stats.daysSinceFirst}日
            </p>
            <p className="mt-1 text-xs text-stone-400">その日その日の支えが、積み重なっています。</p>
          </section>
        )}

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-800">支えの内訳</h2>
          {stats.totalLogs === 0 ? (
            <p className="mt-3 text-sm text-stone-500">
              記録するとここに内訳が残ります。今日の分だけで十分です。
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {careTasks
                .filter((task) => (stats.taskCounts[task.id] ?? 0) > 0)
                .sort((a, b) => (stats.taskCounts[b.id] ?? 0) - (stats.taskCounts[a.id] ?? 0))
                .map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-2xl bg-stone-50 px-3 py-3"
                  >
                    <span className="text-sm text-stone-700">{task.title}</span>
                    <span className="text-sm font-semibold text-stone-800">
                      {stats.taskCounts[task.id] ?? 0}回
                    </span>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
