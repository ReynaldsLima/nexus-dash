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
import { TenantStatusBadge } from '@/components/tenants/tenant-status-badge'

export interface AgencyRow {
  id: string
  name: string
  active: boolean
}

export function AgenciesTable({ agencies }: { agencies: AgencyRow[] }) {
  if (agencies.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <h2 className="text-xl font-semibold leading-tight">Nenhuma agência cadastrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Crie uma agência para conceder acesso a múltiplos clientes.
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {agencies.map((agency) => (
          <TableRow key={agency.id}>
            <TableCell className="font-semibold">{agency.name}</TableCell>
            <TableCell><TenantStatusBadge active={agency.active} /></TableCell>
            <TableCell className="text-right">
              <Button
                variant="default"
                size="sm"
                render={<Link href={`/agencies/${agency.id}`} />}
              >
                Gerenciar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
