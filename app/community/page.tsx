"use client";

import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import EncouragementCard from "@/components/EncouragementCard";
import StatCard from "@/components/StatCard";
import { careTasks } from "@/lib/tasks";
import { getCommunityMessage } from "@/lib/messages";
import { loadCareState } from "@/lib/storage";
import { getCommunityStats } from "@/lib/stats";
import type { CareLog } from "@/lib/types";

export default function CommunityPage() {
  const [logs] = useState<CareLog[]>(() => loadCareState().logs);

  const stats = useMemo(() => getCommunityStats(logs), [logs]);
  const featuredTask = useMemo(() => {
    const entries = Object.entries(stats.taskCounts).filter(([, count]) => count > 0);
    if (entries.length === 0) {
      return "小さな支え";
    }
    const [taskId] = entries.sort((a, b) => b[1] - a[1])[0];
    return careTasks.find((task) => task.id === taskId)?.title ?? "小さな支え";
  }, [stats.taskCounts]);

  return (
    <Layout>
      <div className="space-y-4">
        <section className="rounded-[28px] border border-amber-100 bg-white/80 p-4 shadow-sm">
          <p className="text-sm text-stone-500">今日のみんなの合計ポイント</p>
          <p className="mt-2 text-4xl font-semibold text-amber-700">{stats.totalPoints}pt</p>
        </section>

        <EncouragementCard title="みんなの気持ち" body={getCommunityMessage(stats.totalPoints, stats.participantCount)} />

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-800">今日の支えの輪</h2>
          <p className="mt-2 text-sm text-stone-600">
            今日は {featuredTask} が多く記録されていて、少しずつみんなの安心がつながっています。
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="参加している介護者" value={stats.participantCount} accent="text-amber-700" />
          <StatCard label="今日の記録件数" value={logs.length} accent="text-stone-800" />
        </div>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-800">タスクごとの回数</h2>
          <div className="mt-4 space-y-3">
            {careTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-2xl bg-stone-50 px-3 py-3">
                <span className="text-sm text-stone-700">{task.title}</span>
                <span className="text-sm font-semibold text-stone-800">{stats.taskCounts[task.id] ?? 0}回</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
