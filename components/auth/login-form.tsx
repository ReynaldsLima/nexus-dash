'use client'

import { use, useActionState } from 'react'
import { Loader2 } from 'lucide-react'

import { signIn, type SignInResult } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LoginFormProps {
  searchParams: Promise<{ error?: string }>
}

export function LoginForm({ searchParams }: LoginFormProps) {
  const params = use(searchParams)
  const initialError = params.error === 'no_membership'
    ? 'Sua conta não está vinculada a nenhum tenant. Contate o administrador.'
    : null

  const [state, formAction, isPending] = useActionState<SignInResult | null, FormData>(
    async (_prev, formData) => signIn(_prev, formData),
    null
  )

  const errorMessage =
    (state && 'error' in state ? state.error : null) ?? initialError

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-semibold leading-snug">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@empresa.com"
          aria-invalid={errorMessage ? true : undefined}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-semibold leading-snug">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? 'login-error' : undefined}
        />
        {errorMessage ? (
          <p id="login-error" role="alert" className="text-xs font-normal text-destructive">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isPending} className="w-full h-11">
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">Entrando…</span>
          </>
        ) : (
          'Entrar'
        )}
      </Button>
    </form>
  )
}
