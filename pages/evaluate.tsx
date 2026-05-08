import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useRef, useEffect, useCallback } from 'react'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import SyncIndicator from '../components/SyncIndicator'
import { useApp } from '../lib/context'
import { supabase } from '../lib/supabase'
import haptic from '../lib/haptic'
import { Box, Decision, ActionPhase, DecisionRule, DECISION_LABELS, DECISION_BADGE_CLASS, SUITCASE_CLASS_LABELS, getDecisionLabel, ACTION_PHASE_LABELS, OVERRIDE_TAGS, OverrideTagId } from '../lib/types'
import { computePerspectives, shouldAutoNeedsHuman, perspectiveConfidence, DualPerspective } from '../lib/perspectives'
import { findMatchingRule, ruleDisagreesWithAi, formatRuleSummary } from '../lib/rules'
import ChatSheet from '../components/ChatSheet'
import { Entry } from '../lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type EvalPhase =
  | 'camera'    // State A — live preview
  | 'text'      // State F — text-only fallback
  | 'thinking'  // State B — API in flight
  | 'result'    // State C — result card
  | 'override'  // State D — override overlay
  | 'saving'    // transitional
  | 'saved'     // State E — toast shown
  | 'error'     // State G — API error

interface AiResult {
  item_name: string
  item_name_it: string | null
  item_model: string | null
  final_decision: Decision
  estimated_resale_value: number | null
  replacement_cost: number | null
  weight_lb: number | null
  volume_cuft: number | null
  storage_cost_total: number | null
  ship_cost: number | null
  net_cost_ship: number | null
  net_cost_storage: number | null
  recommendation_rationale: string | null
  recommendation_rationale_it: string | null
  confidence: 'high' | 'medium' | 'low' | null
  fragility: 'none' | 'low' | 'medium' | 'high' | 'irreplaceable' | null
  survival_risk: string | null
  survival_risk_it: string | null
  packing_notes: string | null
  packing_notes_it: string | null
  shipping_restriction: 'none' | 'restricted' | 'prohibited' | null
  shipping_restriction_note: string | null
  shipping_restriction_note_it: string | null
  oversized: boolean | null
  voltage_incompatible: boolean | null
  action_phase: ActionPhase | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_DECISIONS: Decision[] = [
  'SHIP-ITALY', 'SELL', 'DONATE', 'DISPOSE', 'GIVE-FAMILY', 'CONSUME', 'NEEDS-HUMAN',
]

// Decisions that support action_phase
const PHASED_DECISIONS: Decision[] = ['SELL', 'DONATE', 'CONSUME']

// Items with these decisions are never packed into a shipping box
const NON_PACKABLE: Decision[] = ['SELL', 'DONATE', 'DISPOSE', 'CONSUME']

// Returns open boxes whose destination matches the item's decision
function getCompatibleBoxes(boxes: Box[], decision: Decision): Box[] {
  const open = boxes.filter((b: Box) => !b.closed_at)
  if (decision === 'GIVE-FAMILY') return open.filter((b: Box) => b.box_type === 'suitcase')
  if (decision === 'NEEDS-HUMAN') return open
  return open.filter((b: Box) => b.destination === decision)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return `$${Math.abs(n).toFixed(0)}`
}

function fmtNet(n: number | null | undefined): string {
  if (n == null) return '—'
  const sign = n < 0 ? '−' : '+'
  return `${sign}$${Math.abs(n).toFixed(0)}`
}

// Compress a video frame to JPEG base64 under maxBytes
async function captureFrame(video: HTMLVideoElement, maxBytes = 200_000): Promise<string> {
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 960 / video.videoWidth)
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  let quality = 0.82
  let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length * 0.75 > maxBytes && quality > 0.3) {
    quality -= 0.1
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }
  return dataUrl.split(',')[1] // strip the data:image/jpeg;base64, prefix
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function EvaluatePage() {
  const router = useRouter()
  const { state, dispatch } = useApp()
  const { settings, user, boxes } = state

  const [phase, setPhase] = useState<EvalPhase>('camera')
  const [description, setDescription] = useState('')
  const [cameraBlocked, setCameraBlocked] = useState(false)
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  // Multi-item state
  const [aiResults, setAiResults] = useState<AiResult[]>([])
  const [currentItemIndex, setCurrentItemIndex] = useState(0)
  const [savedCount, setSavedCount] = useState(0)
  const aiResult = aiResults[currentItemIndex] ?? null
  const isMultiItem = aiResults.length > 1

  // Override overlay state
  const [overrideDecision, setOverrideDecision] = useState<Decision>('NEEDS-HUMAN')
  const [overridePhase, setOverridePhase] = useState<ActionPhase | null>(null)
  const [overrideTags, setOverrideTags] = useState<OverrideTagId[]>([])
  const [overrideReason, setOverrideReason] = useState('')
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  // Chat dialog state (spec 018)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatEntry, setChatEntry] = useState<Entry | null>(null)

  // Post-save box prompt state (single-item only)
  const [savedEntryId, setSavedEntryId] = useState<number | null>(null)
  const [savedItemName, setSavedItemName] = useState('')
  const [savedEntryDecision, setSavedEntryDecision] = useState<Decision | null>(null)
  const [savedEntryOversized, setSavedEntryOversized] = useState(false)
  const [packBoxId, setPackBoxId] = useState<number | ''>('')
  const [packing, setPacking] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ─── Camera management ─────────────────────────────────────────────────────

  const startCamera = useCallback(async (facing: 'environment' | 'user' = 'environment') => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraBlocked(true)
      setPhase('text')
      return
    }
    try {
      // Try exact facing mode first (hard requirement — no silent fallback to selfie)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      try {
        // Device may not support exact constraint — try as a preference
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        setCameraBlocked(true)
        setPhase('text')
      }
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  async function handleFlipCamera() {
    stopCamera()
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    await startCamera(next)
  }

  // Start camera when phase becomes 'camera'
  useEffect(() => {
    if (phase === 'camera') startCamera(facingMode)
    // Don't auto-stop: stopCamera is called explicitly on evaluate/navigate
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      abortRef.current?.abort()
    }
  }, [stopCamera])

  // ─── Evaluate action ───────────────────────────────────────────────────────

  async function handleEvaluate() {
    setErrorMsg('')
    let photoBase64: string | null = null

    // Capture frame from camera
    if (phase === 'camera' && videoRef.current && streamRef.current) {
      try {
        photoBase64 = await captureFrame(videoRef.current)
        setCapturedBase64(photoBase64)
      } catch (e) {
        console.warn('[eval] captureFrame failed:', e)
        // proceed without photo
      }
      stopCamera()
    }

    if (!photoBase64 && !description.trim()) {
      setErrorMsg('Describe the item to continue · Descrivi l\'oggetto per continuare.')
      return
    }

    // Get access token BEFORE entering thinking phase — if auth hangs,
    // the user stays on camera view (not stuck in thinking overlay)
    let accessToken: string | undefined
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      accessToken = currentSession?.access_token ?? undefined
    } catch (e) {
      console.warn('[eval] getSession failed, proceeding without token:', e)
    }

    setPhase('thinking')
    abortRef.current = new AbortController()

    // Auto-timeout: if the fetch hangs beyond 90 seconds, abort and recover.
    // Vercel hobby has a 10s limit; Pro has 60s. 90s covers both + network overhead.
    const timeoutId = setTimeout(() => {
      console.warn('[eval] fetch timeout after 90s — aborting')
      abortRef.current?.abort()
    }, 90_000)

    try {
      console.log('[eval] starting fetch to /api/anthropic')
      const res = await fetch('/api/anthropic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          photoBase64,
          description: description.trim() || null,
          settings,
        }),
        signal: abortRef.current.signal,
      })

      clearTimeout(timeoutId)
      console.log('[eval] fetch completed, status:', res.status)

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(`API_${res.status}:${body?.error ?? ''}`)
      }
      const data = await res.json()
      const items: AiResult[] = (data.items ?? [data]).map((item: AiResult) => {
        // Migration: handle legacy decision values from AI
        if ((item.final_decision as string) === 'KEEP-ITALY') {
          item.final_decision = 'SHIP-ITALY'
        } else if ((item.final_decision as string) === 'KEEP-US') {
          item.final_decision = 'SELL'
          item.action_phase = 'COLORADO'
        }
        // Sanitize: guard against unexpected decision values
        if (!VALID_DECISIONS.includes(item.final_decision)) {
          console.warn('[eval] Unexpected final_decision from AI:', item.final_decision)
          item.final_decision = 'NEEDS-HUMAN'
          item.confidence = 'low'
        }
        if (!item.confidence) item.confidence = 'medium'
        // Default phase for phased decisions
        if (PHASED_DECISIONS.includes(item.final_decision) && !item.action_phase) {
          item.action_phase = 'NOW'
        }
        // Dual perspective: auto-NEEDS-HUMAN when perspectives disagree
        const dual = computePerspectives(item.net_cost_ship, item.replacement_cost, settings)
        if (shouldAutoNeedsHuman(dual) && item.final_decision !== 'NEEDS-HUMAN' && item.final_decision !== 'DISPOSE') {
          item.final_decision = 'NEEDS-HUMAN'
          item.confidence = perspectiveConfidence(item.confidence, dual)
        } else {
          // Apply perspective-based confidence adjustment
          item.confidence = perspectiveConfidence(item.confidence, dual)
        }
        return item
      })

      if (items.length === 0) {
        throw new Error('AI returned no items')
      }

      console.log('[eval] parsed', items.length, 'item(s)')
      setAiResults(items)
      setCurrentItemIndex(0)
      setSavedCount(0)
      setOverrideDecision(items[0].final_decision)
      setOverridePhase(items[0].action_phase ?? null)
      setPhase('result')
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled OR 90s timeout fired
        console.log('[eval] aborted (user cancel or timeout)')
        // If still in thinking phase, recover to camera
        setPhase(cameraBlocked ? 'text' : 'camera')
        return
      }
      console.error('[eval] error:', err)

      let msg = 'AI unavailable — please try again · Riprovare.'
      if (err instanceof Error) {
        if (err.message.startsWith('API_401')) {
          msg = 'Session expired — please sign out and back in.'
        } else if (err.message.startsWith('API_5')) {
          msg = `Server error — check Vercel logs. (${err.message})`
        } else if (err.message.includes('fetch')) {
          msg = 'Network error — check your connection · Controlla la connessione.'
        }
      }

      haptic.error()
      setPhase('error')
      setErrorMsg(msg)
      setTimeout(() => {
        setErrorMsg('')
        setPhase(cameraBlocked ? 'text' : 'camera')
      }, 5000)
    }
  }

  function handleCancel() {
    console.log('[eval] handleCancel — returning to camera')
    abortRef.current?.abort()
    setCapturedBase64(null)
    setAiResults([])
    setCurrentItemIndex(0)
    setSavedCount(0)
    setPhase(cameraBlocked ? 'text' : 'camera')
  }

  // ─── Save action ───────────────────────────────────────────────────────────

  async function saveEntry(decision: Decision, reason?: string, phase?: ActionPhase | null, tags?: OverrideTagId[]) {
    if (!aiResult) return
    console.log('[eval] saveEntry:', aiResult.item_name, '→', decision)
    setPhase('saving')

    // Determine action_phase: use explicit phase, or AI's suggestion for phased decisions
    const actionPhase = phase !== undefined ? phase
      : PHASED_DECISIONS.includes(decision) ? (aiResult.action_phase ?? 'NOW')
      : null

    const userName =
      user?.user_metadata?.display_name ??
      user?.email?.split('@')[0] ??
      'unknown'

    const entry = {
      user_name: userName,
      item_name: aiResult.item_name,
      item_name_it: aiResult.item_name_it,
      item_model: aiResult.item_model ?? null,
      final_decision: decision,
      action_phase: actionPhase,
      italy_confirmed: false,
      user_confirmed: true,
      override_reason: reason ?? null,
      override_tags: tags && tags.length > 0 ? tags : null,
      estimated_resale_value: aiResult.estimated_resale_value,
      replacement_cost: aiResult.replacement_cost,
      weight_lb: aiResult.weight_lb,
      volume_cuft: aiResult.volume_cuft,
      storage_cost_total: aiResult.storage_cost_total,
      ship_cost: aiResult.ship_cost,
      carry_bag_cost: null,
      net_cost_ship: aiResult.net_cost_ship,
      net_cost_storage: aiResult.net_cost_storage,
      recommendation_rationale: aiResult.recommendation_rationale,
      recommendation_rationale_it: aiResult.recommendation_rationale_it,
      confidence: aiResult.confidence ?? 'medium',
      rules_version: settings.rulesVersion,
      rules_snapshot: settings as unknown as Record<string, unknown>,
      fragility: aiResult.fragility,
      survival_risk: aiResult.survival_risk,
      survival_risk_it: aiResult.survival_risk_it,
      packing_notes: aiResult.packing_notes,
      packing_notes_it: aiResult.packing_notes_it,
      photo_data: capturedBase64,
      bin_id: null,
      box_id: null,
      current_location_id: null,
      shipping_restriction: aiResult.shipping_restriction ?? null,
      shipping_restriction_note: aiResult.shipping_restriction_note ?? null,
      shipping_restriction_note_it: aiResult.shipping_restriction_note_it ?? null,
      oversized: aiResult.oversized ?? false,
      voltage_incompatible: aiResult.voltage_incompatible ?? false,
    }

    const { data, error } = await supabase
      .from('cernita_entries')
      .insert(entry)
      .select()
      .single()

    if (error) {
      console.error('[eval] save error:', error.message, error.details, error.code)
      setPhase('result')
      setErrorMsg('Failed to save — please try again · Salvataggio fallito.')
      return
    }

    console.log('[eval] saved entry id:', data?.id)
    // Optimistic local update (Realtime will also fire)
    if (data) {
      dispatch({ type: 'UPSERT_ENTRY', entry: data })
      // Store for chat dialog (spec 018)
      setChatEntry(data as Entry)
    }

    haptic.confirm()
    const newSavedCount = savedCount + 1
    setSavedCount(newSavedCount)

    // ── Multi-item: advance to next item ──
    if (isMultiItem && currentItemIndex < aiResults.length - 1) {
      const nextIdx = currentItemIndex + 1
      const nextItem = aiResults[nextIdx]
      setCurrentItemIndex(nextIdx)
      setOverrideDecision(nextItem.final_decision)
      setOverridePhase(nextItem.action_phase ?? null)
      setOverrideTags([])
      setOverrideReason('')
      setErrorMsg('')
      setToastMsg(`✓ ${aiResult.item_name} saved · ${nextIdx + 1} of ${aiResults.length}`)
      setPhase('result')
      // Clear toast after a moment
      setTimeout(() => setToastMsg(''), 2200)
      return
    }

    // ── Single item or last item in batch ──
    const savedName = aiResult.item_name
    const savedNameIt = aiResult.item_name_it

    // Reset evaluate state
    setCapturedBase64(null)
    setDescription('')
    setOverrideReason('')
    setErrorMsg('')

    if (isMultiItem) {
      // Multi-item complete: show summary, reset after toast
      setToastMsg(`${newSavedCount} items saved · ${newSavedCount} oggetti salvati`)
      setSavedItemName(`${newSavedCount} items`)
      setSavedEntryDecision(null)
      setSavedEntryOversized(false)
      setSavedEntryId(null)
      setPackBoxId('')
      setPhase('saved')
      setTimeout(() => resetToCamera(), 3000)
      return
    }

    // Single-item flow (unchanged)
    setSavedEntryId(data.id)
    setSavedItemName(savedName)
    setSavedEntryDecision(decision)
    setSavedEntryOversized(aiResult.oversized ?? false)
    setPackBoxId('')

    const toast = savedNameIt
      ? `${savedName} · ${savedNameIt} — Saved · Salvato`
      : `${savedName} — Saved · Salvato`
    setToastMsg(toast)
    setPhase('saved')

    // Auto-reset conditions:
    // — SELL/DONATE/DISPOSE: never packed, return to camera after toast
    // — Oversized: show note with explicit Continue button (no auto-reset)
    // — Packable: auto-reset only if no compatible boxes exist
    const isNonPackable = NON_PACKABLE.includes(decision)
    if (isNonPackable) {
      setTimeout(() => resetToCamera(), 2800)
    } else if (!(aiResult.oversized ?? false)) {
      const compatible = getCompatibleBoxes(boxes as Box[], decision)
      if (compatible.length === 0) {
        setTimeout(() => resetToCamera(), 2800)
      }
    }
  }

  // ─── Reset to camera ──────────────────────────────────────────────────────

  function resetToCamera() {
    console.log('[eval] resetToCamera')
    setAiResults([])
    setCurrentItemIndex(0)
    setSavedCount(0)
    setSavedEntryId(null)
    setSavedItemName('')
    setSavedEntryDecision(null)
    setSavedEntryOversized(false)
    setPackBoxId('')
    setPacking(false)
    setToastMsg('')
    setPhase(cameraBlocked ? 'text' : 'camera')
  }

  // ─── Pack into box ─────────────────────────────────────────────────────────

  async function handlePackEntry() {
    if (!savedEntryId || !packBoxId) { resetToCamera(); return }
    setPacking(true)
    const { data, error } = await supabase
      .from('cernita_entries')
      .update({ box_id: packBoxId as number })
      .eq('id', savedEntryId)
      .select()
      .single()
    if (!error && data) dispatch({ type: 'UPSERT_ENTRY', entry: data })
    setPacking(false)
    resetToCamera()
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <AuthGuard>
      <Head><title>Cernita — Evaluate</title></Head>
      <div className="app-shell">

        <header className="eval-header">
          <span className="serif" style={{ fontSize: '20px', letterSpacing: '0.04em' }}>Cernita</span>
          <SyncIndicator />
        </header>

        {/* ── Toast ── */}
        {toastMsg && <div className="toast">{toastMsg}</div>}

        {/* ── Error banner (phase === error) ── */}
        {phase === 'error' && (
          <div className="eval-error-banner">{errorMsg}</div>
        )}

        {/* ── Camera view (State A) ── */}
        {(phase === 'camera' || phase === 'thinking') && !cameraBlocked && (
          <div className="camera-section">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-preview"
              style={{ opacity: phase === 'thinking' ? 0.25 : 1 }}
            />
            {phase === 'camera' && (
              <button
                className="camera-flip-btn"
                onClick={handleFlipCamera}
                aria-label="Flip camera"
                title="Flip camera"
              >
                ⟳
              </button>
            )}
            {phase === 'thinking' && (
              <div className="thinking-overlay">
                <ThinkingContent onCancel={handleCancel} />
              </div>
            )}
          </div>
        )}

        {/* ── Camera controls (State A) ── */}
        {phase === 'camera' && !cameraBlocked && (
          <div className="eval-controls">
            <textarea
              className="input eval-description-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add a description (optional) · Descrizione opzionale…"
              rows={2}
            />
            {errorMsg && <p className="eval-error-text">{errorMsg}</p>}
            <button className="btn-primary eval-shoot-btn" onClick={handleEvaluate}>
              ◎ &nbsp;Evaluate · Valuta
            </button>
            <button
              className="btn-link"
              onClick={() => { stopCamera(); setPhase('text') }}
            >
              Describe instead · Solo testo
            </button>
          </div>
        )}

        {/* ── Text fallback (State F) ── */}
        {(phase === 'text' || (phase === 'thinking' && cameraBlocked)) && (
          <div className="page-content" style={{ paddingBottom: 16 }}>
            {phase === 'thinking' ? (
              <div className="thinking-inline">
                <ThinkingContent onCancel={handleCancel} />
              </div>
            ) : (
              <>
                <p className="eval-text-heading serif">
                  Descrivi l&apos;oggetto
                  <br />
                  <em style={{ fontSize: '0.78em', color: 'var(--ink-soft)' }}>Describe the item</em>
                </p>
                <textarea
                  className="input"
                  style={{ minHeight: 140, resize: 'vertical', marginTop: 14 }}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Cast iron 12-inch skillet, Lodge brand, good condition…"
                  autoFocus
                />
                {errorMsg && <p className="eval-error-text">{errorMsg}</p>}
                <button
                  className="btn-primary"
                  style={{ marginTop: 14 }}
                  onClick={handleEvaluate}
                  disabled={!description.trim()}
                >
                  Evaluate · Valuta
                </button>
                {!cameraBlocked && (
                  <button
                    className="btn-link"
                    style={{ marginTop: 10 }}
                    onClick={() => setPhase('camera')}
                  >
                    Use camera instead · Usa fotocamera
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Result card (States C, saving) ── */}
        {(phase === 'result' || phase === 'override' || phase === 'saving') && aiResult && (
          <>
            {isMultiItem && (
              <div className="multi-item-stepper">
                <span className="multi-item-counter">
                  Item {currentItemIndex + 1} of {aiResults.length}
                </span>
                <span className="multi-item-dots">
                  {aiResults.map((_, i) => (
                    <span
                      key={i}
                      className={`multi-item-dot${i < currentItemIndex ? ' done' : ''}${i === currentItemIndex ? ' current' : ''}`}
                    />
                  ))}
                </span>
              </div>
            )}
            {(() => {
              const matchedRule = findMatchingRule(aiResult, settings.decisionRules ?? [])
              const ruleConflict = matchedRule && ruleDisagreesWithAi(matchedRule, aiResult.final_decision, aiResult.action_phase ?? null)
              return (
                <ResultCard
                  result={aiResult}
                  saving={phase === 'saving'}
                  errorMsg={errorMsg}
                  usDestination={settings.usDestination}
                  settings={settings}
                  matchedRule={ruleConflict ? matchedRule : null}
                  onConfirm={() => saveEntry(aiResult.final_decision, undefined, aiResult.action_phase)}
                  onAcceptRule={ruleConflict ? () => saveEntry(matchedRule.defaultDecision, `Rule: ${matchedRule.name}`, matchedRule.defaultPhase) : undefined}
                  onOverride={() => {
                    setOverrideDecision(aiResult.final_decision)
                    setOverridePhase(aiResult.action_phase ?? null)
                    setOverrideTags([])
                    setPhase('override')
                  }}
                  onCancel={handleCancel}
                />
              )
            })()}
          </>
        )}

        {/* ── Override overlay (State D) ── */}
        {phase === 'override' && (
          <OverrideOverlay
            current={overrideDecision}
            currentPhase={overridePhase}
            tags={overrideTags}
            reason={overrideReason}
            usDestination={settings.usDestination}
            onChange={(d) => {
              setOverrideDecision(d)
              if (PHASED_DECISIONS.includes(d) && !overridePhase) {
                setOverridePhase('NOW')
              } else if (!PHASED_DECISIONS.includes(d)) {
                setOverridePhase(null)
              }
            }}
            onPhaseChange={setOverridePhase}
            onTagsChange={setOverrideTags}
            onReasonChange={setOverrideReason}
            onCancel={() => setPhase('result')}
            onSave={() => saveEntry(overrideDecision, overrideReason || undefined, overridePhase, overrideTags)}
          />
        )}

        {/* ── Saved + box prompt (State E) ── */}
        {phase === 'saved' && (
          <div className="page-content">
            <div className="saved-card">
              <div className="saved-ornament">✓</div>
              <h3 className="saved-name serif">{savedItemName}</h3>
              <p className="saved-subtitle italic ink-soft">
                {isMultiItem || savedCount > 1
                  ? `${savedCount} oggetti salvati con successo`
                  : 'Salvato con successo'}
              </p>

              {/* Multi-item batch complete — auto-resets via setTimeout */}
              {savedCount > 1 && !savedEntryDecision ? (
                <p className="ink-soft" style={{ fontSize: 13, marginTop: 8 }}>
                  Returning to camera… · Torno alla fotocamera…
                </p>

              ) : /* NEEDS-HUMAN → route to Discuss */
              savedEntryDecision === 'NEEDS-HUMAN' ? (
                <div style={{ marginTop: 16 }}>
                  <p className="ink-soft" style={{ fontSize: 13, marginBottom: 12 }}>
                    This item needs a joint decision. · Questo oggetto richiede una decisione condivisa.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1 }}
                      onClick={resetToCamera}
                    >
                      Continue · Continua
                    </button>
                    <button
                      className="btn-primary"
                      style={{ flex: 2 }}
                      onClick={() => router.push('/discuss')}
                    >
                      Go to Discuss · Vai a Discutere
                    </button>
                  </div>
                </div>
              ) : savedEntryOversized ? (
                <div className="oversized-note" style={{ marginTop: 16 }}>
                  <p className="oversized-note-text">
                    ◱ Oversized — ships separately · <em>Oggetto di grandi dimensioni, spedizione separata</em>
                  </p>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 12, width: '100%' }}
                    onClick={resetToCamera}
                  >
                    Continue · Continua
                  </button>
                </div>
              ) : savedEntryDecision && !NON_PACKABLE.includes(savedEntryDecision) && (() => {
                const compatibleBoxes = getCompatibleBoxes(boxes as Box[], savedEntryDecision)
                if (compatibleBoxes.length === 0) return (
                  <p className="ink-soft" style={{ fontSize: 13, marginTop: 8 }}>
                    Returning to camera… · Torno alla fotocamera…
                  </p>
                )
                const plasticBoxes = compatibleBoxes.filter((b: Box) => b.box_type !== 'suitcase')
                const suitcases    = compatibleBoxes.filter((b: Box) => b.box_type === 'suitcase')
                return (
                  <div className="saved-box-prompt">
                    <p className="box-assign-label">Pack into a box? · Inscatola?</p>
                    <select
                      className="input"
                      value={packBoxId}
                      onChange={e => setPackBoxId(e.target.value ? Number(e.target.value) : '')}
                      style={{ marginBottom: 12 }}
                    >
                      <option value="">— No box, skip —</option>
                      {plasticBoxes.map((b: Box) => {
                        const lbl = getDecisionLabel(b.destination, settings.usDestination)
                        return (
                          <option key={b.id} value={b.id}>
                            {b.box_number} · {lbl.en.split('—').pop()?.trim()}
                          </option>
                        )
                      })}
                      {suitcases.length > 0 && (
                        <optgroup label="🧳 Suitcases">
                          {suitcases.map((b: Box) => {
                            const classLbl = b.suitcase_class
                              ? SUITCASE_CLASS_LABELS[b.suitcase_class as keyof typeof SUITCASE_CLASS_LABELS]?.en
                              : 'Suitcase'
                            return (
                              <option key={b.id} value={b.id}>
                                🧳 {b.box_number} · {classLbl}
                              </option>
                            )
                          })}
                        </optgroup>
                      )}
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn-secondary"
                        style={{ flex: 1 }}
                        onClick={resetToCamera}
                        disabled={packing}
                      >
                        Skip · Salta
                      </button>
                      <button
                        className="btn-primary"
                        style={{ flex: 2 }}
                        onClick={handlePackEntry}
                        disabled={!packBoxId || packing}
                      >
                        {packing ? 'Packing…' : 'Pack it · Inscatola'}
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* Discuss with AI button (AC-1) — single item only */}
              {savedEntryId && chatEntry && (
                <button
                  className="btn-link"
                  style={{ marginTop: 14, width: '100%', textAlign: 'center' }}
                  onClick={() => setChatOpen(true)}
                >
                  Discuss with AI · Discuti con AI
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chat sheet (spec 018) */}
        {chatOpen && chatEntry && (
          <ChatSheet
            entry={chatEntry}
            settings={settings as unknown as Record<string, unknown>}
            onClose={() => setChatOpen(false)}
            onEntryUpdated={(updated) => {
              dispatch({ type: 'UPSERT_ENTRY', entry: updated })
              setChatEntry(updated)
            }}
          />
        )}

        <Nav />
      </div>
    </AuthGuard>
  )
}

// ─── ThinkingContent ──────────────────────────────────────────────────────────

function ThinkingContent({ onCancel }: { onCancel: () => void }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => (n + 1) % 4), 480)
    return () => clearInterval(t)
  }, [])
  const dots = '.'.repeat(tick)

  return (
    <div className="thinking-content">
      <div className="thinking-ornament" aria-hidden>✦</div>
      <p className="thinking-label serif">
        Valutando{dots}
        <br />
        <span className="thinking-sublabel">Evaluating{dots}</span>
      </p>
      <button className="btn-link thinking-cancel" onClick={onCancel}>
        Cancel · Annulla
      </button>
    </div>
  )
}

// ─── ResultCard ───────────────────────────────────────────────────────────────

function ResultCard({
  result,
  saving,
  errorMsg,
  usDestination,
  settings,
  matchedRule,
  onConfirm,
  onAcceptRule,
  onOverride,
  onCancel,
}: {
  result: AiResult
  saving: boolean
  errorMsg: string
  usDestination: string
  settings: import('../lib/types').CernitaSettings
  matchedRule: DecisionRule | null
  onConfirm: () => void
  onAcceptRule?: () => void
  onOverride: () => void
  onCancel: () => void
}) {
  const label = getDecisionLabel(result.final_decision as Decision, usDestination, result.action_phase)
  const badgeClass = DECISION_BADGE_CLASS[result.final_decision as Decision] ?? 'badge'
  const showPreservation = result.fragility && result.fragility !== 'none'
  const confidence = result.confidence ?? 'medium'
  const dual = computePerspectives(result.net_cost_ship, result.replacement_cost, settings)
  const restriction = result.shipping_restriction

  // Rule conflict display
  const ruleLabel = matchedRule
    ? getDecisionLabel(matchedRule.defaultDecision, usDestination, matchedRule.defaultPhase)
    : null
  const ruleBadgeClass = matchedRule
    ? DECISION_BADGE_CLASS[matchedRule.defaultDecision] ?? 'badge'
    : ''

  return (
    <div className="result-shell">
      <div className="result-card">

        {/* Rule conflict banner — shown above everything when a rule disagrees with AI */}
        {matchedRule && ruleLabel && (
          <div className="rule-conflict-banner">
            <div className="rule-conflict-header">
              <span className="rule-conflict-icon">⚖</span>
              <span className="rule-conflict-title">Rule conflict · Conflitto regola</span>
            </div>
            <div className="rule-conflict-body">
              <p className="rule-conflict-text">
                Your rule <strong>"{matchedRule.name}"</strong> says{' '}
                <span className={`${ruleBadgeClass} badge-inline`}>{ruleLabel.en}</span>
              </p>
              <p className="rule-conflict-text">
                AI suggested{' '}
                <span className={`${badgeClass} badge-inline`}>{label.en}</span>
              </p>
              <p className="rule-conflict-summary ink-soft">
                {formatRuleSummary(matchedRule)}
              </p>
            </div>
            {onAcceptRule && (
              <button
                className="btn-primary rule-accept-btn"
                onClick={onAcceptRule}
                disabled={saving}
              >
                Accept rule → {ruleLabel.en} · Accetta regola
              </button>
            )}
          </div>
        )}

        {/* Shipping restriction banner — shown prominently above everything else */}
        {restriction && restriction !== 'none' && (
          <div className={`hazmat-banner hazmat-${restriction}`}>
            <span className="hazmat-icon">{restriction === 'prohibited' ? '🚫' : '⚠️'}</span>
            <div className="hazmat-body">
              <p className="hazmat-title">
                {restriction === 'prohibited'
                  ? 'Cannot ship internationally · Non spedibile'
                  : 'Shipping restricted · Restrizioni di spedizione'}
              </p>
              {result.shipping_restriction_note && (
                <p className="hazmat-note">{result.shipping_restriction_note}</p>
              )}
            </div>
          </div>
        )}

        {/* Voltage incompatibility banner */}
        {result.voltage_incompatible && (
          <div className="voltage-banner">
            <span className="voltage-icon">⚡</span>
            <div className="voltage-body">
              <p className="voltage-title">110V — incompatible with Italy · Non compatibile con l&apos;Italia</p>
              <p className="voltage-note">
                Italy uses 220V/50Hz. This item needs a step-down transformer or replacement.
              </p>
            </div>
          </div>
        )}

        {/* Decision */}
        <div className="result-decision-row">
          <span className={`${badgeClass} result-badge`}>{label.en}</span>
          {label.it && <em className="result-decision-it serif">{label.it}</em>}
          {matchedRule && <span className="rule-source-label ink-soft">AI recommendation</span>}
        </div>

        {/* Item name */}
        <h2 className="result-item-name serif">
          {result.item_name.length > 60
            ? result.item_name.slice(0, 60) + '…'
            : result.item_name}
          {result.item_name_it && (
            <em className="result-item-name-it"> · {result.item_name_it}</em>
          )}
        </h2>
        {result.item_model && (
          <p className="item-model-label">{result.item_model}</p>
        )}

        {/* Economics table */}
        <EconomicsTable result={result} />

        {/* Confidence */}
        <div className="confidence-row">
          <span className={`confidence-pill confidence-${confidence}`}>{confidence}</span>
          <span className="ink-soft" style={{ fontSize: 12 }}>confidence · fiducia</span>
        </div>

        {/* Dual perspectives */}
        {dual.hasData && (
          <div className="perspectives-section">
            <p className="perspectives-label">Perspectives · Prospettive</p>
            <div className="perspectives-grid">
              <div className={`perspective-card perspective-${dual.ship.decision.toLowerCase()}`}>
                <p className="perspective-lens">{dual.ship.label.en}</p>
                <p className="perspective-lens-it">{dual.ship.label.it}</p>
                <span className={`perspective-verdict perspective-verdict-${dual.ship.decision.toLowerCase()}`}>
                  {dual.ship.decision === 'SHIP-ITALY' ? '📦 Ship' : dual.ship.decision === 'SELL' ? '💰 Sell' : '⚖ Neutral'}
                </span>
                <p className="perspective-reason">{dual.ship.reason.en}</p>
                <p className="perspective-reason-it">{dual.ship.reason.it}</p>
              </div>
              <div className={`perspective-card perspective-${dual.save.decision.toLowerCase()}`}>
                <p className="perspective-lens">{dual.save.label.en}</p>
                <p className="perspective-lens-it">{dual.save.label.it}</p>
                <span className={`perspective-verdict perspective-verdict-${dual.save.decision.toLowerCase()}`}>
                  {dual.save.decision === 'SHIP-ITALY' ? '📦 Ship' : dual.save.decision === 'SELL' ? '💰 Sell' : '⚖ Neutral'}
                </span>
                <p className="perspective-reason">{dual.save.reason.en}</p>
                <p className="perspective-reason-it">{dual.save.reason.it}</p>
              </div>
            </div>
            <div className={`perspectives-agreement ${dual.agree ? 'agree' : 'disagree'}`}>
              <span className="agreement-icon">{dual.agree ? '✓' : '⚡'}</span>
              <span className="agreement-text">
                {dual.agree
                  ? 'Both perspectives agree · Entrambe le prospettive concordano'
                  : 'Perspectives disagree — needs discussion · Le prospettive sono discordi — richiede discussione'}
              </span>
            </div>
          </div>
        )}

        {/* Rationale */}
        {result.recommendation_rationale && (
          <div className="rationale-section">
            <p>{result.recommendation_rationale}</p>
            {result.recommendation_rationale_it && (
              <p className="italic" style={{ color: 'var(--ink-soft)', marginTop: 8 }}>
                {result.recommendation_rationale_it}
              </p>
            )}
          </div>
        )}

        {/* Preservation block */}
        {showPreservation && (
          <div className="preservation-block">
            <p className="preservation-label">
              Fragility · Fragilità:{' '}
              <span className={`fragility-badge fragility-${result.fragility}`}>
                {result.fragility}
              </span>
            </p>
            {result.survival_risk && (
              <p className="preservation-text">
                ⚠ {result.survival_risk}
                {result.survival_risk_it && (
                  <em className="italic" style={{ display: 'block', color: 'var(--ink-soft)', marginTop: 3 }}>
                    {result.survival_risk_it}
                  </em>
                )}
              </p>
            )}
            {result.packing_notes && (
              <p className="preservation-text" style={{ marginTop: 8 }}>
                📦 {result.packing_notes}
                {result.packing_notes_it && (
                  <em className="italic" style={{ display: 'block', color: 'var(--ink-soft)', marginTop: 3 }}>
                    {result.packing_notes_it}
                  </em>
                )}
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {errorMsg && <p className="eval-error-text" style={{ marginTop: 12 }}>{errorMsg}</p>}

        {/* Actions */}
        <div className="result-actions">
          <button
            className="btn-primary"
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? 'Saving… · Salvataggio…' : 'Confirm · Conferma'}
          </button>
          <button
            className="btn-secondary"
            onClick={onOverride}
            disabled={saving}
            style={{ marginTop: 10, width: '100%' }}
          >
            Override decision · Cambia decisione
          </button>
          <button
            className="btn-link"
            onClick={onCancel}
            disabled={saving}
            style={{ marginTop: 8, width: '100%' }}
          >
            ← Back to camera · Torna alla fotocamera
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── EconomicsTable ───────────────────────────────────────────────────────────

function EconomicsTable({ result }: { result: AiResult }) {
  const hasAnyEcon =
    result.estimated_resale_value != null ||
    result.replacement_cost != null ||
    result.ship_cost != null ||
    result.storage_cost_total != null ||
    result.net_cost_ship != null ||
    result.net_cost_storage != null ||
    result.weight_lb != null

  if (!hasAnyEcon) return null

  // net_cost_storage is now "savings vs replacement" — positive = shipping saves money
  const savings = result.net_cost_storage
  const savingsLabel = savings != null && savings >= 0
    ? 'Ship saves'
    : 'Replace saves'
  const savingsClass = savings != null && savings >= 0 ? 'savings-positive' : 'savings-negative'

  return (
    <div className="economics-section">
      <p className="economics-label">Economics · Costi</p>
      <table className="economics-table">
        <tbody>
          {result.estimated_resale_value != null && (
            <tr>
              <td>Resale value <Em>est.</Em></td>
              <td className="num">{fmt(result.estimated_resale_value)}</td>
            </tr>
          )}
          {result.replacement_cost != null && (
            <tr>
              <td>Replace in Italy <Em>est.</Em></td>
              <td className="num">{fmt(result.replacement_cost)}</td>
            </tr>
          )}
          {result.storage_cost_total != null && (
            <tr>
              <td>Move to CO <Em>truck</Em></td>
              <td className="num">{fmt(result.storage_cost_total)}</td>
            </tr>
          )}
          {result.ship_cost != null && (
            <tr>
              <td>Ocean ship <Em>CO→Italy</Em></td>
              <td className="num">{fmt(result.ship_cost)}</td>
            </tr>
          )}
          {result.net_cost_ship != null && (
            <tr className="net-row">
              <td><strong>Total to Italy</strong></td>
              <td className="num"><strong>{fmt(result.net_cost_ship)}</strong></td>
            </tr>
          )}
          {savings != null && result.replacement_cost != null && (
            <tr className={`net-row ${savingsClass}`}>
              <td><strong>{savingsLabel}</strong></td>
              <td className="num"><strong>{fmt(Math.abs(savings))}</strong></td>
            </tr>
          )}
          {result.weight_lb != null && (
            <tr>
              <td>Weight <Em>est.</Em></td>
              <td className="num">{result.weight_lb} lb</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Em({ children }: { children: React.ReactNode }) {
  return <em style={{ fontSize: 10, color: 'var(--ink-soft)', fontStyle: 'italic' }}>{children}</em>
}

// ─── OverrideOverlay ──────────────────────────────────────────────────────────

function OverrideOverlay({
  current,
  currentPhase,
  tags,
  reason,
  usDestination,
  onChange,
  onPhaseChange,
  onTagsChange,
  onReasonChange,
  onCancel,
  onSave,
}: {
  current: Decision
  currentPhase: ActionPhase | null
  tags: OverrideTagId[]
  reason: string
  usDestination: string
  onChange: (d: Decision) => void
  onPhaseChange: (p: ActionPhase | null) => void
  onTagsChange: (tags: OverrideTagId[]) => void
  onReasonChange: (r: string) => void
  onCancel: () => void
  onSave: () => void
}) {
  const showPhase = PHASED_DECISIONS.includes(current)

  function toggleTag(tagId: OverrideTagId) {
    if (tags.includes(tagId)) {
      onTagsChange(tags.filter(t => t !== tagId))
    } else {
      onTagsChange([...tags, tagId])
    }
  }

  return (
    <div className="overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="override-sheet">
        <h3 className="serif override-title">Change decision · Cambia decisione</h3>

        <label className="input-label">Decision · Decisione</label>
        <select
          className="input"
          value={current}
          onChange={e => onChange(e.target.value as Decision)}
          style={{ marginBottom: showPhase ? 8 : 16 }}
        >
          {VALID_DECISIONS.map(d => {
            const lbl = getDecisionLabel(d, usDestination)
            return (
              <option key={d} value={d}>{lbl.en} · {lbl.it}</option>
            )
          })}
        </select>

        {showPhase && (
          <>
            <label className="input-label" style={{ marginTop: 8 }}>When · Quando</label>
            <div className="phase-picker" style={{ marginBottom: 16 }}>
              <button
                className={`phase-pill${currentPhase === 'NOW' ? ' active' : ''}`}
                onClick={() => onPhaseChange('NOW')}
                type="button"
              >
                Now · Ora
              </button>
              <button
                className={`phase-pill${currentPhase === 'COLORADO' ? ' active' : ''}`}
                onClick={() => onPhaseChange('COLORADO')}
                type="button"
              >
                Colorado
              </button>
            </div>
          </>
        )}

        {/* Override tags */}
        <label className="input-label">Why? (select all that apply) · Perché? (seleziona tutto)</label>
        <div className="override-tags-picker">
          {OVERRIDE_TAGS.map(tag => (
            <button
              key={tag.id}
              type="button"
              className={`override-tag-pill${tags.includes(tag.id) ? ' active' : ''}`}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.en} · {tag.it}
            </button>
          ))}
        </div>

        <label className="input-label" style={{ marginTop: 14 }}>Additional notes (optional) · Note aggiuntive</label>
        <textarea
          className="input"
          style={{ minHeight: 60, resize: 'vertical', marginBottom: 20 }}
          value={reason}
          onChange={e => onReasonChange(e.target.value)}
          placeholder="Any extra context… · Contesto aggiuntivo…"
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
            Cancel · Annulla
          </button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={onSave}>
            Save · Salva
          </button>
        </div>
      </div>
    </div>
  )
}
