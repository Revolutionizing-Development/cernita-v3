import { useApp } from '../lib/context'

export default function SyncIndicator() {
  const { state } = useApp()
  const label = { online: 'Online', syncing: 'Syncing…', offline: 'Offline' }[state.syncStatus]
  return (
    <span title={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span className={`sync-dot ${state.syncStatus}`} />
      <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{label}</span>
    </span>
  )
}
