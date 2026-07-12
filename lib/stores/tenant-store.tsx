'use client'

import React, { createContext, useContext, useRef, type ReactNode } from 'react'
import { createStore, useStore } from 'zustand'

export type Tenant = {
  id: string
  name: string
  slug: string
  active: boolean
}

export type Role = 'super_admin' | 'tenant_admin' | 'agency' | 'none' | null

export interface TenantState {
  activeTenant: Tenant | null
  tenants: Tenant[]
  role: Role
  setActiveTenant: (tenant: Tenant) => void
  setTenants: (tenants: Tenant[]) => void
}

export type TenantStore = ReturnType<typeof createTenantStore>

export function createTenantStore(initState?: Partial<TenantState>) {
  return createStore<TenantState>()((set) => ({
    activeTenant: null,
    tenants: [],
    role: null,
    setActiveTenant: (tenant) => set({ activeTenant: tenant }),
    setTenants: (tenants) => set({ tenants }),
    ...initState,
  }))
}

const TenantStoreContext = createContext<TenantStore | null>(null)

export interface TenantStoreProviderProps {
  children: ReactNode
  initial?: Partial<TenantState>
}

export function TenantStoreProvider({ children, initial }: TenantStoreProviderProps) {
  const ref = useRef<TenantStore | null>(null)
  if (!ref.current) {
    ref.current = createTenantStore(initial)
  }
  return (
    <TenantStoreContext value={ref.current}>
      {children}
    </TenantStoreContext>
  )
}

export function useTenantStore<T>(selector: (state: TenantState) => T): T {
  const store = useContext(TenantStoreContext)
  if (!store) {
    throw new Error('useTenantStore must be used inside <TenantStoreProvider>')
  }
  return useStore(store, selector)
}
