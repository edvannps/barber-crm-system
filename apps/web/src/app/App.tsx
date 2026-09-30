import { formatBRL } from '@barber/shared';
import { useQuery } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

export function App() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/health/live`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { status: string };
    },
    retry: false,
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 p-6 text-zinc-100">
      <h1 className="text-3xl font-bold">Barber CRM</h1>
      <p className="text-zinc-400">Exemplo de preço: {formatBRL(4550)}</p>
      <p className="text-sm">
        API:{' '}
        {health.isPending ? 'verificando…' : health.isError ? 'indisponível' : health.data.status}
      </p>
    </main>
  );
}
