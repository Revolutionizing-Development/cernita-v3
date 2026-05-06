import { Entry, CustomsCategory, CustomsDeclarantProfile, CernitaSettings, CUSTOMS_CATEGORY_LABELS } from './types'

// ─── Auto-assign customs category from item name ─────────────────────────────
// Rule-based keyword matching (spec 015 Q1: no AI call needed)

const CATEGORY_KEYWORDS: [CustomsCategory, RegExp][] = [
  ['abbigliamento', /\b(shirt|pants|dress|jacket|coat|shoes|boots|sweater|jeans|sock|hat|scarf|glove|belt|tie|suit|blouse|skirt|shorts|underwear|bra|pajama|robe|sandal|sneaker|heels|vest|hoodie|camicia|pantaloni|vestito|giacca|cappotto|scarpe|stivali|maglione|calzini|cappello|sciarpa|guanti|cintura|cravatta|abito|gonna|maglietta|felpa)\b/i],
  ['cucina', /\b(kitchen|pot|pan|skillet|knife|knives|fork|spoon|plate|dish|bowl|cup|mug|glass|blender|mixer|toaster|coffee|espresso|kettle|oven|microwave|spatula|whisk|colander|cutting board|baking|cookware|utensil|tupperware|container|cucina|pentola|padella|coltello|forchetta|cucchiaio|piatto|tazza|bicchiere)\b/i],
  ['elettronica', /\b(computer|laptop|tablet|phone|monitor|printer|speaker|headphone|camera|television|tv|router|modem|charger|cable|keyboard|mouse|console|playstation|xbox|nintendo|projector|drone|gopro|fitbit|watch|smart|power strip|surge|battery|usb|hdmi|bluetooth|wireless|amazon echo|alexa|google home|apple|samsung|sony|dell|hp|lenovo|computer|portatile|telefono|cavo|tastiera|schermo|stampante)\b/i],
  ['libri', /\b(book|novel|textbook|magazine|journal|document|album|photo album|binder|folder|encyclopedia|dictionary|atlas|comic|manga|notebook|diary|sketchbook|libro|romanzo|rivista|documento|quaderno|diario)\b/i],
  ['strumenti_musicali', /\b(guitar|piano|keyboard|violin|drum|trumpet|flute|saxophone|ukulele|banjo|harmonica|accordion|clarinet|cello|bass|amplifier|amp|pedal|microphone|music stand|chitarra|pianoforte|violino|batteria|tromba|flauto|sassofono)\b/i],
  ['arte', /\b(painting|sculpture|artwork|canvas|frame|print|photograph|vase|pottery|ceramic|antique|heirloom|collectible|figurine|statue|ornament|handmade|craft|tapestry|rug|carpet|quilt|embroid|needlepoint|dipinto|scultura|quadro|cornice|vaso|ceramica|antico|arazzo|tappeto)\b/i],
  ['sport', /\b(bicycle|bike|ski|snowboard|golf|tennis|racket|ball|bat|glove|helmet|yoga|mat|weight|dumbbell|kettlebell|treadmill|elliptical|fishing|rod|reel|surfboard|skateboard|scooter|kayak|paddle|camping|tent|sleeping bag|backpack|hiking|climbing|bicicletta|bici|sci|pallone|casco|pesi|materassino)\b/i],
  ['mobili', /\b(table|chair|desk|sofa|couch|bed|mattress|nightstand|dresser|cabinet|shelf|shelves|bookcase|bookshelf|wardrobe|armoire|mirror|lamp|light|fixture|curtain|blind|rug|carpet|bench|stool|ottoman|recliner|futon|cradle|crib|tavolo|sedia|scrivania|divano|letto|materasso|comodino|cassettiera|armadio|scaffale|specchio|lampada|tenda)\b/i],
]

export function autoAssignCategory(entry: Entry): CustomsCategory {
  const text = `${entry.item_name} ${entry.item_name_it ?? ''} ${entry.item_model ?? ''}`
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return category
  }
  return 'altri'
}

// ─── Customs eligibility check ────────────────────────────────────────────────

export function checkEligibility(entry: Entry): boolean | null {
  if (!entry.acquisition_year) return null // unknown
  const currentYear = new Date().getFullYear()
  // Must be owned > 6 months. If acquired before current year, definitely eligible.
  // If acquired this year or last year, flag as uncertain.
  return entry.acquisition_year < currentYear
}

// ─── Completeness checks ──────────────────────────────────────────────────────

export interface CustomsCompleteness {
  total: number
  missingYear: Entry[]
  missingValue: Entry[]
  missingItalianName: Entry[]
  excluded: Entry[]
  ready: Entry[]
  isComplete: boolean
}

export function checkCompleteness(entries: Entry[]): CustomsCompleteness {
  const keepItaly = entries.filter(e =>
    e.final_decision === 'SHIP-ITALY' && !e.customs_exclude
  )
  const excluded = entries.filter(e =>
    e.final_decision === 'SHIP-ITALY' && e.customs_exclude
  )
  const missingYear = keepItaly.filter(e => !e.acquisition_year)
  const missingValue = keepItaly.filter(e =>
    e.estimated_resale_value == null && e.replacement_cost == null
  )
  const missingItalianName = keepItaly.filter(e => !e.item_name_it)

  return {
    total: keepItaly.length,
    missingYear,
    missingValue,
    missingItalianName,
    excluded,
    ready: keepItaly.filter(e =>
      e.acquisition_year && (e.estimated_resale_value != null || e.replacement_cost != null) && e.item_name_it
    ),
    isComplete: missingYear.length === 0 && missingValue.length === 0 && missingItalianName.length === 0,
  }
}

// ─── Group items by customs category ──────────────────────────────────────────

export function groupByCategory(entries: Entry[]): Map<CustomsCategory, Entry[]> {
  const map = new Map<CustomsCategory, Entry[]>()
  for (const e of entries) {
    const cat = (e.customs_category as CustomsCategory) || autoAssignCategory(e)
    const list = map.get(cat) || []
    list.push(e)
    map.set(cat, list)
  }
  // Sort by the fixed category order
  const order: CustomsCategory[] = [
    'mobili', 'abbigliamento', 'libri', 'elettronica', 'strumenti_musicali',
    'arte', 'cucina', 'sport', 'altri',
  ]
  const sorted = new Map<CustomsCategory, Entry[]>()
  for (const cat of order) {
    const items = map.get(cat)
    if (items && items.length > 0) sorted.set(cat, items)
  }
  return sorted
}

// ─── Generate declaration text ────────────────────────────────────────────────

export function generateCoverDeclaration(
  profile: CustomsDeclarantProfile,
  itemCount: number,
  totalEur: number,
  shipmentLabel: string
): string {
  const joint = profile.bothDeclarants && profile.nameSecondary
  const declarantText = joint
    ? `I sottoscritti ${profile.namePrimary}, nato/a il ${profile.dobPrimary}, cittadinanza ${profile.nationalityPrimary}, e ${profile.nameSecondary}, nato/a il ${profile.dobSecondary}, cittadinanza ${profile.nationalityPrimary}`
    : `Il/La sottoscritto/a ${profile.namePrimary}, nato/a il ${profile.dobPrimary}, cittadinanza ${profile.nationalityPrimary}`

  return `DICHIARAZIONE SOSTITUTIVA DI ATTO NOTORIO
(ai sensi del D.P.R. 28 dicembre 2000, n. 445, artt. 46 e 47)

${declarantText},

${joint ? 'dichiarano' : 'dichiara'} quanto segue:

1. Di trasferire la propria residenza da:
   ${profile.usAddress || '[indirizzo USA]'}
   a:
   ${profile.italyAddress || '[indirizzo Italia]'}

2. Di essere ${joint ? 'stati residenti' : 'stato/a residente'} negli Stati Uniti d'America per almeno 12 mesi consecutivi immediatamente precedenti il trasferimento.

3. Che tutti i beni elencati nell'allegato elenco (${itemCount} articoli, valore stimato totale EUR ${totalEur.toFixed(2)}) sono di uso personale e domestico e sono ${joint ? 'stati in loro possesso' : 'stati in proprio possesso'} per un periodo superiore a sei mesi prima dell'importazione.

4. Che i beni non sono destinati ad uso commerciale né alla rivendita.

5. Che l'elenco allegato ("Elenco analitico dei beni mobili di uso domestico e personale") è completo e accurato secondo la migliore conoscenza ${joint ? 'dei dichiaranti' : 'del/della dichiarante'}.

Spedizione: ${shipmentLabel}
Porto di ingresso previsto: ${profile.portOfEntry || '[da specificare]'}
Data di arrivo prevista: ${profile.arrivalDateEstimate || '[da specificare]'}

Si richiede l'esenzione dai dazi doganali ai sensi del Regolamento (CE) n. 1186/2009, Articolo 3 (trasferimento di residenza da paese terzo).

Luogo e data: ____________________________

${joint ? `Firma: ____________________________\n       ${profile.namePrimary}\n\nFirma: ____________________________\n       ${profile.nameSecondary}` : `Firma: ____________________________\n       ${profile.namePrimary}`}
`
}

export function generateGoodsTable(
  entries: Entry[],
  eurRate: number
): { rows: GoodsRow[]; totalEur: number } {
  const grouped = groupByCategory(entries)
  const rows: GoodsRow[] = []
  let n = 0
  let totalEur = 0

  const groupedArr = Array.from(grouped.entries())
  for (const [cat, items] of groupedArr) {
    const catLabel = CUSTOMS_CATEGORY_LABELS[cat]
    rows.push({ type: 'header', category: cat, categoryLabel: catLabel.it })

    for (const item of items) {
      n++
      const usdValue = item.replacement_cost ?? item.estimated_resale_value ?? 0
      const eurValue = Math.round(usdValue * eurRate * 100) / 100
      totalEur += eurValue

      const needsVerify = item.acquisition_year
        ? item.acquisition_year >= new Date().getFullYear() - 1
        : false

      rows.push({
        type: 'item',
        n,
        descriptionIt: item.item_name_it || item.item_name,
        descriptionEn: item.item_name,
        quantity: 1,
        valueEur: eurValue,
        acquisitionYear: item.acquisition_year,
        notes: item.customs_notes || (needsVerify ? 'Data di acquisto da verificare' : null),
      })
    }
  }

  return { rows, totalEur }
}

export interface GoodsRow {
  type: 'header' | 'item'
  category?: CustomsCategory
  categoryLabel?: string
  n?: number
  descriptionIt?: string
  descriptionEn?: string
  quantity?: number
  valueEur?: number
  acquisitionYear?: number | null
  notes?: string | null
}
