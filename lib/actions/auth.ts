'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const loginSchema = z.object({
  email: z.email({ message: 'E-mail inválido' }),
  password: z.string().min(1, { message: 'Informe sua senha' }),
})

export type SignInResult = { error: string } | { ok: true }

export async function signIn(_prev: SignInResult | null, formData: FormData): Promise<SignInResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? 'E-mail ou senha incorretos. Tente novamente.'
    return { error: firstIssue }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: 'E-mail ou senha incorretos. Tente novamente.' }
  }

  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
