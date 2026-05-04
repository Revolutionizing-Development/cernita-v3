import { NextApiRequest, NextApiResponse } from 'next'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

// Build a server-side Supabase client that reads/writes session cookies
// from the Pages Router req/res objects. No service role key needed —
// auth is verified via the session cookie set by the browser client.
export function createSupabaseServerClient(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.keys(req.cookies).map(name => ({
            name,
            value: req.cookies[name] ?? '',
          }))
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          // Preserve any cookies already set on this response
          const existing = res.getHeader('Set-Cookie')
          const prev: string[] = existing
            ? Array.isArray(existing)
              ? (existing as string[])
              : [String(existing)]
            : []

          res.setHeader('Set-Cookie', [
            ...prev,
            ...cookiesToSet.map(({ name, value, options }) =>
              serializeCookie(name, value, options)
            ),
          ])
        },
      },
    }
  )
}

// Minimal cookie serializer — covers all fields Supabase auth uses.
function serializeCookie(name: string, value: string, options?: CookieOptions): string {
  let str = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
  if (options?.maxAge != null) str += `; Max-Age=${Math.floor(options.maxAge)}`
  if (options?.domain)        str += `; Domain=${options.domain}`
  if (options?.path)          str += `; Path=${options.path}`
  if (options?.expires)       str += `; Expires=${(options.expires as Date).toUTCString()}`
  if (options?.httpOnly)      str += `; HttpOnly`
  if (options?.secure)        str += `; Secure`
  if (options?.sameSite)      str += `; SameSite=${options.sameSite}`
  return str
}

// Drop-in auth guard for API routes. Returns the User or sends 401 and returns null.
export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<User | null> {
  const supabase = createSupabaseServerClient(req, res)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    res.status(401).json({ error: 'Not authenticated' })
    return null
  }

  return user
}
