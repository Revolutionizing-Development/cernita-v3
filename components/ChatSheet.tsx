import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import haptic from '../lib/haptic'
import {
  Entry, Decision, ActionPhase, ChatMessage, ChatMessageMetadata,
  DECISION_BADGE_CLASS, getDecisionLabel,
} from '../lib/types'

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_MESSAGES = 20  // AC-10: 10 user + 10 AI

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatSheetProps {
  entry: Entry
  settings: Record<string, unknown>
  onClose: () => void
  onEntryUpdated?: (entry: Entry) => void
}

interface LocalMessage {
  id: string | number
  role: 'user' | 'assistant'
  content: string
  metadata?: ChatMessageMetadata
  streaming?: boolean
}

// ─── ChatSheet ──────────────────────────────────────────────────────────────

export default function ChatSheet({ entry, settings, onClose, onEntryUpdated }: ChatSheetProps) {
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [rateLimited, setRateLimited] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [pendingRecommendation, setPendingRecommendation] = useState<ChatMessageMetadata['updated_recommendation'] | null>(null)
  const [acceptingRec, setAcceptingRec] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const usDestination = (settings as { usDestination?: string }).usDestination ?? 'Colorado Springs'

  // entry.id === 0 means pre-save chat (from result card, not yet in DB)
  const isSaved = entry.id !== 0

  // ── Load existing messages on mount (AC-6) — only for saved entries ────
  useEffect(() => {
    if (!isSaved) {
      setLoadingHistory(false)
      return
    }
    async function loadMessages() {
      const { data, error: err } = await supabase
        .from('cernita_chat_messages')
        .select('*')
        .eq('entry_id', entry.id)
        .order('created_at', { ascending: true })

      if (!err && data) {
        setMessages(data.map((m: ChatMessage) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          metadata: m.metadata as ChatMessageMetadata,
        })))
      }
      setLoadingHistory(false)
    }
    loadMessages()
  }, [entry.id, isSaved])

  // ── Realtime subscription for other user's messages (AC-6) ─────────────
  useEffect(() => {
    if (!isSaved) return  // No DB persistence for pre-save chats
    const channel = supabase
      .channel(`chat-${entry.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'cernita_chat_messages',
        filter: `entry_id=eq.${entry.id}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage
        setMessages(prev => {
          // Skip if we already have this message (from our own insert)
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            metadata: msg.metadata as ChatMessageMetadata,
          }]
        })
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [entry.id, isSaved])

  // ── Auto-scroll to bottom ─────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  // ── Rate-limit timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (!rateLimited) return
    const timer = setTimeout(() => setRateLimited(false), 30_000)
    return () => clearTimeout(timer)
  }, [rateLimited])

  // ── Count check (AC-10) ───────────────────────────────────────────────
  const messageCount = messages.filter(m => !m.streaming).length
  const atLimit = messageCount >= MAX_MESSAGES

  // ── Send message ──────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending || atLimit || rateLimited) return

    setInput('')
    setError('')
    setSending(true)

    // Add user message locally
    const tempUserId = `temp-user-${Date.now()}`
    const userMsg: LocalMessage = { id: tempUserId, role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])

    // Get access token + persist user message to Supabase (saved entries only)
    let accessToken: string | undefined
    try {
      const { data: { session } } = await supabase.auth.getSession()
      accessToken = session?.access_token ?? undefined

      if (isSaved) {
        const { data: savedMsg } = await supabase
          .from('cernita_chat_messages')
          .insert({
            entry_id: entry.id,
            role: 'user',
            content: text,
            created_by: session?.user?.id ?? null,
          })
          .select()
          .single()

        if (savedMsg) {
          setMessages(prev => prev.map(m =>
            m.id === tempUserId ? { ...m, id: savedMsg.id } : m
          ))
        }
      }
    } catch (e) {
      console.warn('[chat] Failed to save user message:', e)
    }

    // Add streaming placeholder for AI response
    const tempAiId = `temp-ai-${Date.now()}`
    setMessages(prev => [...prev, {
      id: tempAiId,
      role: 'assistant',
      content: '',
      streaming: true,
    }])

    // Build conversation history for API
    const conversationHistory = messages
      .filter(m => !m.streaming)
      .map(m => ({ role: m.role, content: m.content }))

    // Call the streaming API (AC-4)
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/anthropic-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          entry,
          message: text,
          conversation_history: conversationHistory,
          settings,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }

      // Read SSE stream with a line buffer to handle chunks split across reads
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let fullText = ''
      let finalMetadata: ChatMessageMetadata = {}
      let lineBuffer = ''  // accumulates partial lines across chunks
      let receivedDone = false

      // Process a single SSE line (shared by main loop + buffer flush)
      const processSSELine = async (line: string) => {
        if (!line.startsWith('data: ')) return
        const data = JSON.parse(line.slice(6))

        if (data.type === 'text') {
          fullText += data.text
          setMessages(prev => prev.map(m =>
            m.id === tempAiId ? { ...m, content: fullText } : m
          ))
        } else if (data.type === 'recommendation') {
          finalMetadata = {
            updated_recommendation: {
              decision: data.decision as Decision,
              action_phase: data.action_phase as ActionPhase | null,
              rationale: data.rationale,
              rationale_it: data.rationale_it,
            },
          }
          setPendingRecommendation(finalMetadata.updated_recommendation ?? null)
        } else if (data.type === 'error') {
          if (data.error === 'rate_limited') {
            setRateLimited(true)
            setError('AI is busy — try again in a moment. · L\'AI è occupata.')
          } else {
            const friendly = typeof data.error === 'string' && data.error.startsWith('Chat failed:')
              ? 'Chat error — try again. · Errore chat — riprova.'
              : data.error
            setError(friendly)
          }
        } else if (data.type === 'done') {
          receivedDone = true
          // Stream complete — strip the recommendation block from displayed text
          const cleanText = fullText
            .replace(/\[UPDATED_RECOMMENDATION\][\s\S]*?\[\/UPDATED_RECOMMENDATION\]/, '')
            .trim()

          setMessages(prev => prev.map(m =>
            m.id === tempAiId
              ? { ...m, content: cleanText, streaming: false, metadata: finalMetadata }
              : m
          ))

          // Save AI message to Supabase (saved entries only)
          if (isSaved) {
            try {
              const { data: savedAiMsg } = await supabase
                .from('cernita_chat_messages')
                .insert({
                  entry_id: entry.id,
                  role: 'assistant',
                  content: cleanText,
                  metadata: finalMetadata,
                  created_by: null,
                })
                .select()
                .single()

              if (savedAiMsg) {
                setMessages(prev => prev.map(m =>
                  m.id === tempAiId ? { ...m, id: savedAiMsg.id } : m
                ))
              }
            } catch (e) {
              console.warn('[chat] Failed to save AI message:', e)
            }
          }
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        lineBuffer += decoder.decode(value, { stream: true })
        const parts = lineBuffer.split('\n')
        // Last element may be incomplete — keep it in the buffer
        lineBuffer = parts.pop() ?? ''

        for (const line of parts) {
          try { await processSSELine(line) } catch { /* skip malformed */ }
        }
      }

      // Flush TextDecoder and process any remaining data in the buffer.
      // This catches the 'done' event if it arrived without a trailing newline.
      lineBuffer += decoder.decode()  // flush decoder
      if (lineBuffer.trim()) {
        for (const line of lineBuffer.split('\n')) {
          try { await processSSELine(line) } catch { /* skip malformed */ }
        }
      }

      // Failsafe: if the stream ended without a 'done' event (network
      // glitch, Vercel timeout, etc.), finalize the message with whatever
      // text we received so it doesn't stay stuck in streaming mode.
      if (!receivedDone && fullText) {
        console.warn('[chat] Stream ended without done event — finalizing with received text')
        const cleanText = fullText
          .replace(/\[UPDATED_RECOMMENDATION\][\s\S]*?\[\/UPDATED_RECOMMENDATION\]/, '')
          .trim()
        setMessages(prev => prev.map(m =>
          m.id === tempAiId
            ? { ...m, content: cleanText, streaming: false, metadata: finalMetadata }
            : m
        ))
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User closed chat during stream
        setMessages(prev => prev.filter(m => m.id !== tempAiId))
      } else {
        console.error('[chat] stream error:', err)
        setError('Failed to get response — try again. · Riprovare.')
        setMessages(prev => prev.filter(m => m.id !== tempAiId))
      }
    } finally {
      setSending(false)
    }
  }, [input, sending, atLimit, rateLimited, messages, entry, settings])

  // ── Accept updated recommendation (AC-5) ──────────────────────────────
  async function handleAcceptRecommendation() {
    if (!pendingRecommendation) return
    setAcceptingRec(true)

    if (!isSaved) {
      // Pre-save: update the entry locally without touching the database.
      // The parent component (evaluate.tsx) will use these values when the
      // user confirms and saves the item.
      const updatedEntry: Entry = {
        ...entry,
        final_decision: pendingRecommendation.decision,
        action_phase: pendingRecommendation.action_phase ?? null,
        override_reason: `Updated via chat: ${pendingRecommendation.rationale ?? ''}`,
        recommendation_rationale: pendingRecommendation.rationale ?? entry.recommendation_rationale,
        recommendation_rationale_it: pendingRecommendation.rationale_it ?? entry.recommendation_rationale_it,
        user_confirmed: true,
      }
      setAcceptingRec(false)
      haptic.confirm()
      setPendingRecommendation(null)
      if (onEntryUpdated) onEntryUpdated(updatedEntry)
      return
    }

    // Saved entry: update in the database
    const { data, error: err } = await supabase
      .from('cernita_entries')
      .update({
        final_decision: pendingRecommendation.decision,
        action_phase: pendingRecommendation.action_phase ?? null,
        override_reason: `Updated via chat: ${pendingRecommendation.rationale ?? ''}`,
        recommendation_rationale: pendingRecommendation.rationale ?? entry.recommendation_rationale,
        recommendation_rationale_it: pendingRecommendation.rationale_it ?? entry.recommendation_rationale_it,
        user_confirmed: true,
      })
      .eq('id', entry.id)
      .select()
      .single()

    setAcceptingRec(false)

    if (err || !data) {
      setError('Failed to update decision — try again.')
      return
    }

    haptic.confirm()
    setPendingRecommendation(null)
    if (onEntryUpdated) onEntryUpdated(data as Entry)
  }

  function handleDismissRecommendation() {
    setPendingRecommendation(null)
  }

  // ── Handle Enter key ──────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Decision label helper ─────────────────────────────────────────────
  const currentLabel = getDecisionLabel(entry.final_decision as Decision, usDestination, entry.action_phase)
  const currentBadgeClass = DECISION_BADGE_CLASS[entry.final_decision as Decision] ?? 'badge'

  return (
    <div className="overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="chat-sheet">

        {/* Header (AC-9) */}
        <div className="chat-header">
          <div className="chat-header-left">
            {entry.photo_data ? (
              <img
                src={`data:image/jpeg;base64,${entry.photo_data}`}
                alt=""
                className="chat-header-photo"
              />
            ) : (
              <div className="chat-header-photo-empty">◻</div>
            )}
            <div className="chat-header-info">
              <p className="chat-header-name serif">{entry.item_name}</p>
              <span className={`${currentBadgeClass} chat-header-badge`}>{currentLabel.en}</span>
            </div>
          </div>
          <button className="chat-close" onClick={onClose} aria-label="Close chat">✕</button>
        </div>

        {/* Messages (AC-8) */}
        <div className="chat-messages">
          {loadingHistory ? (
            <div className="chat-loading">Loading conversation… · Caricamento…</div>
          ) : messages.length === 0 ? (
            <div className="chat-empty">
              <p className="chat-empty-text">
                Ask about this item, challenge the recommendation, or provide additional context.
              </p>
              <p className="chat-empty-text-it italic ink-soft">
                Chiedi informazioni, contesta la raccomandazione o fornisci contesto aggiuntivo.
              </p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`chat-bubble chat-bubble-${msg.role}${msg.streaming ? ' streaming' : ''}`}
              >
                <div className="chat-bubble-content">
                  {msg.content || (msg.streaming ? '' : '…')}
                  {msg.streaming && <span className="chat-typing-cursor" />}
                </div>
              </div>
            ))
          )}

          {/* Streaming indicator */}
          {sending && messages[messages.length - 1]?.streaming && (
            <div className="chat-thinking">
              <span className="chat-thinking-ornament">✦</span>
              <span className="chat-thinking-text">Thinking… · Pensando…</span>
            </div>
          )}

          {/* Updated recommendation card (AC-5) */}
          {pendingRecommendation && (
            <div className="chat-recommendation-card">
              <p className="chat-rec-label">Updated recommendation · Raccomandazione aggiornata</p>
              <div className="chat-rec-decision">
                <span className={`${DECISION_BADGE_CLASS[pendingRecommendation.decision] ?? 'badge'} chat-rec-badge`}>
                  {getDecisionLabel(pendingRecommendation.decision, usDestination, pendingRecommendation.action_phase).en}
                </span>
              </div>
              {pendingRecommendation.rationale && (
                <p className="chat-rec-rationale">{pendingRecommendation.rationale}</p>
              )}
              {pendingRecommendation.rationale_it && (
                <p className="chat-rec-rationale italic ink-soft">{pendingRecommendation.rationale_it}</p>
              )}
              <div className="chat-rec-actions">
                <button
                  className="btn-secondary"
                  onClick={handleDismissRecommendation}
                  disabled={acceptingRec}
                >
                  Dismiss · Ignora
                </button>
                <button
                  className="btn-primary"
                  onClick={handleAcceptRecommendation}
                  disabled={acceptingRec}
                >
                  {acceptingRec ? 'Updating…' : 'Accept · Accetta'}
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="chat-error">
            <p>{error}</p>
            <button className="chat-error-dismiss" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* Limit reached (AC-10) */}
        {atLimit && (
          <div className="chat-limit">
            <p>Conversation limit reached (20 messages). Start a new evaluation to continue.</p>
            <p className="italic ink-soft">Limite raggiunto. Inizia una nuova valutazione per continuare.</p>
          </div>
        )}

        {/* Input area (AC-8) */}
        {!atLimit && (
          <div className="chat-input-area">
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this item… · Chiedi…"
              rows={1}
              disabled={sending || rateLimited}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || sending || rateLimited}
              aria-label="Send message"
            >
              ↑
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
