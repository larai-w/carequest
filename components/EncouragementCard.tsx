interface EncouragementCardProps {
  title: string;
  body: string;
}

export default function EncouragementCard({ title, body }: EncouragementCardProps) {
  return (
    <div className="rounded-[24px] border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
      <p className="text-sm font-semibold text-amber-700">{title}</p>
      <p className="mt-2 text-sm leading-6 text-stone-700">{body}</p>
    </div>
  );
}
