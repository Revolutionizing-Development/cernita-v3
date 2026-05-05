/**
 * Haptic feedback utilities — wraps navigator.vibrate().
 * Silently ignored on desktop and iOS (which don't support the Vibration API).
 * Pattern arrays: [vibrate_ms, pause_ms, vibrate_ms, ...]
 */
const haptic = {
  /** Short single tap — item saved, decision confirmed */
  confirm: () => navigator.vibrate?.([30]),

  /** Soft double-tap — AI decision accepted with override */
  override: () => navigator.vibrate?.([20, 60, 20]),

  /** Three-tap celebration — box sealed, trip executed */
  celebrate: () => navigator.vibrate?.([30, 40, 30, 40, 60]),

  /** Long firm press — item deleted, trip canceled */
  destroy: () => navigator.vibrate?.([80]),

  /** Short error pulse — API failure, validation error */
  error: () => navigator.vibrate?.([10, 30, 60]),
}

export default haptic
