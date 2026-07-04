"use client";

import type { CareTask } from "@/lib/types";

interface TaskCardProps {
  task: CareTask;
  onSelect: (task: CareTask) => void;
  disabled?: boolean;
}

export default function TaskCard({ task, onSelect, disabled = false }: TaskCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(task)}
      disabled={disabled}
      className={`w-full rounded-[24px] border border-amber-100 bg-white/90 p-4 text-left shadow-sm transition ${
        disabled ? "cursor-not-allowed opacity-60" : "active:scale-[0.98]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-stone-800">{task.title}</p>
          <p className="mt-1 text-sm text-stone-600">{task.description}</p>
        </div>
        <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
          +{task.points}
        </div>
      </div>
    </button>
  );
}
