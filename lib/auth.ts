import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

// Drop-in auth guard for API routes.
// Reads the access token from the Authorization header (Bearer <token>),
// creates a one-shot Supabase client with that token, and verifies it
// via supabase.auth.getUser().
//
// This approach works with the localStorage-based browser client —
// no cookies needed, no navigator.locks contention.
export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<User | null> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated' })
    return null
  }

  const token = authHeader.slice(7)

  // Create a one-shot Supabase client with the user's access token.
  // This verifies the token is valid and extracts the user.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    res.status(401).json({ error: 'Not authenticated' })
    return null
  }

  return user
}
