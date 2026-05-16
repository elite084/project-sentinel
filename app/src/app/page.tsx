const SERVICES = [
  { name: 'auth',      port: 4001, endpoint: '/auth/login' },
  { name: 'payments',  port: 4002, endpoint: '/payments/charge' },
  { name: 'inventory', port: 4003, endpoint: '/inventory/check' },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-16">
        <h1 className="mb-3 text-5xl font-bold tracking-tight">Project Sentinel</h1>
        <p className="text-xl text-gray-400">Autonomous incident resolution engine</p>
      </header>

      <section>
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-widest text-gray-500">
          Monitored Services
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SERVICES.map(({ name, port, endpoint }) => (
            <div
              key={name}
              className="rounded-xl border border-gray-800 bg-gray-900 p-6 transition-colors hover:border-gray-700"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="font-mono text-xs text-gray-500">:{port}</span>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
              </div>
              <h3 className="text-lg font-semibold capitalize">{name}</h3>
              <p className="mt-1 font-mono text-xs text-gray-600">{endpoint}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
