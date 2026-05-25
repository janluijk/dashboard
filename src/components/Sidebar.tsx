import Link from 'next/link';

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-[var(--card-border)] bg-[var(--card)] p-4 hidden md:flex flex-col gap-1">
      <div className="px-2 py-3">
        <p className="text-sm font-semibold">Personal</p>
      </div>
      <Link
        href="/"
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--card-border)] text-sm font-medium transition"
      >
        <span aria-hidden>📊</span> Dashboard
      </Link>
      <Link
        href="/buurtheld/explore"
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--card-border)] text-sm text-[var(--muted)] hover:text-white transition"
      >
        <span aria-hidden>🏃</span> Buurtheld
      </Link>
    </aside>
  );
}
