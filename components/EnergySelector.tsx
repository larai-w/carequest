"use client";

import type { EnergyLevel } from "@/lib/types";

interface EnergySelectorProps {
  value: EnergyLevel;
  onChange: (value: EnergyLevel) => void;
}

const options: { value: EnergyLevel; label: string }[] = [
  { value: "low", label: "低エネルギー" },
  { value: "normal", label: "ふつう" },
  { value: "energetic", label: "少し元気" },
];

export default function EnergySelector({ value, onChange }: EnergySelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
            value === option.value
              ? "border-amber-400 bg-amber-500 text-white"
              : "border-stone-200 bg-white/80 text-stone-700"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
