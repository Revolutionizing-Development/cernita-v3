# CSV export

> One button. Tap it. Download a spreadsheet with every item. Generated from in-memory data — no API call, works instantly. UTF-8 with BOM so Excel opens it correctly.

| | |
|---|---|
| **Status** | draft |
| **Tier** | 2 (small — single function, no schema changes) |
| **Branch** | `feat/csv-export` (to be created) |
| **Author** | Cernita team |
| **Drafted** | 2026-05-03 |
| **Last updated** | 2026-05-03 |
| **Constitution principles** | Principle 3 (data belongs to the user — export is the primary delivery mechanism); Principle 11 (bilingual — Italian columns required) |
| **Supersedes** | none |
| **Depends on** | Spec 011 (core evaluation — defines the fields to export) |

---

## Problem

Principle 3 says "the user can export everything as CSV at any time." This is the implementation of that promise. The export must be useful on its own: if Cernita disappears tomorrow, the CSV remains a readable, sortable record of every decision made.

## Acceptance criteria

- [ ] **AC1** A "Export CSV · Esporta CSV" button appears in Settings → Maintenance section. Tapping it generates and downloads the file immediately from the in-memory `AppContext` log. No API call, no server round-trip.

- [ ] **AC2** The CSV filename is `cernita-export-YYYY-MM-DD.csv` where the date is today's date in the user's local timezone.

- [ ] **AC3** The file is UTF-8 encoded with a BOM (`\uFEFF`) prepended so Excel on Windows opens it without a manual encoding selection step.

- [ ] **AC4** Column set, in order:

| # | Column header | Source field |
|---|---|---|
| 1 | ID | `id` |
| 2 | Date | `created_at` (ISO 8601) |
| 3 | Evaluated by | `user_name` |
| 4 | Item (English) | `item_name` |
| 5 | Item (Italian) | `item_name_it` |
| 6 | Decision | `final_decision` |
| 7 | Confirmed | `user_confirmed` (TRUE/FALSE) |
| 8 | Override reason | `override_reason` |
| 9 | Rationale (English) | `recommendation_rationale` |
| 10 | Rationale (Italian) | `recommendation_rationale_it` |
| 11 | Resale value ($) | `estimated_resale_value` |
| 12 | Replacement cost ($) | `replacement_cost` |
| 13 | Weight (lb) | `weight_lb` |
| 14 | Volume (cu ft) | `volume_cuft` |
| 15 | Storage cost ($) | `storage_cost_total` |
| 16 | Ship cost ($) | `ship_cost` |
| 17 | Net cost — ship ($) | `net_cost_ship` |
| 18 | Net cost — storage ($) | `net_cost_storage` |
| 19 | Confidence | `confidence` |
| 20 | Fragility | `fragility` |
| 21 | Survival risk (English) | `survival_risk` |
| 22 | Survival risk (Italian) | `survival_risk_it` |
| 23 | Packing notes (English) | `packing_notes` |
| 24 | Packing notes (Italian) | `packing_notes_it` |
| 25 | Box | `box_id` resolved to `box_number` if available, else empty |
| 26 | Rules version | `rules_version` |

- [ ] **AC5** Fields containing commas, double quotes, or newlines are quoted per RFC 4180. Null / undefined values export as empty cells — no `"null"` or `"undefined"` strings in the output.

- [ ] **AC6** The export is generated entirely in the browser from `AppContext.log`. If the log is empty, the file exports with the header row only (not an error state).

- [ ] **AC7** After the download begins, a toast confirms: "Export downloaded · File esportato."

- [ ] **AC8** A secondary "Export" link appears in the Log tab header (small, right-aligned) as a convenience affordance. It triggers the same function as the Settings button.

## Implementation

```typescript
function exportCSV(log: Entry[], boxes: Box[]) {
  const BOM = '\uFEFF';
  const headers = [
    'ID', 'Date', 'Evaluated by', 'Item (English)', 'Item (Italian)',
    'Decision', 'Confirmed', 'Override reason',
    'Rationale (English)', 'Rationale (Italian)',
    'Resale value ($)', 'Replacement cost ($)', 'Weight (lb)', 'Volume (cu ft)',
    'Storage cost ($)', 'Ship cost ($)', 'Net cost — ship ($)', 'Net cost — storage ($)',
    'Confidence', 'Fragility',
    'Survival risk (English)', 'Survival risk (Italian)',
    'Packing notes (English)', 'Packing notes (Italian)',
    'Box', 'Rules version',
  ];

  const rows = log.map(e => [
    e.id, e.created_at, e.user_name, e.item_name, e.item_name_it ?? '',
    e.final_decision, e.user_confirmed ? 'TRUE' : 'FALSE', e.override_reason ?? '',
    e.recommendation_rationale ?? '', e.recommendation_rationale_it ?? '',
    e.estimated_resale_value ?? '', e.replacement_cost ?? '',
    e.weight_lb ?? '', e.volume_cuft ?? '',
    e.storage_cost_total ?? '', e.ship_cost ?? '',
    e.net_cost_ship ?? '', e.net_cost_storage ?? '',
    e.confidence ?? '', e.fragility ?? '',
    e.survival_risk ?? '', e.survival_risk_it ?? '',
    e.packing_notes ?? '', e.packing_notes_it ?? '',
    e.box_id ? boxes.find(b => b.id === e.box_id)?.box_number ?? '' : '',
    e.rules_version ?? '',
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => quoteCSV(String(cell))).join(','))
    .join('\n');

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cernita-export-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function quoteCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
```

## Out of scope

- PDF export — separate spec, future
- Filtered exports (by decision type, date range, user)
- Server-side export generation
- Email delivery of the export
- Scheduled automatic export
- Excel `.xlsx` format

## References

- Constitution Principle 3 (export is the primary user-data-ownership mechanism)
- Constitution Principle 11 (bilingual columns required for permanent records)
- Spec 011 (core evaluation — defines the `cernita_entries` fields)
