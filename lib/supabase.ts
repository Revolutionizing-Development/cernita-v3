import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Browser singleton using @supabase/ssr — sessions stored in cookies,
// not localStorage. Token refresh handled automatically by middleware.ts.
let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error(
        'Missing Supabase environment variables. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      )
    }
    _supabase = createBrowserClient(url, key)
  }
  return _supabase
}

// Lazy proxy — safe during static build; initialises on first runtime access.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabase(), prop)
  },
})
