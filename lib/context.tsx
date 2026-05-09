import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { Entry, Box, Location, Trip, CernitaSettings, DEFAULT_SETTINGS } from './types'

// ─── State ───────────────────────────────────────────────────────────────────

export type SyncStatus = 'online' | 'syncing' | 'offline'

export interface AppState {
  session: Session | null
  user: User | null
  authLoading: boolean   // true until first onAuthStateChange fires — never redirect while true
  log: Entry[]
  boxes: Box[]
  locations: Location[]
  trips: Trip[]
  syncStatus: SyncStatus
  settings: CernitaSettings
}

const initialState: AppState = {
  session: null,
  user: null,
  authLoading: true,
  log: [],
  boxes: [],
  locations: [],
  trips: [],
  syncStatus: 'offline',
  settings: DEFAULT_SETTINGS,
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_SESSION'; session: Session | null; user: User | null; authLoading: boolean }
  | { type: 'SET_LOG'; entries: Entry[] }
  | { type: 'UPSERT_ENTRY'; entry: Entry }
  | { type: 'DELETE_ENTRY'; id: number }
  | { type: 'SET_BOXES'; boxes: Box[] }
  | { type: 'UPSERT_BOX'; box: Box }
  | { type: 'DELETE_BOX'; id: number }
  | { type: 'SET_LOCATIONS'; locations: Location[] }
  | { type: 'UPSERT_LOCATION'; location: Location }
  | { type: 'DELETE_LOCATION'; id: number }
  | { type: 'SET_TRIPS'; trips: Trip[] }
  | { type: 'UPSERT_TRIP'; trip: Trip }
  | { type: 'DELETE_TRIP'; id: number }
  | { type: 'SET_SYNC'; status: SyncStatus }
  | { type: 'SET_SETTINGS'; settings: CernitaSettings }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, session: action.session, user: action.user, authLoading: action.authLoading }
    case 'SET_LOG':
      return { ...state, log: action.entries }
    case 'UPSERT_ENTRY': {
      const exists = state.log.some(e => e.id === action.entry.id)
      return {
        ...state,
        log: exists
          ? state.log.map(e => e.id === action.entry.id ? action.entry : e)
          : [action.entry, ...state.log],
      }
    }
    case 'DELETE_ENTRY':
      return { ...state, log: state.log.filter(e => e.id !== action.id) }
    case 'SET_BOXES':
      return { ...state, boxes: action.boxes }
    case 'UPSERT_BOX': {
      const exists = state.boxes.some(b => b.id === action.box.id)
      return {
        ...state,
        boxes: exists
          ? state.boxes.map(b => b.id === action.box.id ? action.box : b)
          : [...state.boxes, action.box],
      }
    }
    case 'DELETE_BOX':
      return { ...state, boxes: state.boxes.filter(b => b.id !== action.id) }
    case 'SET_LOCATIONS':
      return { ...state, locations: action.locations }
    case 'UPSERT_LOCATION': {
      const exists = state.locations.some(l => l.id === action.location.id)
      return {
        ...state,
        locations: exists
          ? state.locations.map(l => l.id === action.location.id ? action.location : l)
          : [...state.locations, action.location].sort((a, b) => a.sort_order - b.sort_order),
      }
    }
    case 'DELETE_LOCATION':
      return { ...state, locations: state.locations.filter(l => l.id !== action.id) }
    case 'SET_TRIPS':
      return { ...state, trips: action.trips }
    case 'UPSERT_TRIP': {
      const exists = state.trips.some(t => t.id === action.trip.id)
      return {
        ...state,
        trips: exists
          ? state.trips.map(t => t.id === action.trip.id ? action.trip : t)
          : [...state.trips, action.trip],
      }
    }
    case 'DELETE_TRIP':
      return { ...state, trips: state.trips.filter(t => t.id !== action.id) }
    case 'SET_SYNC':
      return { ...state, syncStatus: action.status }
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings }
    default:
      return state
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

// ─── Provider ────────────────────────────────────────────────────────────────

function loadSettings(): CernitaSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem('cernita_settings')
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_SETTINGS
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    settings: loadSettings(),
  })

  // Auth state listener
  useEffect(() => {
    let didFire = false

    // Safety timeout: if onAuthStateChange never fires (Supabase unreachable,
    // project paused, network down), stop blocking the UI after 5 seconds.
    const timeout = setTimeout(() => {
      if (!didFire) {
        console.warn('Supabase auth did not respond within 5s — unblocking UI')
        dispatch({ type: 'SET_SESSION', session: null, user: null, authLoading: false })
      }
    }, 5000)

    let subscription: { unsubscribe: () => void } | null = null

    try {
      const result = supabase.auth.onAuthStateChange(
        async (event, session) => {
          didFire = true
          clearTimeout(timeout)
          // authLoading: false on the very first fire — we now know whether there's a session
          dispatch({ type: 'SET_SESSION', session, user: session?.user ?? null, authLoading: false })
          if (session) {
            await loadAll(dispatch)
            setupRealtime(dispatch)
          }
        }
      )
      subscription = result.data.subscription
    } catch (err) {
      console.error('Failed to set up Supabase auth listener:', err)
      clearTimeout(timeout)
      dispatch({ type: 'SET_SESSION', session: null, user: null, authLoading: false })
    }

    return () => {
      clearTimeout(timeout)
      subscription?.unsubscribe()
    }
  }, [])

  // Persist settings changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cernita_settings', JSON.stringify(state.settings))
    }
  }, [state.settings])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadAll(dispatch: React.Dispatch<Action>) {
  dispatch({ type: 'SET_SYNC', status: 'syncing' })

  try {
    const [entriesRes, boxesRes, locationsRes, tripsRes] = await Promise.all([
      supabase.from('cernita_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('cernita_boxes').select('*').order('created_at'),
      supabase.from('cernita_locations').select('*').order('sort_order'),
      supabase.from('cernita_trips').select('*').order('departure_date', { ascending: true }),
    ])

    if (!entriesRes.error && entriesRes.data)
      dispatch({ type: 'SET_LOG', entries: entriesRes.data as Entry[] })
    if (!boxesRes.error && boxesRes.data)
      dispatch({ type: 'SET_BOXES', boxes: boxesRes.data as Box[] })
    if (!locationsRes.error && locationsRes.data)
      dispatch({ type: 'SET_LOCATIONS', locations: locationsRes.data as Location[] })
    if (!tripsRes.error && tripsRes.data)
      dispatch({ type: 'SET_TRIPS', trips: tripsRes.data as Trip[] })
  } catch (err) {
    console.error('Failed to load data from Supabase:', err)
  }

  // Always mark as online so the UI never gets stuck in a loading state
  dispatch({ type: 'SET_SYNC', status: 'online' })
}

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

function setupRealtime(dispatch: React.Dispatch<Action>) {
  if (realtimeChannel) realtimeChannel.unsubscribe()

  realtimeChannel = supabase
    .channel('cernita-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cernita_entries' }, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        dispatch({ type: 'UPSERT_ENTRY', entry: payload.new as Entry })
      } else if (payload.eventType === 'DELETE') {
        dispatch({ type: 'DELETE_ENTRY', id: (payload.old as { id: number }).id })
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cernita_boxes' }, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        dispatch({ type: 'UPSERT_BOX', box: payload.new as Box })
      } else if (payload.eventType === 'DELETE') {
        dispatch({ type: 'DELETE_BOX', id: (payload.old as { id: number }).id })
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cernita_locations' }, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        dispatch({ type: 'UPSERT_LOCATION', location: payload.new as Location })
      } else if (payload.eventType === 'DELETE') {
        dispatch({ type: 'DELETE_LOCATION', id: (payload.old as { id: number }).id })
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cernita_trips' }, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        dispatch({ type: 'UPSERT_TRIP', trip: payload.new as Trip })
      } else if (payload.eventType === 'DELETE') {
        dispatch({ type: 'DELETE_TRIP', id: (payload.old as { id: number }).id })
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') dispatch({ type: 'SET_SYNC', status: 'online' })
      else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        dispatch({ type: 'SET_SYNC', status: 'offline' })
      }
    })
}
