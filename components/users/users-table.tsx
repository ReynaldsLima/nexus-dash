import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { UserRowActions } from './user-row-actions'
import type { ManagedUser, UserScope } from './user-scope'

interface UsersTableProps {
  users: ManagedUser[]
  scope: UserScope
}

export function UsersTable({ users, scope }: UsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Nenhum usuário com acesso ainda.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>E-mail</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-semibold">{u.email}</TableCell>
            <TableCell className="text-right">
              <UserRowActions user={u} scope={scope} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
