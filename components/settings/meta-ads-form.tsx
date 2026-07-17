'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

// ─── Schema ───────────────────────────────────────────────────────────────────
// Mirrors server-side validation in /api/meta-ads/connect (client-side only for UX).
// The server always re-validates regardless of what the client sends.
const MetaAdsSchema = z.object({
  accountId: z
    .string()
    .trim()
    .min(1, 'Account ID é obrigatório')
    .refine(
      (val) => /^\d+$/.test(val) || /^act_\d+$/.test(val),
      'Account ID deve conter apenas dígitos (ex: 123456789 ou act_123456789)'
    ),
  token: z
    .string()
    .trim()
    .min(20, 'O System User token deve ter pelo menos 20 caracteres'),
  backfillDays: z.coerce
    .number()
    .int()
    .min(7, 'Mínimo de 7 dias')
    .max(365, 'Máximo de 365 dias'),
})

// z.coerce.number() makes the schema's INPUT type `unknown` (pre-coercion) and
// OUTPUT type `number` (post-coercion) — RHF's form state (register/defaultValues)
// works with the input shape, while onSubmit receives the resolver's parsed output.
type MetaAdsFormInput = z.input<typeof MetaAdsSchema>
type MetaAdsFormValues = z.output<typeof MetaAdsSchema>

// ─── Props ────────────────────────────────────────────────────────────────────
interface MetaAdsFormProps {
  tenantId: string
  initialStatus: 'connected' | 'not_configured' | 'invalid'
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

// ─── MetaAdsForm ─────────────────────────────────────────────────────────────
export function MetaAdsForm({ tenantId, initialStatus }: MetaAdsFormProps) {
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'not_configured' | 'invalid'
  >(initialStatus)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MetaAdsFormInput, unknown, MetaAdsFormValues>({
    resolver: zodResolver(MetaAdsSchema),
    defaultValues: { accountId: '', token: '', backfillDays: 90 },
  })

  const onSubmit = async (values: MetaAdsFormValues) => {
    setServerError(null)

    try {
      const res = await fetch('/api/meta-ads/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: values.accountId,
          token: values.token,
          tenantId,
          backfillDays: values.backfillDays,
        }),
      })

      const data = (await res.json()) as { success?: boolean; error?: string }

      if (!res.ok || !data.success) {
        setServerError(data.error ?? 'Erro desconhecido ao conectar conta Meta Ads.')
        setConnectionStatus('invalid')
        return
      }

      // Success: update badge, clear the token field (never echo token back)
      setConnectionStatus('connected')
      // Reset only the token field; keep accountId visible for confirmation
      reset({ accountId: values.accountId, token: '', backfillDays: values.backfillDays })
    } catch {
      setServerError('Erro de rede. Verifique sua conexão e tente novamente.')
      setConnectionStatus('invalid')
    }
  }

  return (
    <div className="space-y-4">
      {/* Connection status badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <StatusBadge status={connectionStatus} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Account ID */}
        <div className="space-y-1.5">
          <Label htmlFor="meta-account-id">
            Account ID
            <span className="ml-1 text-muted-foreground font-normal">(ex: act_123456789)</span>
          </Label>
          <Input
            id="meta-account-id"
            type="text"
            placeholder="123456789"
            autoComplete="off"
            aria-invalid={!!errors.accountId}
            {...register('accountId')}
          />
          {errors.accountId && (
            <p className="text-xs text-destructive">{errors.accountId.message}</p>
          )}
        </div>

        {/* System User Token (textarea for long tokens) */}
        <div className="space-y-1.5">
          <Label htmlFor="meta-token">
            System User Token
          </Label>
          <textarea
            id="meta-token"
            rows={3}
            placeholder="Cole o token do System User aqui..."
            autoComplete="off"
            className={[
              'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm',
              'transition-colors outline-none resize-none font-mono',
              'placeholder:text-muted-foreground',
              'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
              'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
              errors.token ? 'border-destructive ring-2 ring-destructive/20' : '',
            ].join(' ')}
            aria-invalid={!!errors.token}
            {...register('token')}
          />
          {errors.token && (
            <p className="text-xs text-destructive">{errors.token.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Gere o token em Meta Business Manager → System Users → Generate Token (permissão ads_read necessária).
          </p>
        </div>

        {/* Backfill window (SET-03, D-01/D-05) */}
        <div className="space-y-1.5">
          <Label htmlFor="meta-backfill-days">
            Janela de histórico (dias)
            <span className="ml-1 text-muted-foreground font-normal">(7–365, padrão 90)</span>
          </Label>
          <Input
            id="meta-backfill-days"
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
            Define quantos dias de histórico serão puxados no primeiro sync desta conta. Mudanças aqui valem só para o próximo primeiro sync — não reprocessam dados já sincronizados.
          </p>
        </div>

        {/* Server-side error message */}
        {serverError && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </div>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? 'Validando...' : 'Conectar Meta Ads'}
        </Button>
      </form>
    </div>
  )
}
