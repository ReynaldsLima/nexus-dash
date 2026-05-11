import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type AppMetadata = {
  role?: 'super_admin' | 'tenant_admin' | 'viewer' | 'none' | null
  tenant_id?: string | null
  tenant_slug?: string | null
}

function decodeJwtClaims(token: string | undefined): AppMetadata | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = Buffer.from(payload, 'base64').toString('utf8')
    return (JSON.parse(json)?.app_metadata ?? null) as AppMetadata | null
  } catch {
    return null
  }
}

const PUBLIC_PATHS = new Set(['/login'])

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (!user) {
    if (PUBLIC_PATHS.has(pathname)) return supabaseResponse
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const { data: { session } } = await supabase.auth.getSession()
  const claims = decodeJwtClaims(session?.access_token)
  const role = claims?.role ?? null
  const tenantSlug = claims?.tenant_slug ?? null

  if (pathname === '/login' || pathname === '/') {
    const url = request.nextUrl.clone()
    if (role === 'super_admin') {
      url.pathname = '/tenants'
    } else if ((role === 'tenant_admin' || role === 'viewer') && tenantSlug) {
      url.pathname = `/${tenantSlug}/dashboard`
    } else {
      url.pathname = '/login'
      url.searchParams.set('error', 'no_membership')
    }
    return NextResponse.redirect(url)
  }

  if (pathname === '/tenants' || pathname.startsWith('/tenants/')) {
    if (role !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
