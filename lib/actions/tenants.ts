'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createServiceClient } from '@/lib/supabase/service'
import { requireSuperAdmin } from '@/lib/actions/auth-guard'

const slugSchema = z
  .string()
  .min(2, { message: 'Slug deve ter pelo menos 2 caracteres' })
  .max(50, { message: 'Slug deve ter no máximo 50 caracteres' })
  .regex(/^[a-z0-9-]+$/, { message: 'Slug deve conter apenas letras minúsculas, números e hifens' })

const createTenantSchema = z.object({
  name: z.string().min(1, { message: 'Informe o nome do tenant' }).max(120),
  slug: slugSchema,
})

const tenantIdSchema = z.object({
  tenantId: z.string().uuid(),
})

const createUserSchema = z.object({
  email: z.email({ message: 'E-mail inválido' }),
  tenantId: z.string().uuid(),
  password: z.string().min(12).optional(),
})

const editUserEmailSchema = z.object({
  userId: z.string().uuid(),
  email: z.email({ message: 'E-mail inválido' }),
  tenantId: z.string().uuid(),
})

const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
})

const removeAccessSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
})

function generateTempPassword(): string {
  return randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 16)
    + 'Aa1!'
}

export type CreateTenantResult =
  | { ok: true; tenantId: string }
  | { error: string }

export async function createTenant(input: { name: string; slug: string }): Promise<CreateTenantResult> {
  const gate = await requireSuperAdmin()
  if ('error' in gate) return gate

  const parsed = createTenantSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('tenants')
    .insert({ name: parsed.data.name, slug: parsed.data.slug })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'Já existe um tenant com este slug.' }
    }
    return { error: error.message }
  }

  revalidatePath('/tenants')
  return { ok: true, tenantId: data.id }
}

export type ToggleTenantResult = { ok: true } | { error: string }

async function setTenantActive(tenantId: string, active: boolean): Promise<ToggleTenantResult> {
  const gate = await requireSuperAdmin()
  if ('error' in gate) return gate

  const parsed = tenantIdSchema.safeParse({ tenantId })
  if (!parsed.success) return { error: 'tenantId inválido' }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('tenants')
    .update({ active })
    .eq('id', parsed.data.tenantId)

  if (error) return { error: error.message }

  revalidatePath('/tenants')
  revalidatePath(`/tenants/${parsed.data.tenantId}`)
  return { ok: true }
}

export async function deactivateTenant(tenantId: string): Promise<ToggleTenantResult> {
  return setTenantActive(tenantId, false)
}

export async function reactivateTenant(tenantId: string): Promise<ToggleTenantResult> {
  return setTenantActive(tenantId, true)
}

export type CreateUserResult =
  | { ok: true; userId: string; tempPassword: string }
  | { error: string }

export async function createTenantUser(input: {
  email: string
  tenantId: string
  password?: string
}): Promise<CreateUserResult> {
  const gate = await requireSuperAdmin()
  if ('error' in gate) return gate

  const parsed = createUserSchema.safeParse(input)
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

  const { error: tuError } = await supabase
    .from('tenant_users')
    .insert({
      tenant_id: parsed.data.tenantId,
      user_id: authUser.user.id,
      role: 'tenant_admin',
    })

  if (tuError) {
    await supabase.auth.admin.deleteUser(authUser.user.id)
    return { error: tuError.message }
  }

  revalidatePath(`/tenants/${parsed.data.tenantId}`)
  return { ok: true, userId: authUser.user.id, tempPassword }
}

export type UserActionResult = { ok: true } | { error: string }
export type ResetPasswordResult = { ok: true; tempPassword: string } | { error: string }

export async function editTenantUserEmail(input: {
  userId: string
  email: string
  tenantId: string
}): Promise<UserActionResult> {
  const gate = await requireSuperAdmin()
  if ('error' in gate) return gate

  const parsed = editUserEmailSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(parsed.data.userId, {
    email: parsed.data.email,
    email_confirm: true,
  })

  if (error) {
    if (error.message?.toLowerCase().includes('already')) {
      return { error: 'Este e-mail já está cadastrado.' }
    }
    return { error: error.message }
  }

  revalidatePath(`/tenants/${parsed.data.tenantId}`)
  return { ok: true }
}

// D-05: whether the user's existing session survives a password reset is platform-dependent
// (10-RESEARCH.md Critical Finding) — do NOT assert either behavior here; verified manually in Plan 04.
export async function resetTenantUserPassword(input: {
  userId: string
  tenantId: string
}): Promise<ResetPasswordResult> {
  const gate = await requireSuperAdmin()
  if ('error' in gate) return gate

  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = createServiceClient()
  const tempPassword = generateTempPassword()
  const { error } = await supabase.auth.admin.updateUserById(parsed.data.userId, {
    password: tempPassword,
  })

  if (error) return { error: error.message }

  revalidatePath(`/tenants/${parsed.data.tenantId}`)
  return { ok: true, tempPassword }
}

export async function removeTenantUserAccess(input: {
  userId: string
  tenantId: string
}): Promise<UserActionResult> {
  const gate = await requireSuperAdmin()
  if ('error' in gate) return gate

  const parsed = removeAccessSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('tenant_users')
    .delete()
    .eq('tenant_id', parsed.data.tenantId)
    .eq('user_id', parsed.data.userId)

  if (error) return { error: error.message }

  const { error: rpcError } = await supabase.rpc('revoke_user_sessions', {
    target_user_id: parsed.data.userId,
  })

  if (rpcError) return { error: rpcError.message }

  revalidatePath(`/tenants/${parsed.data.tenantId}`)
  return { ok: true }
}
