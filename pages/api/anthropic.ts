import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = await requireAuth(req, res)
  if (!user) return

  const { photoBase64, description, settings } = req.body

  const usStop = settings.usDestination || 'Colorado Springs'

  const prompt = `You are helping evaluate household items for an international move from Galesburg, Illinois to Italy, with an intermediate stop in ${usStop} (~6 months from now). The couple will live in ${usStop} for ~2 years before the final move to Italy.

Rules in effect:
- Storage in ${usStop}: $${settings.storageRatePerCuFt}/cu ft/month for ${settings.monthsInStorage} months
- Ocean shipping (${usStop} → Italy): $${settings.shippingRatePerLb}/lb + $${settings.shippingRatePerCuFt}/cu ft
- Carry-on: free (no additional cost)

Decision codes:
- SHIP-ITALY: ship to Italy in the ocean container (ultimate destination = Italy)
- SELL: sell (specify action_phase: "NOW" for selling in Galesburg, "COLORADO" for selling in ${usStop})
- DONATE: donate (specify action_phase: "NOW" for donating in Galesburg, "COLORADO" for donating in ${usStop})
- CONSUME: item will be used up before the Italy move (medicine, toiletries, consumables). Set action_phase: "COLORADO" if the item travels to ${usStop} to be consumed there.
- DISPOSE: trash, recycling, or special disposal (including prohibited hazmat items)
- GIVE-FAMILY: give to a family member via trip or suitcase
- NEEDS-HUMAN: no clear AI recommendation; both partners need to discuss

ACTION PHASE — for SELL, DONATE, and CONSUME decisions, also return an "action_phase" field:
- "NOW": do it now in the current location (Galesburg, IL)
- "COLORADO": do it after moving to ${usStop}
Items that are cheap, heavy, or easily replaceable should lean toward "NOW" (sell/donate before the move to avoid moving cost). Items the couple needs in the interim should be "COLORADO".

SHIPPING RESTRICTION RULES — assess international ocean-freight restrictions carefully:
- Lithium-ion battery packs (power tools, e-bikes, large UPS batteries) are Class 9 hazmat and PROHIBITED in ocean containers without special certification. Flag as "prohibited".
- Small consumer lithium batteries (phones, laptops, AA-size cells) are "restricted" — allowed with quantity limits and documentation.
- Aerosols, flammables, compressed gas, pool chemicals, paint = "prohibited" for ocean freight.
- Standard household items with no chemical/battery content = "none".
- When an item is "prohibited", set final_decision to DISPOSE unless the user can clearly ship it via another legal method.

MODEL IDENTIFICATION — inspect the photo and description carefully for brand markings, model numbers, labels, or serial tags. Identifying the exact model significantly improves resale and replacement cost accuracy. Examples: "DeWalt DCS570B 7-1/4 in. Circular Saw", "KitchenAid KSM150PSER Artisan 5-Qt Stand Mixer", "Apple MacBook Pro 14-inch M3 Pro 18GB". Set to null if the item has no meaningful model (e.g. generic towels, loose books, handmade items).

OVERSIZED ITEMS — set "oversized": true for any item that physically cannot fit inside a standard 27-gallon plastic moving box (roughly 24" × 16" × 12"). Examples: rugs, rolled carpets, sofas, armchairs, bed frames, large mirrors, bicycles, golf bags, surfboards, rolled canvases larger than ~20"×30", standing lamps, large potted plants, kayaks. Standard household items that fit in a box (even if heavy) should be false.

VOLTAGE INCOMPATIBILITY — Italy uses 220V/50Hz; the US uses 110V/60Hz. Flag items with US-only power plugs or hardwired 110V motors as "voltage_incompatible": true. This includes:
- Small appliances (hair dryers, blenders, toasters, coffee makers, electric kettles, irons)
- Power tools (drills, saws, sanders, routers) with US-voltage motors
- Lamps and light fixtures with hardwired US plugs (unless bulb-only / LED with adapter)
- Heating/cooling appliances (space heaters, window fans, humidifiers)
- Electronics whose power supply label does NOT say "100–240V" or "universal input"
Items that are voltage-compatible should be false:
- Devices with "100–240V~" or "universal" on the power brick/label (most laptops, phone chargers, game consoles)
- Battery-only items (no plug at all)
- Non-electrical items (furniture, clothing, books, kitchenware without motors)
When voltage_incompatible is true, factor the cost of a step-down transformer (~$30–60 for items under 300W, ~$100–200 for high-wattage appliances like hair dryers, power tools) into the rationale. If the transformer cost plus the shipping cost exceeds 50% of the Italian replacement cost, recommend SELL (with action_phase "COLORADO") instead of SHIP-ITALY.

MULTI-ITEM DETECTION — carefully examine the photo. If you see MULTIPLE DISTINCT items that should each be evaluated separately (e.g. a shelf with several appliances, a table with assorted objects, a group of tools), return a JSON object with an "items" array. Each element in the array is a full evaluation object. If you see only ONE item (or a set that logically counts as one — e.g. a pair of shoes, a set of dishes, a tool with its case), return a single JSON object (no "items" wrapper).

Guidelines for splitting:
- A bookshelf WITH books = multiple items (the shelf + the book collection)
- A pair of speakers = one item (they go together)
- A desk with a lamp and a monitor on it = three items (desk, lamp, monitor)
- A box of assorted kitchen utensils = one item (evaluate as a set)
- A nightstand with an alarm clock = two items
- Do NOT split beyond ~8 items per photo — group small similar items (e.g. "assorted kitchen utensils", "stack of paperback novels")

Each evaluation object (whether single or inside the "items" array) must have these fields:
{
  "item_name": "English name",
  "item_name_it": "Italian name",
  "item_model": "Brand + model name/number string, or null",
  "oversized": true or false,
  "voltage_incompatible": true or false,
  "final_decision": one of SHIP-ITALY|SELL|DONATE|DISPOSE|GIVE-FAMILY|CONSUME|NEEDS-HUMAN,
  "action_phase": "NOW" or "COLORADO" or null (required for SELL, DONATE, CONSUME; null for others),
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
  "packing_notes_it": "Italian packing notes or null",
  "shipping_restriction": "none"|"restricted"|"prohibited",
  "shipping_restriction_note": "English explanation of restriction and alternatives, or null if none",
  "shipping_restriction_note_it": "Italian explanation, or null if none"
}

Return ONLY valid JSON, no markdown, no explanation. For a single item, return the object directly. For multiple items, return: { "items": [ ...objects ] }

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
      max_tokens: 4096,
      messages,
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    // Strip markdown code fences — Claude sometimes wraps JSON in ```json … ``` despite instructions
    const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      console.error('Failed to parse AI JSON response:', text.slice(0, 300))
      return res.status(500).json({ error: 'AI returned invalid JSON' })
    }

    // Normalize: always return { items: [...] }
    let items: unknown[]
    if (Array.isArray(parsed)) {
      items = parsed
    } else if (parsed && Array.isArray(parsed.items)) {
      items = parsed.items
    } else {
      items = [parsed]
    }

    res.status(200).json({ items })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Anthropic API error:', msg)
    res.status(500).json({ error: `AI evaluation failed: ${msg}` })
  }
}
