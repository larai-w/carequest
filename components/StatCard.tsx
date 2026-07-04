interface StatCardProps {
  label: string;
  value: string | number;
  accent?: string;
}

export default function StatCard({ label, value, accent = "text-stone-700" }: StatCardProps) {
  return (
    <div className="rounded-[20px] border border-stone-200 bg-white/80 p-4 shadow-sm">
      <p className="text-sm text-stone-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
