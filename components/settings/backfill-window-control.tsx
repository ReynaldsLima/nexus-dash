'use client'

import { useState } from 'react'

import { updateBackfillWindow } from '@/lib/actions/ad-accounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BackfillWindowControlProps {
  tenantId: string
  tenantSlug: string
  channel: 'google_ads' | 'meta_ads'
  initialDays: number
}

// SET-05: always-editable inline control next to each ChannelStatusBadge — no
// "Editar" toggle, no dialog (D-02). "Salvar" only appears when the value
// differs from the persisted one; save is optimistic with revert-on-failure
// (D-03), and success has no extra message — the settled value IS the
// feedback (D-06). Functional only, Phase 12 restyles Settings.
export function BackfillWindowControl({
  tenantId,
  tenantSlug,
  channel,
  initialDays,
}: BackfillWindowControlProps) {
  const [value, setValue] = useState(initialDays)
  const [persisted, setPersisted] = useState(initialDays)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isInvalid = Number.isNaN(value) || value < 7 || value > 365
  const hasChanged = value !== persisted

  async function onSave() {
    setError(null)
    setSaving(true)
    const previousPersisted = persisted
    // Optimistic: the field already shows `value`; mark it as the persisted
    // value right away so "Salvar" disappears immediately.
    setPersisted(value)
    const result = await updateBackfillWindow({ tenantId, tenantSlug, channel, days: value })
    if ('error' in result) {
      setPersisted(previousPersisted)
      setValue(previousPersisted)
      setError(result.error)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`backfill-days-${channel}`}>
        Janela de histórico (dias)
        <span className="ml-1 text-muted-foreground font-normal">(7–365)</span>
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={`backfill-days-${channel}`}
          type="number"
          min={7}
          max={365}
          value={value}
          aria-invalid={isInvalid}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-28"
        />
        {hasChanged && (
          <Button
            type="button"
            size="sm"
            disabled={saving || isInvalid}
            onClick={onSave}
          >
            Salvar
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Alterar a janela vale só para o próximo primeiro sync desta conta — não reprocessa dados já
        sincronizados.
      </p>
      {error && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}
    </div>
  )
}
