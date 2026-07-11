'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Megaphone, Sparkles, Users2, Bot, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnomalyAlertsStore } from '@/lib/stores/anomaly-alerts'

const MARKETING_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', key: 'dashboard' },
  { icon: Megaphone, label: 'Campanhas', key: 'campanhas' },
  { icon: Sparkles, label: 'AI Insights', key: 'insights' },
]

const LEADS_ITEMS = [
  { icon: Users2, label: 'Gestão de Leads', key: 'leads' },
  { icon: Bot, label: 'Agente IA', key: 'leads/agente' },
]

function NavLink({ href, icon: Icon, label, isActive, badgeCount }: { href: string; icon: React.ElementType; label: string; isActive: boolean; badgeCount?: number }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
      {!!badgeCount && badgeCount > 0 && (
        <span
          className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
          style={{ background: 'var(--chart-5)', color: 'white' }}
          aria-label={`${badgeCount} alertas de anomalia não visualizados`}
        >
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      )}
    </Link>
  )
}

export function SidebarNav({ slug, role }: { slug: string; role?: string | null }) {
  const pathname = usePathname()
  const unread = useAnomalyAlertsStore((s) => s.unread)
  const clearUnread = useAnomalyAlertsStore((s) => s.clearUnread)
  const marketingItems = role !== 'super_admin' ? MARKETING_ITEMS.filter((item) => item.key !== 'insights') : MARKETING_ITEMS

  useEffect(() => {
    if (pathname.startsWith(`/${slug}/insights`)) clearUnread()
  }, [pathname, slug, clearUnread])

  return (
    <div className="flex flex-col h-full py-4 gap-4">
      <div>
        <p className="px-4 mb-2 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">
          Marketing
        </p>
        <nav className="flex flex-col gap-0.5 px-2">
          {marketingItems.map(({ icon, label, key }) => (
            <NavLink
              key={key}
              href={`/${slug}/${key}`}
              icon={icon}
              label={label}
              isActive={pathname.startsWith(`/${slug}/${key}`)}
              badgeCount={key === 'insights' ? unread : undefined}
            />
          ))}
        </nav>
      </div>

      <div className="border-t border-border/50 pt-4">
        <p className="px-4 mb-2 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">
          Leads
        </p>
        <nav className="flex flex-col gap-0.5 px-2">
          {LEADS_ITEMS.map(({ icon, label, key }) => {
            const href = `/${slug}/${key}`
            // "leads/agente" should only be active on exact match; "leads" active on /leads but not /leads/agente
            const isActive = key === 'leads/agente'
              ? pathname === href || pathname.startsWith(href + '/')
              : pathname === href
            return (
              <NavLink key={key} href={href} icon={icon} label={label} isActive={isActive} />
            )
          })}
        </nav>
      </div>

      {role !== 'agency' && (
        <div className="border-t border-border/50 pt-4 mt-auto">
          <p className="px-4 mb-2 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">
            Conta
          </p>
          <nav className="flex flex-col gap-0.5 px-2">
            <NavLink
              href={`/${slug}/settings`}
              icon={Settings}
              label="Configurações"
              isActive={pathname.startsWith(`/${slug}/settings`)}
            />
          </nav>
        </div>
      )}
    </div>
  )
}
