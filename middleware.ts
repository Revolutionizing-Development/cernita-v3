import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Runs on every request. Refreshes the Supabase session cookie so the
// JWT never goes stale between page loads — no manual token refresh needed.
export async function middleware(request: NextRequest) {
  // Pass through immediately if env vars aren't configured yet.
  // This prevents a missing-config crash from taking down every route.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write to both the request (for downstream reads) and the response
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    // This call refreshes the session if it's expiring — the key operation.
    await supabase.auth.getUser()
  } catch {
    // A middleware error must never block the user — pass through.
    // The page itself will handle the unauthenticated state.
  }

  return response
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
