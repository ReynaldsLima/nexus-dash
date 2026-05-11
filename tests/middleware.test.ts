import { describe, it, expect } from 'vitest'

/**
 * AUTH-05 — Three-role access gates.
 *
 * Per CONTEXT.md D-06, middleware.ts MUST:
 *  - Redirect unauthenticated requests to /login
 *  - Redirect / to role home (/tenants for super_admin, /[slug]/dashboard otherwise)
 *  - Block tenant_admin and viewer from /tenants/* (Super Admin only)
 *  - Block viewer from admin routes inside the tenant
 *
 * These tests will be filled in by Plan 03 (plumbing — middleware implementation).
 */
describe('middleware route guards (AUTH-05)', () => {
  it.todo('redirects unauthenticated requests to /login')
  it.todo('redirects super_admin from / to /tenants')
  it.todo('redirects tenant_admin from / to /[tenant_slug]/dashboard')
  it.todo('blocks tenant_admin from /tenants (returns 307 redirect to /)')
  it.todo('blocks viewer from /tenants (returns 307 redirect to /)')
  it.todo('allows super_admin to access /tenants')
})

describe('JWT claim extraction (AUTH-05 prereq)', () => {
  it('decodes a sample JWT payload base64-url segment without throwing', () => {
    const samplePayload = Buffer.from(
      JSON.stringify({ app_metadata: { role: 'viewer', tenant_id: 't1', tenant_slug: 'acme' } })
    ).toString('base64')
    const decoded = JSON.parse(Buffer.from(samplePayload, 'base64').toString('utf8'))
    expect(decoded.app_metadata.role).toBe('viewer')
    expect(decoded.app_metadata.tenant_slug).toBe('acme')
  })
})
