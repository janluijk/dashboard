'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const baseClass =
  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition';
const activeClass = 'bg-[var(--card-border)] font-semibold text-white';
const inactiveClass =
  'font-medium text-[var(--muted)] hover:bg-[var(--card-border)] hover:text-white';

export function Sidebar() {
  const pathname = usePathname();
  const isDashboard = pathname === '/';
  const isBuurtheld = pathname.startsWith('/buurtheld');

  return (
    <aside className="w-56 shrink-0 border-r border-[var(--card-border)] bg-[var(--card)] p-4 hidden md:flex flex-col gap-1">
      <div className="px-2 py-3">
        <p className="text-sm font-semibold">Personal</p>
      </div>
      <Link
        href="/"
        aria-current={isDashboard ? 'page' : undefined}
        className={`${baseClass} ${isDashboard ? activeClass : inactiveClass}`}
      >
        <span aria-hidden>📊</span> Dashboard
      </Link>
      <Link
        href="/buurtheld/favorites"
        aria-current={isBuurtheld ? 'page' : undefined}
        className={`${baseClass} ${isBuurtheld ? activeClass : inactiveClass}`}
      >
        <span aria-hidden>🏃</span> Buurtheld
      </Link>
    </aside>
  );
}
