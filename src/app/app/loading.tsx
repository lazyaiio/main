export default function AppLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-ink-100" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-100" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-ink-100" />
    </div>
  );
}
