# Spec 020 — Multi-Item Photo Evaluation

**Status:** Shipped (retroactive spec)
**Priority:** P1
**Dependencies:** 011 (core evaluation), 003 (backend proxy)

## Problem

Users often photograph a shelf, table, or counter with multiple distinct items visible. Without multi-item detection, the AI would evaluate the entire scene as one item (e.g., "assorted kitchen items") — losing the per-item economics, decisions, and packing guidance that make Cernita useful.

## User Stories

### US-1: Photograph a group
> As a user, I want to take one photo of several items on a table and have each item evaluated separately, so I don't have to photograph each one individually.

### US-2: Review each item
> As a user, I want to step through each detected item one at a time, confirming or overriding each decision independently, so I maintain control over every item.

### US-3: Track progress
> As a user, I want to see which items in the batch I've already saved and which remain, so I don't lose my place.

## Acceptance Criteria

### AC-1: AI multi-item detection
The AI prompt instructs the model to examine the photo and return multiple evaluation objects when it detects distinct items that should be evaluated separately. The response uses `{ "items": [...] }` wrapper format for multiple items, or a single object (no wrapper) for one item.

### AC-2: Splitting guidelines
The AI follows these rules for splitting:
- A bookshelf WITH books = multiple items (shelf + book collection)
- A pair of speakers = one item (they go together)
- A desk with a lamp and monitor = three items
- A box of assorted utensils = one item (evaluate as set)
- A nightstand with an alarm clock = two items
- Maximum ~8 items per photo (group small similar items into sets)

### AC-3: Response normalization
The API endpoint normalizes all response formats to `{ items: [...] }`:
- Single object → `{ items: [object] }`
- Array → `{ items: array }`
- `{ items: [...] }` → passed through

### AC-4: Stepper UI
When multiple items are detected, a stepper appears above the result card showing:
- "Item N of M" counter text
- Progress dots: filled dots for completed items, highlighted dot for current, empty dots for remaining

### AC-5: Per-item confirmation
Each item in the batch goes through the full result card flow independently:
- View AI recommendation with economics, perspectives, rationale
- Confirm, override, or discuss with AI
- Save to database as a separate `cernita_entries` row

### AC-6: Batch advancement
After saving one item:
- If more items remain: advance to the next item, show a brief toast ("Item Name saved · N of M"), reset override state
- If last item: show batch completion summary

### AC-7: Batch completion
When all items in a multi-item batch are saved:
- Toast shows "{N} items saved · {N} oggetti salvati"
- Auto-resets to camera after 3 seconds
- No box assignment prompt (box assignment is per-item, handled later in Log)

### AC-8: Shared photo
All items in a batch share the same captured `photo_data`. Each saved entry stores the same base64 photo — the photo shows the context where all items were seen together.

### AC-9: Independent state per item
When advancing between items in a batch:
- Override decision resets to the new item's AI recommendation
- Override phase resets to the new item's AI-suggested phase
- Override tags clear
- Override reason clears
- Error message clears

## Data Model

No new tables or fields. Multi-item is handled entirely in the evaluate page component state:
- `aiResults: AiResult[]` — array of all detected items
- `currentItemIndex: number` — which item is being reviewed
- `savedCount: number` — how many have been saved so far

Each saved item creates a standard `cernita_entries` row.

## API

### POST `/api/anthropic`

**Request:** Unchanged — single photo + description + settings.

**Response:** The endpoint normalizes to `{ items: [...] }`:
```typescript
let items: unknown[]
if (Array.isArray(parsed)) {
  items = parsed
} else if (parsed && Array.isArray(parsed.items)) {
  items = parsed.items
} else {
  items = [parsed]
}
res.status(200).json({ items })
```

**AI prompt includes:** Multi-item detection instructions with splitting guidelines and 8-item cap.

## UI States

### Single item (no change from spec 011)
Standard result card flow: camera → thinking → result → confirm/override → saved → camera.

### Multi-item stepper
```
┌─────────────────────────┐
│  Item 2 of 4            │
│  ● ◉ ○ ○               │
├─────────────────────────┤
│  [Result Card for       │
│   current item]         │
│                         │
│  [Confirm] [Override]   │
└─────────────────────────┘
```

### Progress dot states
- `done` (●): Item already saved — filled dot
- `current` (◉): Currently being reviewed — highlighted dot
- Remaining (○): Not yet reviewed — empty dot

## Edge Cases

- **AI returns 0 items**: Throw error "AI returned no items", show error phase
- **AI returns 1 item in array**: Treated as single-item flow (no stepper shown, `isMultiItem` is false)
- **User cancels mid-batch**: `handleCancel` resets all state — unsaved items in the batch are lost. Only already-saved items persist.
- **Override on batch item**: Override applies only to the current item. Subsequent items retain their original AI recommendations.
- **Photo shared**: The same `capturedBase64` is saved with every entry in the batch. This is intentional — it shows the context.
- **Box prompt skipped**: Multi-item batches skip the post-save box assignment prompt entirely. Items can be assigned to boxes later from the Log detail overlay.
- **NEEDS-HUMAN in batch**: If one item in a batch is NEEDS-HUMAN, it's saved normally and appears in the Discuss tab. No special routing during batch flow.

## Out of Scope

- Editing the item split (removing or adding items to the detected set)
- Re-ordering items in the batch
- Partial batch save (save some, skip others)
- Different photos per item in the same batch
- Batch evaluation from text-only mode (multi-item detection requires a photo)

## Key Files

- `pages/evaluate.tsx` — multi-item state management, stepper UI, batch advancement
- `pages/api/anthropic.ts` — response normalization, AI prompt with splitting guidelines
- `styles/globals.css` — `.multi-item-stepper`, `.multi-item-counter`, `.multi-item-dot` classes
