import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = await requireAuth(req, res)
  if (!user) return

  const { photoBase64, description, settings } = req.body

  const prompt = `You are helping evaluate household items for an international move from Illinois to Italy.

Rules in effect:
- Storage: $${settings.storageRatePerCuFt}/cu ft/month for ${settings.monthsInStorage} months
- Ocean shipping: $${settings.shippingRatePerLb}/lb + $${settings.shippingRatePerCuFt}/cu ft
- Carry-on: free (no additional cost)

Evaluate this item and return a JSON object with these fields:
{
  "item_name": "English name",
  "item_name_it": "Italian name",
  "final_decision": one of KEEP-ITALY|KEEP-TEXAS|SELL|DONATE|DISPOSE|GIVE-FAMILY|NEEDS-HUMAN,
  "estimated_resale_value": number or null,
  "replacement_cost": number or null,
  "weight_lb": number or null,
  "volume_cuft": number or null,
  "storage_cost_total": number or null,
  "ship_cost": number or null,
  "net_cost_ship": number or null,
  "net_cost_storage": number or null,
  "recommendation_rationale": "English rationale paragraph",
  "recommendation_rationale_it": "Italian rationale paragraph",
  "confidence": "high"|"medium"|"low",
  "fragility": "none"|"low"|"medium"|"high"|"irreplaceable",
  "survival_risk": "English risk description or null",
  "survival_risk_it": "Italian risk description or null",
  "packing_notes": "English packing notes or null",
  "packing_notes_it": "Italian packing notes or null"
}

Return ONLY the JSON object, no markdown, no explanation.

${description ? `Item description: ${description}` : ''}`

  const messages: Anthropic.MessageParam[] = []

  if (photoBase64) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: photoBase64 },
        },
        { type: 'text', text: prompt },
      ],
    })
  } else {
    messages.push({ role: 'user', content: prompt })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set')
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  try {
    const response = await anthropic.messages.create({
      model: settings.aiModel || 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages,
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    // Strip markdown code fences — Claude sometimes wraps JSON in ```json … ``` despite instructions
    const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    let result
    try {
      result = JSON.parse(text)
    } catch {
      console.error('Failed to parse AI JSON response:', text.slice(0, 300))
      return res.status(500).json({ error: 'AI returned invalid JSON' })
    }
    res.status(200).json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Anthropic API error:', msg)
    res.status(500).json({ error: `AI evaluation failed: ${msg}` })
  }
}
