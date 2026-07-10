"use client";

import type { CareTask } from "@/lib/types";

interface TaskCardProps {
  task: CareTask;
  onSelect: (task: CareTask) => void;
  onDelete?: (task: CareTask) => void;
  disabled?: boolean;
}

export default function TaskCard({ task, onSelect, onDelete, disabled = false }: TaskCardProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onSelect(task)}
        disabled={disabled}
        className={`w-full rounded-[24px] border border-amber-100 bg-white/90 p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
          disabled ? "cursor-not-allowed opacity-60" : "active:scale-[0.98]"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className={onDelete ? "pr-5" : ""}>
            <p className="text-base font-semibold text-stone-800">{task.title}</p>
            <p className="mt-1 text-sm text-stone-600">{task.description}</p>
          </div>
          <div className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
            +{task.points}
          </div>
        </div>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(task)}
          aria-label={`${task.title}を削除`}
          className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 hover:text-stone-600"
        >
          ×
        </button>
      )}
    </div>
  );
}
