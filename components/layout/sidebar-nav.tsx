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
        'flex items-center gap-2.5 mx-2 px-3.5 py-2 rounded-md text-[13px] font-medium transition-all duration-150',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
      )}
    >
      <Icon className={cn('size-4 shrink-0', isActive ? 'opacity-100' : 'opacity-60')} aria-hidden="true" />
      {label}
      {!!badgeCount && badgeCount > 0 && (
        <span
          className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-medium"
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
        <p className="t-label px-5 pb-2 text-muted-foreground">
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
        <p className="t-label px-5 pb-2 text-muted-foreground">
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
          <p className="t-label px-5 pb-2 text-muted-foreground">
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
