# Log search

> A search bar at the top of the Log view that filters items by name (English or Italian), rationale, flags, or notes — making large logs navigable.

| | |
|---|---|
| **Status** | draft |
| **Tier** | 2 (small feature, ~50–80 lines, no schema change) |
| **Branch** | `feat/log-search` (to be created) |
| **Author** | Cernita team |
| **Drafted** | 2026-04-27 |
| **Last updated** | 2026-04-27 |
| **Constitution principles** | Principle 1 (user owns the decision — searching helps the user find their own data); Principle 11 (bilingual — search must work on both English and Italian fields) |
| **Supersedes** | none |
| **Depends on** | bilingual item names (shipped), bilingual rationale (shipped) |

---

## Problem

The Log view currently shows all items in reverse chronological order, with filter buttons for decision type (KEEP-ITALY, SELL, etc.) and STALE. There is no way to find a specific item by name.

This is fine when the log has 20 items. It becomes painful around 50, and unusable around 200+. A full house has hundreds of items.

Three concrete scenarios where this hurts:

1. **"Did I evaluate the cast iron pan yet?"** — without search, the user must scroll the Log or rely on memory. Both are unreliable.

2. **"Where did I put the Christmas decorations?"** — once location tracking ships (queued spec), the user will want to find an item by name and check its location. Without search, this is just scrolling.

3. **"Find every item I marked as sentimental."** — flags contain semantic information that filtering by decision can't surface. Without text search, the flag content is invisible until you tap into each item.

The UI study comparing Cernita to Sortly identified this as the most-noticeable gap when the apps are placed side by side. Sortly users praise its search; Cernita users will eventually feel its absence.

## Why now

Three reasons to do this small feature before the backend proxy:

1. **The cost of waiting compounds.** Every item evaluated in the meantime is one more item in a Log that grows harder to navigate.

2. **It's small and self-contained.** ~50-80 lines of frontend-only code, no schema change, no backend involvement, no breaking changes. Risk-cheap to ship.

3. **Doing it now means the backend proxy spec can ship clean.** If we batch this with the proxy, the proxy PR becomes harder to review. Better to ship search separately, verify it, then move on.

## User story

> As one of the two people doing this move, when I'm in the Log view, I want to type a few letters and instantly see only matching items. I want to type "cast iron" and see the skillet, the Dutch oven, the griddle. I want to type "vogatore" (Italian) and see the rower. I want to type "sentimental" and see every flag-containing item that mentions it. I want to clear the search and see everything again.

## Acceptance criteria

- [ ] **AC1** A search input appears at the top of the Log view, below the summary stats and above the filter buttons.
- [ ] **AC2** Typing in the search input filters the Log list in real time (no submit button needed). Filtering happens in JavaScript on the already-loaded entries — no API call.
- [ ] **AC3** Search matches across these fields, case-insensitive: `item_name`, `item_name_it`, `rationale`, `rationale_it`, `flags`, `notes`. Matches are inclusive (any field matches → item appears).
- [ ] **AC4** Search works alongside the existing filter buttons (decision type and STALE). Both filters apply: search narrows to text matches, filter narrows to decision type. Empty search behaves as it does today.
- [ ] **AC5** When the search is non-empty, a small "X" button appears inside the search input to clear it. Clicking it clears the search and returns to the unfiltered list.
- [ ] **AC6** When the search yields no results, the empty state shows: "No items match '[search term]'" with a "Clear search" button.
- [ ] **AC7** Search input is debounced by ~150ms to prevent flicker as the user types — but feels instant.
- [ ] **AC8** Search persists in component state during the session but does NOT persist across reloads. (Reopening the app starts with an empty search.)
- [ ] **AC9** The summary stat row above the search shows the filtered count when search is active: e.g., "Showing 12 of 87 items" instead of just totals.
- [ ] **AC10** Search input has appropriate mobile keyboard behavior: `enterkeyhint="search"`, `autocapitalize="off"`, `autocomplete="off"`. Tapping "Search" on the mobile keyboard dismisses the keyboard but doesn't trigger any other action.
- [ ] **AC11** Search text matches respect bilingual users' typing habits — Italian accented characters work both with and without accents (typing "perdita" matches "perderdìa" if accents differ; this is achievable with a simple normalization pass).
- [ ] **AC12** Search is keyboard-accessible. Pressing `/` (slash) anywhere in the Log view focuses the search input (same convention as GitHub, Twitter, many web apps). Pressing Escape with focus in search clears it.

## Data model changes

**None.** This is purely a frontend feature operating on already-loaded `state.log` entries.

## UI states

### State A — Empty search (default)
The search input is empty. The "X" clear button is hidden. The Log shows all entries (subject to existing filter buttons).

### State B — Search with matches
User has typed something. The "X" clear button is visible. The Log shows only matching entries. The summary line above reads e.g. "Showing 12 of 87 items".

### State C — Search with no matches
User has typed something with no matches. The Log area shows: a softer empty state with the message "No items match 'search term'" and a "Clear search" button. The "X" inside the input is also visible.

### State D — Search active + decision filter active
User has typed "cast iron" AND tapped the SELL filter. The list shows only items that contain "cast iron" AND have decision = SELL. Both filter indicators are visible.

### State E — Stale filter active + search
The STALE filter and search compose: the list shows only items where current rules would change AND the search term matches.

### State F — Mobile keyboard open
Standard mobile behavior. Search bar stays visible at the top; results scroll below. No special handling needed beyond setting `enterkeyhint="search"` and `autocapitalize="off"`.

## Edge cases

- **EC1** Search with only whitespace — treat as empty search. Don't filter on whitespace.

- **EC2** Search with special regex characters (`.`, `*`, `(`, etc.) — use `.includes()` not `RegExp` to avoid injection or syntax errors. Plain string matching only.

- **EC3** Search across an entry where one of the searchable fields is null — handle gracefully (skip that field, don't error). Already standard with `String(field || '').toLowerCase()`.

- **EC4** Very long search strings (paste accident, e.g. 5000 characters) — UI should not lock up. JavaScript `.includes()` is fast enough that this is fine in practice; no special truncation needed for typical inputs.

- **EC5** Italian accented characters — typing "perdita" should match content with the same letters. Use Unicode normalization (`.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`) to strip combining accents before comparison. Standard pattern.

- **EC6** Search interacts with stale-rules indicator — items shown in search results should still display their stale badge if applicable. No special handling; the existing rendering logic carries over.

- **EC7** User opens the app with the Log tab as default (configurable in some PWAs) — search is empty as expected (AC8). No special handling.

- **EC8** Search yields all items (e.g., user types a single common letter) — that's fine. The "Showing N of N items" line still shows accurately.

- **EC9** Animation conflict — when the list is staggered-animating in (existing motion behavior), and search filters it mid-animation — accept this. Current motion lets the animation complete; subsequent searches re-render without animation. Acceptable trade-off.

- **EC10** Re-derived rules cause an item to appear/disappear from STALE filter while search is active — handled by re-running both filters together. Standard React-style "compute the visible list from current state on every render."

## Out of scope

- **Fuzzy matching / typo tolerance.** Plain substring matching only. If user types "ironn" they get nothing. Adding fuzzy matching adds complexity for marginal benefit.

- **Search highlighting in results.** The matching substring is not highlighted in the result rows. Could be added later if usability testing shows it'd help. Not in v1.

- **Search history / autocomplete suggestions.** No "recent searches" or "popular search terms" UI. Cernita is a personal tool; search history would be noise.

- **Saved searches.** No "save this search" feature. If you find yourself re-running a complex query often, that's a sign for a different feature (saved view, smart filter), not search itself.

- **Search across the Bins tab.** This spec is for the Log view only. Bins has its own organizational metaphor (grouping); search there could be a separate spec.

- **Search across the Discuss tab.** Discuss is for disagreements specifically; the user is looking at structured data there, not browsing. Search isn't the right tool for that view.

- **Server-side search.** This is purely frontend filtering of already-loaded data. As long as we load all entries (which we do today), no need for server-side search.

- **Searching call transcripts** (when phone calls feature is used). Out of scope. Different data, different view, different ranking concerns.

- **Voice search.** Not v1. The mobile keyboard already supports dictation — that's enough.

## Open questions

- **Q1:** Should search results be sorted by relevance instead of recency?
  **A:** No. Recency-first is the user's mental model in the Log. Adding relevance ranking would require defining what "relevance" means (where in the entry the match was, how many matches, etc.) — premature optimization. Stay with reverse-chronological even when filtered.

- **Q2:** Should we support advanced query syntax like `decision:SELL value:>100`?
  **A:** No. Filter buttons exist for decision filtering. Adding query syntax adds complexity and discoverability problems. The user can search "SELL" and get items where the rationale or notes mention sell, which is close enough. If real query language is needed later, separate spec.

- **Q3:** Should we add a "Search in Italian only" toggle?
  **A:** No. Bilingual search by default (search both English and Italian fields together) is the more useful behavior. A user typing "vogatore" wants the rower regardless of which field it lived in. A toggle would add complexity for a use case we can't articulate.

- **Q4:** Should the search field be sticky as the user scrolls?
  **A:** Already addressed by mobile platform conventions — let the browser's natural scroll behavior apply. Don't add custom sticky positioning unless we see a UX problem in practice.

- **Q5:** What should the placeholder text say?
  **A:** "Search items, rationales, flags…" — gives the user a hint of what's searchable without overloading.

All open questions resolved.

## References

- **UI study (UI-STUDY.md)** — identified search as the most-noticeable gap vs. Sortly
- **Constitution Principle 11** — bilingual, requires search to work across both languages
- **Existing Log filter logic** in `cernita.html` — extends naturally; search and filter compose

## Implementation notes

1. **Where to add the search input.** In the Log view, between `<div class="log-summary">` and the existing `<div class="log-controls">` (filter buttons). Wrap in a small section with margin so it visually breathes.

2. **HTML structure:**
   ```html
   <div class="log-search-wrapper" style="position: relative; margin-bottom: 12px;">
     <input id="log-search" type="search"
            placeholder="Search items, rationales, flags…"
            autocomplete="off" autocapitalize="off"
            enterkeyhint="search"
            style="width: 100%; padding: 10px 36px 10px 14px; border: 1px solid var(--paper-dark); border-radius: 2px; font-family: 'Lato', sans-serif; font-size: 14px; background: white;">
     <button id="log-search-clear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: 0; padding: 4px 8px; color: var(--ink-soft); cursor: pointer;">×</button>
   </div>
   ```

3. **Filter logic** — extend the existing `state.filter` mechanism. Add `state.searchQuery = ''`. The render function applies both:
   ```javascript
   let filtered = state.log;
   if (state.searchQuery.trim()) {
     const q = normalizeForSearch(state.searchQuery);
     filtered = filtered.filter(e => matchesSearch(e, q));
   }
   if (state.filter === 'STALE') { /* existing */ }
   else if (state.filter !== 'all') { /* existing */ }
   ```

4. **Search-matching helper:**
   ```javascript
   function normalizeForSearch(s) {
     return String(s || '').toLowerCase()
       .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
   }
   function matchesSearch(entry, normalizedQuery) {
     const fields = [entry.item_name, entry.item_name_it, entry.rationale, entry.rationale_it, entry.flags, entry.notes];
     return fields.some(f => normalizeForSearch(f).includes(normalizedQuery));
   }
   ```

5. **Debounce** — small inline debounce, not worth a library:
   ```javascript
   let searchTimeout;
   searchInput.addEventListener('input', (e) => {
     clearTimeout(searchTimeout);
     searchTimeout = setTimeout(() => {
       state.searchQuery = e.target.value;
       updateSearchClearButton();
       renderLog();
     }, 150);
   });
   ```

6. **Clear button visibility** — toggle inline, no animation needed:
   ```javascript
   function updateSearchClearButton() {
     const btn = document.getElementById('log-search-clear');
     if (btn) btn.style.display = state.searchQuery ? 'block' : 'none';
   }
   ```

7. **Keyboard shortcut for `/` to focus** — listen on the Log view document level:
   ```javascript
   document.addEventListener('keydown', (e) => {
     if (e.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
       const view = document.getElementById('view-log');
       if (view && view.classList.contains('active')) {
         e.preventDefault();
         document.getElementById('log-search')?.focus();
       }
     }
     if (e.key === 'Escape' && document.activeElement?.id === 'log-search') {
       state.searchQuery = '';
       document.getElementById('log-search').value = '';
       updateSearchClearButton();
       renderLog();
     }
   });
   ```

8. **Empty state** — replace the existing "No items evaluated yet" empty state with a conditional:
   ```javascript
   if (filtered.length === 0 && state.log.length > 0 && state.searchQuery) {
     listEl.innerHTML = `
       <div class="log-empty">
         No items match "${escapeHtml(state.searchQuery)}".<br><br>
         <button class="btn-tiny" onclick="clearLogSearch()">Clear search</button>
       </div>`;
   }
   ```

9. **Summary line** — update the existing summary to show filtered count when search is active:
   ```javascript
   const showingCount = filtered.length;
   const totalCount = state.log.length;
   const summaryText = state.searchQuery
     ? `Showing ${showingCount} of ${totalCount} items`
     : `${totalCount} items evaluated`;
   ```

10. **Test cases worth verifying manually:**
    - Search "cast iron" finds skillets and Dutch ovens
    - Search "vogatore" (Italian) finds the rower
    - Search "perdita" matches "perderesti" (substring works as expected)
    - Search "perdìta" with accent matches "perdita" without (NFD normalization)
    - Search + decision filter compose correctly
    - Clear button appears/disappears
    - `/` shortcut focuses the search bar
    - Escape clears the search
