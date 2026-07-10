'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createServiceClient } from '@/lib/supabase/service'

const createAgencySchema = z.object({
  name: z.string().min(1, { message: 'Informe o nome da agência' }).max(120),
})

const agencyIdSchema = z.object({ agencyId: z.string().uuid() })

const createAgencyUserSchema = z.object({
  email: z.email({ message: 'E-mail inválido' }),
  agencyId: z.string().uuid(),
  password: z.string().min(12).optional(),
})

const grantSchema = z.object({
  agencyId: z.string().uuid(),
  tenantId: z.string().uuid(),
})

function generateTempPassword(): string {
  return randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 16) + 'Aa1!'
}

export type CreateAgencyResult = { ok: true; agencyId: string } | { error: string }

export async function createAgency(input: { name: string }): Promise<CreateAgencyResult> {
  const parsed = createAgencySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('agencies')
    .insert({ name: parsed.data.name })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/agencies')
  return { ok: true, agencyId: data.id }
}

export type ToggleAgencyResult = { ok: true } | { error: string }

async function setAgencyActive(agencyId: string, active: boolean): Promise<ToggleAgencyResult> {
  const parsed = agencyIdSchema.safeParse({ agencyId })
  if (!parsed.success) return { error: 'agencyId inválido' }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('agencies')
    .update({ active })
    .eq('id', parsed.data.agencyId)

  if (error) return { error: error.message }

  revalidatePath('/agencies')
  revalidatePath(`/agencies/${parsed.data.agencyId}`)
  return { ok: true }
}

export async function deactivateAgency(agencyId: string): Promise<ToggleAgencyResult> {
  return setAgencyActive(agencyId, false)
}

export async function reactivateAgency(agencyId: string): Promise<ToggleAgencyResult> {
  return setAgencyActive(agencyId, true)
}

export type CreateAgencyUserResult =
  | { ok: true; userId: string; tempPassword: string }
  | { error: string }

export async function createAgencyUser(input: {
  email: string
  agencyId: string
  password?: string
}): Promise<CreateAgencyUserResult> {
  const parsed = createAgencyUserSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = createServiceClient()
  const tempPassword = parsed.data.password ?? generateTempPassword()

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: tempPassword,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message?.toLowerCase().includes('already')) {
      return { error: 'Este e-mail já está cadastrado.' }
    }
    return { error: authError.message ?? 'Erro ao criar usuário.' }
  }
  if (!authUser?.user) {
    return { error: 'Erro ao criar usuário.' }
  }

  // D-04: agency users are NEVER inserted into tenant_users — only agency_users.
  const { error: auError } = await supabase
    .from('agency_users')
    .insert({ agency_id: parsed.data.agencyId, user_id: authUser.user.id })

  if (auError) {
    await supabase.auth.admin.deleteUser(authUser.user.id)
    return { error: auError.message }
  }

  revalidatePath(`/agencies/${parsed.data.agencyId}`)
  return { ok: true, userId: authUser.user.id, tempPassword }
}

export type GrantResult = { ok: true } | { error: string }

export async function grantTenant(agencyId: string, tenantId: string): Promise<GrantResult> {
  const parsed = grantSchema.safeParse({ agencyId, tenantId })
  if (!parsed.success) return { error: 'Dados inválidos' }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('agency_tenants')
    .upsert(
      { agency_id: parsed.data.agencyId, tenant_id: parsed.data.tenantId },
      { onConflict: 'agency_id,tenant_id', ignoreDuplicates: true }
    )

  if (error) return { error: error.message }

  revalidatePath(`/agencies/${parsed.data.agencyId}`)
  return { ok: true }
}

export async function revokeTenant(agencyId: string, tenantId: string): Promise<GrantResult> {
  const parsed = grantSchema.safeParse({ agencyId, tenantId })
  if (!parsed.success) return { error: 'Dados inválidos' }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('agency_tenants')
    .delete()
    .eq('agency_id', parsed.data.agencyId)
    .eq('tenant_id', parsed.data.tenantId)

  if (error) return { error: error.message }

  revalidatePath(`/agencies/${parsed.data.agencyId}`)
  return { ok: true }
}
