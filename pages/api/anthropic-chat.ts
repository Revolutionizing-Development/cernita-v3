import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Maximum messages per conversation (AC-10)
const MAX_MESSAGES = 20

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = await requireAuth(req, res)
  if (!user) return

  const { entry, message, conversation_history, settings } = req.body

  if (!entry || !message?.trim()) {
    return res.status(400).json({ error: 'Missing entry or message' })
  }

  // Check conversation limit (AC-10)
  const history = conversation_history ?? []
  if (history.length >= MAX_MESSAGES) {
    return res.status(400).json({ error: 'Conversation limit reached (20 messages)' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set')
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  const usDestination = settings?.usDestination || 'Colorado Springs'

  // Build the system prompt with full evaluation context (AC-3)
  const systemPrompt = buildSystemPrompt(entry, usDestination, settings)

  // Build conversation messages
  const messages: Anthropic.MessageParam[] = []

  // Include the item photo as the first message if available
  if (entry.photo_data) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: entry.photo_data },
        },
        { type: 'text', text: `This is the item: ${entry.item_name}. The AI evaluation is provided in the system instructions. I want to discuss this item.` },
      ],
    })
    messages.push({
      role: 'assistant',
      content: `I can see the ${entry.item_name}. I have the full evaluation context including the current recommendation (${entry.final_decision}), costs, and rationale. What would you like to discuss about this item?`,
    })
  }

  // Add conversation history
  for (const msg of history) {
    messages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })
  }

  // Add the new user message
  messages.push({ role: 'user', content: message.trim() })

  // Set up SSE streaming (AC-4)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    const stream = await anthropic.messages.stream({
      model: settings?.aiModel || 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    let fullText = ''

    stream.on('text', (text) => {
      fullText += text
      res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`)
    })

    stream.on('end', () => {
      // Check if the response contains an updated recommendation (AC-5)
      const recommendation = parseUpdatedRecommendation(fullText)
      if (recommendation) {
        res.write(`data: ${JSON.stringify({ type: 'recommendation', ...recommendation })}\n\n`)
      }
      res.write(`data: ${JSON.stringify({ type: 'done', full_text: fullText })}\n\n`)
      res.end()
    })

    stream.on('error', (error) => {
      console.error('Anthropic stream error:', error)
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream interrupted' })}\n\n`)
      res.end()
    })

    // Handle client disconnect
    req.on('close', () => {
      stream.abort()
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Anthropic chat API error:', msg)

    // Check for rate limiting
    if (msg.includes('429') || msg.includes('rate')) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'rate_limited' })}\n\n`)
    } else if (msg.includes('Could not process image') || msg.includes('could not be read') || msg.includes('image')) {
      // Image processing error — likely corrupted or unsupported photo data
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Photo could not be processed. Try retaking the photo. · Foto non elaborabile. Riprova.' })}\n\n`)
    } else {
      // Generic error — don't leak raw SDK errors to the user
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Chat unavailable — try again. · Chat non disponibile — riprova.' })}\n\n`)
    }
    res.end()
  }
}

function buildSystemPrompt(entry: Record<string, unknown>, usDestination: string, settings: Record<string, unknown>): string {
  const decision = entry.final_decision ?? 'unknown'
  const rationale = entry.recommendation_rationale ?? 'No rationale available'
  const rationaleIt = entry.recommendation_rationale_it ?? ''

  return `You are a helpful assistant discussing a household item evaluation for an international move from Galesburg, Illinois to Italy, with an intermediate stop in ${usDestination}.

CONTEXT — ITEM ALREADY EVALUATED:
- Item: ${entry.item_name}${entry.item_name_it ? ` (${entry.item_name_it})` : ''}
${entry.item_model ? `- Model: ${entry.item_model}` : ''}
- Current decision: ${decision}${entry.action_phase ? ` (phase: ${entry.action_phase})` : ''}
- Confidence: ${entry.confidence ?? 'medium'}

ECONOMICS:
- Resale value: ${entry.estimated_resale_value != null ? `$${entry.estimated_resale_value}` : 'unknown'}
- Replacement cost in Italy: ${entry.replacement_cost != null ? `$${entry.replacement_cost}` : 'unknown'}
- Ground move IL→CO: ${entry.storage_cost_total != null ? `$${entry.storage_cost_total}` : 'unknown'}
- Ocean ship CO→Italy: ${entry.ship_cost != null ? `$${entry.ship_cost}` : 'unknown'}
- Total to Italy: ${entry.net_cost_ship != null ? `$${entry.net_cost_ship}` : 'unknown'}
- Savings vs replace: ${entry.net_cost_storage != null ? `$${entry.net_cost_storage}` : 'unknown'}
- Weight: ${entry.weight_lb != null ? `${entry.weight_lb} lb` : 'unknown'}

ORIGINAL RATIONALE:
${rationale}
${rationaleIt ? `\n(Italian): ${rationaleIt}` : ''}

FLAGS:
${entry.voltage_incompatible ? '- ⚡ Voltage incompatible (110V only)' : ''}
${entry.oversized ? '- ◱ Oversized (does not fit standard 27-gal box)' : ''}
${entry.shipping_restriction && entry.shipping_restriction !== 'none' ? `- Shipping: ${entry.shipping_restriction}${entry.shipping_restriction_note ? ` — ${entry.shipping_restriction_note}` : ''}` : ''}
${entry.fragility && entry.fragility !== 'none' ? `- Fragility: ${entry.fragility}` : ''}

COST RATES:
- Ground move: $${settings.movingRatePerLb ?? 0.50}/lb
- Ocean shipping: $${settings.shippingRatePerLb ?? 0.75}/lb + $${settings.shippingRatePerCuFt ?? 4.00}/cu ft

INSTRUCTIONS:
1. Help the user understand and discuss this item's evaluation.
2. If the user provides new information (sentimental value, part of a set, etc.), reconsider the recommendation.
3. If your assessment changes based on new information, include an [UPDATED_RECOMMENDATION] block at the end of your message:

[UPDATED_RECOMMENDATION]
decision: SHIP-ITALY|SELL|DONATE|DISPOSE|GIVE-FAMILY|CONSUME|NEEDS-HUMAN
action_phase: NOW|COLORADO|null
rationale: Brief English explanation of why the recommendation changed
rationale_it: Brief Italian explanation
[/UPDATED_RECOMMENDATION]

4. Only include [UPDATED_RECOMMENDATION] if you genuinely believe the decision should change based on new information. Do not include it for routine Q&A.
5. Respond bilingually: English primary, with Italian translations for key terms and recommendations (AC-7).
6. Keep responses concise — this is a mobile chat interface.
7. Be honest about uncertainty. If you don't know something, say so.`
}

function parseUpdatedRecommendation(text: string): Record<string, unknown> | null {
  const match = text.match(/\[UPDATED_RECOMMENDATION\]([\s\S]*?)\[\/UPDATED_RECOMMENDATION\]/)
  if (!match) return null

  const block = match[1]
  const decision = block.match(/decision:\s*(.+)/)?.[1]?.trim()
  const actionPhase = block.match(/action_phase:\s*(.+)/)?.[1]?.trim()
  const rationale = block.match(/rationale:\s*(.+)/)?.[1]?.trim()
  const rationaleIt = block.match(/rationale_it:\s*(.+)/)?.[1]?.trim()

  if (!decision) return null

  const validDecisions = ['SHIP-ITALY', 'SELL', 'DONATE', 'DISPOSE', 'GIVE-FAMILY', 'CONSUME', 'NEEDS-HUMAN']
  if (!validDecisions.includes(decision)) return null

  return {
    decision,
    action_phase: actionPhase === 'null' ? null : actionPhase ?? null,
    rationale: rationale ?? null,
    rationale_it: rationaleIt ?? null,
  }
}
