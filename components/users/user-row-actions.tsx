'use client'

import { useState } from 'react'
import { MoreVertical } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { EditUserEmailDialog } from './edit-user-email-dialog'
import { ResetUserPasswordDialog } from './reset-user-password-dialog'
import { RemoveUserAccessDialog } from './remove-user-access-dialog'
import type { ManagedUser, UserScope } from './user-scope'

interface UserRowActionsProps {
  user: ManagedUser
  scope: UserScope
}

export function UserRowActions({ user, scope }: UserRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label="Ações do usuário" />}
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>Editar e-mail</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setResetOpen(true)}>Resetar senha</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setRemoveOpen(true)}>Remover acesso</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditUserEmailDialog open={editOpen} onOpenChange={setEditOpen} user={user} scope={scope} />
      <ResetUserPasswordDialog open={resetOpen} onOpenChange={setResetOpen} user={user} scope={scope} />
      <RemoveUserAccessDialog open={removeOpen} onOpenChange={setRemoveOpen} user={user} scope={scope} />
    </>
  )
}
