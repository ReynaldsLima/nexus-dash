export type UserScope =
  | { type: 'tenant'; tenantId: string; label: string }
  | { type: 'agency'; agencyId: string; label: string }

export interface ManagedUser {
  id: string
  email: string
}
