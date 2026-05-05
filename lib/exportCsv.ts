import { Entry } from './types'

// ─── RFC 4180 quoting ─────────────────────────────────────────────────────────

function quoteCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function cell(v: string | number | boolean | null | undefined): string {
  if (v == null) return ''
  return quoteCSV(String(v))
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportCSV(log: Entry[]): void {
  const BOM = '\uFEFF'

  const headers = [
    'ID',
    'Date',
    'Evaluated by',
    'Item (English)',
    'Item (Italian)',
    'Decision',
    'Confirmed',
    'Override reason',
    'Rationale (English)',
    'Rationale (Italian)',
    'Resale value ($)',
    'Replacement cost ($)',
    'Weight (lb)',
    'Volume (cu ft)',
    'Storage cost ($)',
    'Ship cost ($)',
    'Net cost — ship ($)',
    'Net cost — storage ($)',
    'Confidence',
    'Fragility',
    'Survival risk (English)',
    'Survival risk (Italian)',
    'Packing notes (English)',
    'Packing notes (Italian)',
    'Box',
    'Rules version',
  ]

  const rows = log.map(e => [
    cell(e.id),
    cell(e.created_at),
    cell(e.user_name),
    cell(e.item_name),
    cell(e.item_name_it),
    cell(e.final_decision),
    cell(e.user_confirmed ? 'TRUE' : 'FALSE'),
    cell(e.override_reason),
    cell(e.recommendation_rationale),
    cell(e.recommendation_rationale_it),
    cell(e.estimated_resale_value),
    cell(e.replacement_cost),
    cell(e.weight_lb),
    cell(e.volume_cuft),
    cell(e.storage_cost_total),
    cell(e.ship_cost),
    cell(e.net_cost_ship),
    cell(e.net_cost_storage),
    cell(e.confidence),
    cell(e.fragility),
    cell(e.survival_risk),
    cell(e.survival_risk_it),
    cell(e.packing_notes),
    cell(e.packing_notes_it),
    cell(e.box_id ?? ''),   // will be resolved to box label when spec 006 ships
    cell(e.rules_version),
  ].join(','))

  const csvContent = [headers.join(','), ...rows].join('\r\n')

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cernita-export-${todayISO()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
