'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/buurtheld/explore', label: 'Explore' },
  { href: '/buurtheld/favorites', label: 'Favorites' },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--card-border)] bg-[var(--card)] px-4">
      <Link href="/buurtheld" className="font-semibold text-[var(--accent)]">
        Buurtheld
      </Link>
      <nav className="flex gap-1">
        {LINKS.map((l) => {
          const isActive = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={
                isActive
                  ? 'rounded-md bg-[var(--accent)] px-3 py-1 text-sm font-semibold text-white'
                  : 'rounded-md px-3 py-1 text-sm font-medium text-[var(--muted)] hover:bg-[var(--card-border)] hover:text-white transition'
              }
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
