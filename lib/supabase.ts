import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Browser singleton using @supabase/supabase-js — sessions stored in
// localStorage. No navigator.locks contention (unlike @supabase/ssr's
// createBrowserClient which uses cookie-based locks and causes
// "Lock was released because another request stole it" errors when
// multiple concurrent Supabase calls compete for the auth-token lock).
//
// This app has no middleware.ts — SSR cookie auth is unnecessary.
// Standard localStorage persistence + auto-refresh is all we need.
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
    _supabase = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return _supabase
}

// Lazy proxy — safe during static build; initialises on first runtime access.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabase(), prop)
  },
})
