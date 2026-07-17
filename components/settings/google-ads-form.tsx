'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

// ─── Schema ───────────────────────────────────────────────────────────────────
// Mirrors server-side validation in /api/google-ads/connect (client-side only for UX).
// The server always re-validates regardless of what the client sends.
const GoogleAdsSchema = z.object({
  customerId: z
    .string()
    .trim()
    .min(1, 'Customer ID é obrigatório')
    .refine(
      (val) => /^\d{3}-?\d{3}-?\d{4}$/.test(val),
      'Customer ID deve ter 10 dígitos (ex: 123-456-7890)'
    ),
  backfillDays: z.coerce
    .number()
    .int()
    .min(7, 'Mínimo de 7 dias')
    .max(365, 'Máximo de 365 dias'),
})

// z.coerce.number() makes the schema's INPUT type `unknown` (pre-coercion) and
// OUTPUT type `number` (post-coercion) — RHF's form state (register/defaultValues)
// works with the input shape, while onSubmit receives the resolver's parsed output.
type GoogleAdsFormInput = z.input<typeof GoogleAdsSchema>
type GoogleAdsFormValues = z.output<typeof GoogleAdsSchema>

// ─── Error code map (D-04) ────────────────────────────────────────────────────
// Covers both the callback route's codes (Plan 03) and the connect route's codes (Plan 02).
const ERROR_MESSAGES: Record<string, string> = {
  // callback route (Plan 03)
  access_denied: 'Você recusou o consentimento no Google. Tente novamente para conectar.',
  state_expired:
    'A sessão de conexão expirou (o consentimento demorou mais de 10 minutos). Tente conectar novamente.',
  no_refresh_token: 'O Google não retornou um token de atualização. Tente reconectar.',
  token_exchange_failed: 'Falha ao trocar o código de autorização com o Google. Tente novamente.',
  vault_write_failed: 'Falha ao salvar a credencial com segurança. Tente novamente.',
  save_failed: 'Falha ao salvar a conta do Google Ads. Tente novamente.',
  missing_code: 'Resposta inválida do Google (código ausente). Tente novamente.',
  // connect route (Plan 02)
  forbidden: 'Você não tem permissão para conectar o Google Ads neste tenant.',
  invalid_customer_id: 'Customer ID inválido. Use o formato 123-456-7890.',
  missing_tenant: 'Tenant não identificado. Recarregue a página e tente novamente.',
}

function resolveErrorMessage(code: string | null): string | null {
  if (!code) return null
  return ERROR_MESSAGES[code] ?? 'Erro ao conectar Google Ads. Tente novamente.'
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface GoogleAdsFormProps {
  tenantId: string
  tenantSlug: string
  initialStatus: 'connected' | 'not_configured' | 'invalid'
  initialCustomerId?: string // D-06: pre-fill when connected
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'connected' | 'not_configured' | 'invalid' }) {
  if (status === 'connected') {
    return (
      <Badge
        className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      >
        Conectado
      </Badge>
    )
  }
  if (status === 'invalid') {
    return (
      <Badge variant="destructive">
        Token inválido
      </Badge>
    )
  }
  return (
    <Badge variant="secondary">
      Não configurado
    </Badge>
  )
}

// ─── GoogleAdsForm ────────────────────────────────────────────────────────────
export function GoogleAdsForm({
  tenantId,
  tenantSlug,
  initialStatus,
  initialCustomerId,
}: GoogleAdsFormProps) {
  const [connectionStatus] = useState<'connected' | 'not_configured' | 'invalid'>(initialStatus)
  const searchParams = useSearchParams()
  const oauthErrorCode = searchParams.get('google_error')
  const oauthErrorMessage = resolveErrorMessage(oauthErrorCode)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GoogleAdsFormInput, unknown, GoogleAdsFormValues>({
    resolver: zodResolver(GoogleAdsSchema),
    defaultValues: { customerId: initialCustomerId ?? '', backfillDays: 90 },
  })

  // Top-level browser navigation (NOT fetch) — the browser must follow Google's
  // cross-site consent redirect, which a fetch/XHR request cannot do.
  const onSubmit = (values: GoogleAdsFormValues) => {
    const params = new URLSearchParams({
      customerId: values.customerId.replace(/-/g, ''),
      tenantId,
      tenantSlug,
      backfillDays: String(values.backfillDays),
    })
    window.location.href = `/api/google-ads/connect?${params.toString()}`
  }

  return (
    <div className="space-y-4">
      {/* Connection status badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <StatusBadge status={connectionStatus} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Customer ID */}
        <div className="space-y-1.5">
          <Label htmlFor="google-customer-id">
            Customer ID
            <span className="ml-1 text-muted-foreground font-normal">(ex: 123-456-7890)</span>
          </Label>
          <Input
            id="google-customer-id"
            type="text"
            placeholder="123-456-7890"
            autoComplete="off"
            aria-invalid={!!errors.customerId}
            {...register('customerId')}
          />
          {errors.customerId && (
            <p className="text-xs text-destructive">{errors.customerId.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Você será redirecionado ao Google para autorizar o acesso à conta.
          </p>
        </div>

        {/* Backfill window (SET-03, D-01/D-05) */}
        <div className="space-y-1.5">
          <Label htmlFor="google-backfill-days">
            Janela de histórico (dias)
            <span className="ml-1 text-muted-foreground font-normal">(7–365, padrão 90)</span>
          </Label>
          <Input
            id="google-backfill-days"
            type="number"
            min={7}
            max={365}
            aria-invalid={!!errors.backfillDays}
            {...register('backfillDays')}
          />
          {errors.backfillDays && (
            <p className="text-xs text-destructive">{errors.backfillDays.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Define quantos dias de histórico serão puxados no primeiro sync desta conta. Mudanças
            aqui valem só para o próximo primeiro sync — não reprocessam dados já sincronizados.
          </p>
        </div>

        {/* OAuth error message (D-04) */}
        {oauthErrorMessage && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
          >
            {oauthErrorMessage}
          </div>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          Conectar Google Ads
        </Button>
      </form>
    </div>
  )
}
