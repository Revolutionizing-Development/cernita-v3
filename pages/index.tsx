import Head from 'next/head'
import { useState, useRef, useEffect, useCallback } from 'react'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import SyncIndicator from '../components/SyncIndicator'
import { useApp } from '../lib/context'
import { supabase } from '../lib/supabase'
import { Box, Decision, DECISION_LABELS, DECISION_BADGE_CLASS, SUITCASE_CLASS_LABELS, getDecisionLabel } from '../lib/types'

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
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_DECISIONS: Decision[] = [
  'KEEP-ITALY', 'KEEP-US', 'SELL', 'DONATE', 'DISPOSE', 'GIVE-FAMILY', 'NEEDS-HUMAN',
]

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
  const { state, dispatch } = useApp()
  const { settings, user, boxes } = state

  const [phase, setPhase] = useState<EvalPhase>('camera')
  const [description, setDescription] = useState('')
  const [cameraBlocked, setCameraBlocked] = useState(false)
  const [aiResult, setAiResult] = useState<AiResult | null>(null)
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  // Override overlay state
  const [overrideDecision, setOverrideDecision] = useState<Decision>('NEEDS-HUMAN')
  const [overrideReason, setOverrideReason] = useState('')
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  // Post-save box prompt state
  const [savedEntryId, setSavedEntryId] = useState<number | null>(null)
  const [savedItemName, setSavedItemName] = useState('')
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
      } catch {
        // proceed without photo
      }
      stopCamera()
    }

    if (!photoBase64 && !description.trim()) {
      setErrorMsg('Describe the item to continue · Descrivi l\'oggetto per continuare.')
      return
    }

    setPhase('thinking')
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoBase64,
          description: description.trim() || null,
          settings,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(`API_${res.status}:${body?.error ?? ''}`)
      }
      const data = await res.json()

      // Sanitize: guard against unexpected decision values
      if (!VALID_DECISIONS.includes(data.final_decision)) {
        console.warn('Unexpected final_decision from AI:', data.final_decision)
        data.final_decision = 'NEEDS-HUMAN'
        data.confidence = 'low'
      }
      if (!data.confidence) data.confidence = 'medium'

      setAiResult(data as AiResult)
      setOverrideDecision(data.final_decision)
      setPhase('result')
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return // user cancelled
      console.error('Evaluate error:', err)

      let msg = 'AI unavailable — please try again · Riprovare.'
      if (err instanceof Error) {
        if (err.message.startsWith('API_401')) {
          msg = 'Session expired — please sign out and back in.'
        } else if (err.message.startsWith('API_5')) {
          msg = `Server error — check Vercel logs. (${err.message})`
        }
      }

      setPhase('error')
      setErrorMsg(msg)
      setTimeout(() => {
        setErrorMsg('')
        setPhase(cameraBlocked ? 'text' : 'camera')
      }, 5000)
    }
  }

  function handleCancel() {
    abortRef.current?.abort()
    setCapturedBase64(null)
    setPhase(cameraBlocked ? 'text' : 'camera')
  }

  // ─── Save action ───────────────────────────────────────────────────────────

  async function saveEntry(decision: Decision, reason?: string) {
    if (!aiResult) return
    setPhase('saving')

    const userName =
      user?.user_metadata?.display_name ??
      user?.email?.split('@')[0] ??
      'unknown'

    const entry = {
      user_name: userName,
      item_name: aiResult.item_name,
      item_name_it: aiResult.item_name_it,
      final_decision: decision,
      user_confirmed: true,
      override_reason: reason ?? null,
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
    }

    const { data, error } = await supabase
      .from('cernita_entries')
      .insert(entry)
      .select()
      .single()

    if (error) {
      console.error('Save error:', error)
      setPhase('result')
      setErrorMsg('Failed to save — please try again · Salvataggio fallito.')
      return
    }

    // Optimistic local update (Realtime will also fire)
    if (data) dispatch({ type: 'UPSERT_ENTRY', entry: data })

    const savedName = aiResult.item_name
    const savedNameIt = aiResult.item_name_it

    // Reset evaluate state
    setAiResult(null)
    setCapturedBase64(null)
    setDescription('')
    setOverrideReason('')
    setErrorMsg('')

    // Store saved entry for box prompt
    setSavedEntryId(data.id)
    setSavedItemName(savedName)
    setPackBoxId('')

    const toast = savedNameIt
      ? `${savedName} · ${savedNameIt} — Saved · Salvato`
      : `${savedName} — Saved · Salvato`
    setToastMsg(toast)
    setPhase('saved')

    // Auto-reset only if no open boxes to assign to
    const openBoxes = boxes.filter((b: Box) => !b.closed_at)
    if (openBoxes.length === 0) {
      setTimeout(() => resetToCamera(), 2800)
    }
  }

  // ─── Reset to camera ──────────────────────────────────────────────────────

  function resetToCamera() {
    setSavedEntryId(null)
    setSavedItemName('')
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
          <ResultCard
            result={aiResult}
            saving={phase === 'saving'}
            errorMsg={errorMsg}
            usDestination={settings.usDestination}
            onConfirm={() => saveEntry(aiResult.final_decision)}
            onOverride={() => {
              setOverrideDecision(aiResult.final_decision)
              setPhase('override')
            }}
          />
        )}

        {/* ── Override overlay (State D) ── */}
        {phase === 'override' && (
          <OverrideOverlay
            current={overrideDecision}
            reason={overrideReason}
            usDestination={settings.usDestination}
            onChange={setOverrideDecision}
            onReasonChange={setOverrideReason}
            onCancel={() => setPhase('result')}
            onSave={() => saveEntry(overrideDecision, overrideReason || undefined)}
          />
        )}

        {/* ── Saved + box prompt (State E) ── */}
        {phase === 'saved' && (
          <div className="page-content">
            <div className="saved-card">
              <div className="saved-ornament">✓</div>
              <h3 className="saved-name serif">{savedItemName}</h3>
              <p className="saved-subtitle italic ink-soft">Salvato con successo</p>

              {boxes.filter((b: Box) => !b.closed_at).length > 0 ? (
                <div className="saved-box-prompt">
                  <p className="box-assign-label">Pack into a box? · Inscatola?</p>
                  <select
                    className="input"
                    value={packBoxId}
                    onChange={e => setPackBoxId(e.target.value ? Number(e.target.value) : '')}
                    style={{ marginBottom: 12 }}
                  >
                    <option value="">— No box, skip —</option>
                    {boxes.filter((b: Box) => !b.closed_at).map((b: Box) => {
                      const isSuitcase = b.box_type === 'suitcase'
                      const lbl = getDecisionLabel(b.destination, settings.usDestination)
                      const classLbl = isSuitcase && b.suitcase_class
                        ? SUITCASE_CLASS_LABELS[b.suitcase_class as keyof typeof SUITCASE_CLASS_LABELS]?.en
                        : null
                      return (
                        <option key={b.id} value={b.id}>
                          {isSuitcase ? '🧳 ' : ''}{b.box_number} · {classLbl ?? lbl.en.split('—').pop()?.trim()}
                        </option>
                      )
                    })}
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
              ) : (
                <p className="ink-soft" style={{ fontSize: 13, marginTop: 8 }}>
                  Returning to camera… · Torno alla fotocamera…
                </p>
              )}
            </div>
          </div>
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
  onConfirm,
  onOverride,
}: {
  result: AiResult
  saving: boolean
  errorMsg: string
  usDestination: string
  onConfirm: () => void
  onOverride: () => void
}) {
  const label = getDecisionLabel(result.final_decision as Decision, usDestination)
  const badgeClass = DECISION_BADGE_CLASS[result.final_decision as Decision] ?? 'badge'
  const showPreservation = result.fragility && result.fragility !== 'none'
  const confidence = result.confidence ?? 'medium'

  return (
    <div className="result-shell">
      <div className="result-card">

        {/* Decision */}
        <div className="result-decision-row">
          <span className={`${badgeClass} result-badge`}>{label.en}</span>
          {label.it && <em className="result-decision-it serif">{label.it}</em>}
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

        {/* Economics table */}
        <EconomicsTable result={result} />

        {/* Confidence */}
        <div className="confidence-row">
          <span className={`confidence-pill confidence-${confidence}`}>{confidence}</span>
          <span className="ink-soft" style={{ fontSize: 12 }}>confidence · fiducia</span>
        </div>

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
          {result.ship_cost != null && (
            <tr>
              <td>Ship cost</td>
              <td className="num">{fmt(result.ship_cost)}</td>
            </tr>
          )}
          {result.storage_cost_total != null && (
            <tr>
              <td>Storage cost</td>
              <td className="num">{fmt(result.storage_cost_total)}</td>
            </tr>
          )}
          {result.net_cost_ship != null && (
            <tr className="net-row">
              <td><strong>Net if shipped</strong></td>
              <td className="num"><strong>{fmtNet(result.net_cost_ship)}</strong></td>
            </tr>
          )}
          {result.net_cost_storage != null && (
            <tr className="net-row">
              <td><strong>Net if stored</strong></td>
              <td className="num"><strong>{fmtNet(result.net_cost_storage)}</strong></td>
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
  reason,
  usDestination,
  onChange,
  onReasonChange,
  onCancel,
  onSave,
}: {
  current: Decision
  reason: string
  usDestination: string
  onChange: (d: Decision) => void
  onReasonChange: (r: string) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="override-sheet">
        <h3 className="serif override-title">Change decision · Cambia decisione</h3>

        <label className="input-label">Decision · Decisione</label>
        <select
          className="input"
          value={current}
          onChange={e => onChange(e.target.value as Decision)}
          style={{ marginBottom: 16 }}
        >
          {VALID_DECISIONS.map(d => {
            const lbl = getDecisionLabel(d, usDestination)
            return (
              <option key={d} value={d}>{lbl.en} · {lbl.it}</option>
            )
          })}
        </select>

        <label className="input-label">Reason (optional) · Motivo</label>
        <textarea
          className="input"
          style={{ minHeight: 80, resize: 'vertical', marginBottom: 20 }}
          value={reason}
          onChange={e => onReasonChange(e.target.value)}
          placeholder="Why are you overriding? · Perché stai cambiando?"
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
