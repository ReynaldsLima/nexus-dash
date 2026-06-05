'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Singleton — criado uma vez, reutilizado durante toda a sessão.
// NÃO declarar dentro do componente para evitar recriação do cache a cada render.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — dados de dashboard não precisam de real-time
      retry: 1,
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
