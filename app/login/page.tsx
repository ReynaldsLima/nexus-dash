import type { Metadata } from 'next'

import { LoginForm } from '@/components/auth/login-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Login — NEXUS-DASH',
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-semibold leading-none">NEXUS-DASH</CardTitle>
          <CardDescription className="text-sm font-normal">Faça login para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm searchParams={searchParams} />
        </CardContent>
      </Card>
    </main>
  )
}
