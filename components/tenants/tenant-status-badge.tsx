import { cn } from '@/lib/utils'

export function TenantStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        active
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-zinc-500/20 text-zinc-400'
      )}
    >
      {active ? 'Ativo' : 'Inativo'}
    </span>
  )
}
