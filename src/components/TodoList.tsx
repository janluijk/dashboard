'use client';

import { useState } from 'react';

type Todo = {
  id: number;
  title: string;
  done: boolean;
  dueDate: string | null;
};

export function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    const title = draft.trim();
    const isValid = title.length > 0;
    if (!isValid) return;
    setBusy(true);
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    setBusy(false);
    const ok = res.ok;
    if (!ok) return;
    const data = await res.json();
    setTodos((cur) => [data.todo, ...cur]);
    setDraft('');
  }

  async function toggle(t: Todo) {
    const next = !t.done;
    setTodos((cur) => cur.map((x) => (x.id === t.id ? { ...x, done: next } : x)));
    await fetch(`/api/todos/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: next }),
    });
  }

  async function remove(id: number) {
    setTodos((cur) => cur.filter((x) => x.id !== id));
    await fetch(`/api/todos/${id}`, { method: 'DELETE' });
  }

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <p className="text-xs uppercase tracking-wider text-[var(--muted)] mb-3">Todo</p>
      <div className="flex gap-2 mb-4">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            const isEnter = e.key === 'Enter';
            if (isEnter) add();
          }}
          placeholder="Add a task…"
          className="flex-1 bg-transparent border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={add}
          disabled={busy}
          className="rounded-lg bg-[var(--accent)] text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          Add
        </button>
      </div>
      <ul className="space-y-1">
        {open.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-1 group">
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggle(t)}
              className="w-4 h-4 accent-[var(--accent)]"
            />
            <span className="flex-1 text-sm">{t.title}</span>
            <button
              onClick={() => remove(t.id)}
              className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        ))}
        {open.length === 0 ? (
          <li className="text-sm text-[var(--muted)] py-2">Nothing to do. Nice.</li>
        ) : null}
      </ul>
      {done.length > 0 ? (
        <>
          <p className="text-xs uppercase tracking-wider text-[var(--muted)] mt-5 mb-2">
            Done ({done.length})
          </p>
          <ul className="space-y-1">
            {done.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-1 group">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggle(t)}
                  className="w-4 h-4 accent-[var(--accent)]"
                />
                <span className="flex-1 text-sm line-through text-[var(--muted)]">{t.title}</span>
                <button
                  onClick={() => remove(t.id)}
                  className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
