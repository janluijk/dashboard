type Props = {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
};

export function StatCard({ label, value, unit, sub }: Props) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold">
        {value}
        {unit ? <span className="text-base text-[var(--muted)] ml-1">{unit}</span> : null}
      </p>
      {sub ? <p className="text-xs text-[var(--muted)] mt-1">{sub}</p> : null}
    </div>
  );
}
