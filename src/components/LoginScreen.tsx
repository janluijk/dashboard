export function LoginScreen() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 shadow-xl">
        <h1 className="text-2xl font-semibold mb-2">Personal Dashboard</h1>
        <p className="text-[var(--muted)] mb-6 text-sm">
          Sign in with Strava to load your weekly mileage and workout time, then track study sessions and todos here.
        </p>
        <a
          href="/api/auth/login"
          className="inline-flex items-center justify-center w-full rounded-lg bg-[var(--accent)] text-white font-medium px-4 py-3 hover:opacity-90 transition"
        >
          Connect Strava
        </a>
      </div>
    </main>
  );
}
