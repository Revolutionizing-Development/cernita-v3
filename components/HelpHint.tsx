import { useState, useEffect, useCallback } from 'react'

// ─── Help hint IDs ──────────────────────────────────────────────────────────

export type HelpHintId =
  | 'first-override'
  | 'first-discuss'
  | 'first-rule-suggestion'

const HINT_STORAGE_PREFIX = 'cernita_hint_dismissed_'

// ─── Contextual Help Hint ──────────────────────────────────────────────────
// A floating callout that appears once per feature on first encounter.
// Dismissed with a tap and tracked in localStorage.

export function HelpHint({
  id,
  children,
  position = 'below',
}: {
  id: HelpHintId
  children: React.ReactNode
  position?: 'below' | 'above'
}) {
  const [dismissed, setDismissed] = useState(true) // default hidden

  useEffect(() => {
    const key = HINT_STORAGE_PREFIX + id
    const wasDismissed = localStorage.getItem(key) === 'true'
    setDismissed(wasDismissed)
  }, [id])

  const dismiss = useCallback(() => {
    const key = HINT_STORAGE_PREFIX + id
    localStorage.setItem(key, 'true')
    setDismissed(true)
  }, [id])

  if (dismissed) return null

  return (
    <div className={`help-hint help-hint-${position}`}>
      <div className="help-hint-content">
        {children}
      </div>
      <button className="help-hint-dismiss" onClick={dismiss}>
        Got it
      </button>
    </div>
  )
}

// ─── Contextual Info Button ────────────────────────────────────────────────
// Small info icon that links to a help section.
// Used next to complex UI elements per AC33.

export function InfoButton({
  section,
  onClick,
}: {
  section: string
  onClick?: () => void
}) {
  return (
    <button
      className="info-button"
      onClick={onClick}
      aria-label={`Help: ${section}`}
      title={section}
      type="button"
    >
      &#x2139;
    </button>
  )
}

// ─── Reset all hints ───────────────────────────────────────────────────────

export function resetAllHints() {
  const hintIds: HelpHintId[] = ['first-override', 'first-discuss', 'first-rule-suggestion']
  for (const id of hintIds) {
    localStorage.removeItem(HINT_STORAGE_PREFIX + id)
  }
}
