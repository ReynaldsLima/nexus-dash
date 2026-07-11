'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAnomalyAlertsStore } from '@/lib/stores/anomaly-alerts'

const CHANNEL_LABEL: Record<string, string> = { google_ads: 'Google Ads', meta_ads: 'Meta Ads' }

export function useAnomalyAlerts(tenantId: string, tenantSlug: string) {
  const increment = useAnomalyAlertsStore((s) => s.increment)

  useEffect(() => {
    if (!tenantId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`anomaly-alerts-${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'anomaly_alerts', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const a = payload.new as { drop_pct: number; campaign_name: string; channel: string }
          increment()
          const navigate = () => { window.location.href = `/${tenantSlug}/insights` }
          toast.custom(
            (id) => (
              <div
                role="button"
                tabIndex={0}
                onClick={() => { toast.dismiss(id); navigate() }}
                className="flex w-full cursor-pointer items-start gap-2 rounded-md p-4 shadow-lg"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderLeft: '3px solid var(--chart-5)',
                  color: 'var(--foreground)',
                }}
              >
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0"
                  style={{ color: 'var(--chart-5)' }}
                  aria-hidden="true"
                />
                <div className="flex flex-1 flex-col gap-1">
                  <p className="text-sm font-semibold">{`ROAS caiu ${a.drop_pct}% — ${a.campaign_name}`}</p>
                  <p className="text-sm text-muted-foreground">
                    {`Nas últimas 24 horas em ${CHANNEL_LABEL[a.channel] ?? a.channel}. Veja a análise completa.`}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toast.dismiss(id); navigate() }}
                    className="mt-1 self-end rounded-md px-2 py-1 text-xs font-semibold"
                    style={{ color: 'var(--chart-5)' }}
                  >
                    Ver Insights
                  </button>
                </div>
              </div>
            ),
            { duration: 8000, unstyled: true }
          )
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tenantId, tenantSlug, increment])
}
