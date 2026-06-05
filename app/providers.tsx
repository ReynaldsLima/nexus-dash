'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Factory keeps defaultOptions in one place and is called once per component mount.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 min — dados de dashboard não precisam de real-time
        retry: 1,
      },
    },
  })
}

// QueryClient is created inside the component via useState so each browser tab
// gets its own isolated cache. A module-level singleton would share cache across
// concurrent SSR requests on the same server instance (cross-request contamination).
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
