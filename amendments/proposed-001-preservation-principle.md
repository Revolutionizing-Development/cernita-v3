# Amendment proposal 001: Preservation is part of the math

| | |
|---|---|
| **Status** | accepted (2026-04-28) — Constitution updated to v1.4 |
| **Proposed** | 2026-04-27 |
| **Author** | Cernita team |
| **Type** | Addition (new principle, no existing principle removed or modified) |
| **Constitution version after** | 1.4 (was 1.3) |

---

## What changes

Add a 13th principle to the Constitution:

> **Principle 13 — Preservation is part of the math.**
>
> Items deteriorate in storage and during transit. Wood warps. Leather molds. Vinyl records melt in summer storage units. Foam mattresses crumble after eighteen months in a sealed unit. Electronics corrode in humid containers. Paper foxes, books mildew, photographs stick.
>
> Honest decisions account for these losses. The simple economic comparison — "ship $90 vs replace $400" — is incomplete if there's a meaningful chance the item won't survive the journey at all. An item that costs $400 to replace but only has a 60% probability of arriving usable has an effective replacement cost much higher than its sticker price suggests, because the user might end up paying both costs (the shipping AND the replacement, when the shipped item arrives ruined).
>
> Cernita treats preservation as a first-class consideration:
>
> - The AI evaluation flags items with meaningful deterioration risk and surfaces it in the rationale, not as a footnote
> - The user is told what packing precautions a vulnerable item requires (plastic bin, desiccant, plastic wrap, zip-lock, climate-aware storage)
> - When deterioration risk is high enough that survival probability becomes a real factor, the math acknowledges it — confidence drops, alternatives (carry via suitcase, give to family, sell now) gain weight in the rationale
> - The user always retains final authority. The principle is about honesty in the math, not paternalism in the recommendation.
>
> What this principle does NOT do:
>
> - It does not override Principle 1 (the user owns the decision). The user can ship a known-fragile item against the AI's caution.
> - It does not turn Cernita into a packing manual. Specific guidance is item-by-item, generated when relevant, not encoded as static knowledge.
> - It does not require the AI to refuse evaluations of high-risk items. It requires the AI to be honest about the risk, not silent.

## Why it matters

Three reasons preservation deserves constitutional standing rather than just feature-level treatment:

**1. It's a value about honesty, not a feature about packing.** Cernita's identity is built on honest math (Principle 2). Preservation isn't a separate concern — it's a missing factor in the math we already claim to do honestly. Without acknowledging deterioration probability, the cost comparisons we show the user are incomplete. Adding it as a principle makes our existing claim to honest math actually true.

**2. It has cross-cutting implications.** Preservation isn't one feature; it's a lens applied to many features:
   - The AI prompt (preservation flags in evaluation)
   - The decision rules (`deriveDecision()` factors deterioration into confidence)
   - The packing UI (warnings about cardboard vs plastic, packing instructions)
   - The Bins/location views (visual indicators for vulnerable items)
   - Future customs documentation (preservation status as evidence of due care)
   - Future insurance manifests (deterioration affects valuation)
   
   A principle anchors all of these. Without it, each feature would have to argue independently for its preservation behavior.

**3. It catches a real failure mode of the existing app.** Today's Cernita could recommend KEEP-ITALY for a vintage leather jacket on the basis of "ship $50 vs replace $400" while the jacket sits 18 months in a humid Galesburg storage unit and arrives in Italy ruined. The user followed the math; the math was incomplete. Adding Principle 13 prevents this failure by requiring the math to acknowledge the risk. The principle has teeth — it changes outcomes, it doesn't just describe them.

## What becomes possible

With Principle 13 in the Constitution:

- **The preservation spec** has constitutional grounding. It implements a principle, not just a feature request.
- **The AI prompt** can be updated to flag deterioration risk as a routine output, not an optional one.
- **`deriveDecision()`** can adjust confidence based on preservation flags without seeming arbitrary.
- **The packing UI** can warn users about box material mismatches with constitutional weight ("this item needs preservation per Principle 13").
- **Future specs** (customs PDF, insurance manifest, climate-controlled storage cost calculations) can reference the principle naturally.

## What becomes impossible (or at least harder)

With Principle 13 in the Constitution, certain shortcuts become harder to justify:

- **A "ignore preservation, just show cost math" toggle** would now require an amendment to override Principle 13. We're committing to honest math as a default, not as an option.
- **An AI prompt that treats deterioration as a footnote** (e.g., adding it to a notes field but not to the rationale or the decision) would now violate the principle. Preservation has to be in the main reasoning.
- **A future feature that prioritizes ease of decision over honest cost** (e.g., a "quick mode" that skips preservation analysis to get faster answers) would have to argue against the principle, not just propose itself as convenient.

These limits are intentional. The principle exists to prevent shortcuts that would make Cernita's math dishonest.

## Migration impact

The amendment itself doesn't change any code. It changes the standard against which future code is judged.

But it does retroactively justify some existing behavior:
- The `handling_warnings` field already exists in the schema and the AI prompt already populates it for some preservation concerns. Principle 13 makes this explicit and required, not optional.
- The "human review flags" output already includes some preservation-adjacent flags (cannot survive storage, archival storage). Principle 13 elevates these from edge-case warnings to first-class outputs.

The preservation spec (forthcoming, separate document) is the implementation of this amendment. Without the amendment, the spec would be an isolated feature. With it, the spec becomes a clarification of how Cernita already (in principle) operates.

## Discussion notes

**Why a separate principle rather than expanding Principle 2 (honest math)?**

Principle 2 already says "honest math, always shown" — but it's about computational transparency (showing the user the inputs and outputs, no hidden assumptions). Preservation is about a *missing variable* in the math, not about how the math is shown. They're related but distinct: Principle 2 is "show the math," Principle 13 is "include all the factors." Trying to fold preservation into Principle 2 would dilute both.

**Why a separate principle rather than expanding Principle 9 (safety)?**

Principle 9 is about user safety (suicide, harmful content, privacy). Preservation is about *item* safety, which is a different concept. Conflating them would weaken Principle 9's clarity.

**Could this be a "core insight" rather than a principle?**

Possibly. But Cernita's principles are normative ("Cernita does X"), not descriptive ("Cernita observes Y"). Preservation is normative — it's a commitment about how the math is done. That's principle territory.

**Is "probability that an item survives" too uncertain to be honest math?**

It's uncertain, yes. But uncertainty is no excuse for ignoring a factor. The honest move is to estimate the probability, communicate the uncertainty, and let the user decide. Principle 13 commits us to this. Pretending the probability doesn't exist is the dishonest alternative.

## Decision required

Per PROCESS.md, Constitution amendments need explicit acceptance. To accept this amendment:

1. Acknowledge in conversation that the amendment is accepted
2. The Constitution is updated to v1.4 with Principle 13 added
3. The amendment proposal status moves to "accepted"
4. The preservation spec can then proceed with constitutional grounding

To reject: state the rejection and reasoning. Amendment status moves to "rejected." The preservation spec can still be drafted but without principle-level support — it would have to argue for each of its decisions on its own terms.

## Suggested principle wording (final)

Below is the wording I'd add to CONSTITUTION.md. Slightly tightened from the lead version above for the actual document:

> **Principle 13 — Preservation is part of the math**
>
> Items deteriorate in storage and during transit. Wood warps. Leather molds. Vinyl warps. Foam crumbles. Electronics corrode. Paper fades.
>
> Cernita treats preservation as a first-class consideration in evaluation:
> - The AI flags meaningful deterioration risk in the rationale, not as a footnote
> - The user is told what packing precautions a vulnerable item requires
> - When survival probability is genuinely in doubt, confidence drops and alternatives gain weight in the comparison
> - The user retains final authority. This principle is about honesty in the math, not paternalism in the recommendation.
>
> The simple comparison "ship $90 vs replace $400" is incomplete when an item has a meaningful chance of arriving unusable. Cernita's commitment to honest math (Principle 2) requires that survival probability be one of the factors, not an unstated assumption.
