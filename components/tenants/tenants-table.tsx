import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { TenantStatusBadge } from './tenant-status-badge'

export interface TenantRow {
  id: string
  name: string
  slug: string
  active: boolean
}

export function TenantsTable({ tenants }: { tenants: TenantRow[] }) {
  if (tenants.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <h2 className="text-xl font-semibold leading-tight">Nenhum tenant cadastrado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Crie um tenant para começar a gerenciar campanhas.
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenants.map((tenant) => (
          <TableRow key={tenant.id}>
            <TableCell className="font-semibold">
              <Link href={`/tenants/${tenant.slug}`} className="hover:underline">
                {tenant.name}
              </Link>
            </TableCell>
            <TableCell className="font-mono text-xs">{tenant.slug}</TableCell>
            <TableCell><TenantStatusBadge active={tenant.active} /></TableCell>
            <TableCell className="text-right">
              <Button
                variant="default"
                size="sm"
                disabled={!tenant.active}
                render={<Link href={`/${tenant.slug}/dashboard`} />}
              >
                Entrar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
