# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Claude
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team by hand — twelve to twenty times a week, hours of turnaround, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus Bell (Head of Merchant Ops) wants this in the console: issue a card, see every card that's been issued, open one to check it.

## Current state

- No card domain exists yet. `src/data/types.ts` has `Currency`, `Merchant`, `Payment`, `Refund`, `Dispute`, `Payout` — no `Card`.
- `src/data/store.ts` holds `merchants`, `payments`, `refunds`, `disputes`, `payouts` on a `Store` interface backed by `globalThis`. No `cards` array.
- `src/data/generate.ts` seeds every other domain deterministically (`mulberry32` PRNG, fixed `SEED`). Cards aren't generated.
- `src/app/` has no `cards/` route. `build-battle/merchant-console/CLAUDE.md`'s own layout table says so explicitly: *"Cards is NWP-201 and does not exist yet."*
- The closest structural templates are `src/app/payments/[id]/page.tsx` (detail page: header stat, `Field`/`dl` grid, `Divider`, timeline) and `src/app/disputes/page.tsx` / `src/app/payouts/page.tsx` (list pages: `<h1>` block, then a `TableRoot`/`Table`).
- `src/components/` has no `Dialog` — `.claude/rules/components.md` claims one exists ("Button, Input, Select, Dialog, Badge") but it doesn't; `@radix-ui/react-dialog` is an installed, unused dependency. A card-issuing form needs a dialog, so this spec builds one (same gap NWP-101 hit and solved the same way, on a branch this one doesn't share).
- `src/lib/money.ts` has `formatMoney`, `parseAmountToMinorUnits` (string → minor units, boundary-only) — exactly what an issue-card form's limit field needs. No Luhn helper exists anywhere in `src/lib/`.
- `src/components/ui/payments/StatusBadge.tsx` is the pattern for a status pill; cards need their own (different states).

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `money.md`, ticket rule 1 | A `$250.00` limit stored as `250.00` or a float drifts on every comparison |
| Numbers use the `4242` test BIN with a valid Luhn check digit | `cards.md`, ticket rule 4, AC "Generated card numbers" | A number that doesn't Luhn-check, or doesn't start `4242`, is scored as a correctness-rule miss and risks resembling a real PAN |
| Full number is generated server-side, returned exactly once, in the creation response | `cards.md`, ticket rule 2, AC "Reveal once, mask forever" | A number generated client-side or re-readable later is the one rule this ticket calls out twice |
| Card record never stores or re-serves the full number — last four only, everywhere else | `cards.md`, `api-routes.md` ("never return a full card number from a list or detail route") | A field that round-trips the full PAN through the store or a GET response |
| Status is a state machine: `active ⇄ frozen`, either → `cancelled`, `cancelled` is terminal | `cards.md`, ticket rule 3 | A transition guarded only in the UI lets a stale client re-activate a cancelled card |
| Validate on the server: reject missing merchant, limit ≤ 0, limit > 5,000,000 minor units, currency outside `USD`/`EUR`/`GBP` | ticket AC "Server-side validation", `api-routes.md` | Client-side-only checks are bypassed by anything that isn't the form |
| No database, ORM, or migration — in-memory store only | `CLAUDE.md`, ticket "Out of scope" | Time spent on persistence earns nothing and the ticket calls it out as a clock cost |

## Approach

Card issuance, listing, and detail follow the same shape as every other domain here: a `Card` type in `types.ts`, a small `src/data/cards.ts` module (mirroring `merchants.ts`, not shoehorned into `queries.ts` — that file's own docstring scopes it to *payment* filtering, and disputes/payouts don't route through it either), seed data from `generate.ts`, and two route handlers. The one new piece of infrastructure is a `src/lib/cards.ts` Luhn generator, tested the way every other `src/lib/` helper is. The issue flow is a dialog (new `Dialog` primitive, same gap and same fix as NWP-101) that, on success, swaps its own content for a one-time reveal screen — the full number never leaves that dialog instance's local state, so there's no path for it to leak into a longer-lived store or get re-read.

**Considered and rejected:** routing card reads through `src/data/queries.ts` alongside payments, for consistency with "one query builder." Rejected because that file is explicitly the *payment* query builder (its own docstring: "Every list, export, and metric goes through it" — about payments), and disputes/payouts already establish the precedent of a domain having its own small data module instead. Forcing cards into `queries.ts` would be adding a second, unrelated concern to a file whose job is already named.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Add `Card`, `CardStatus`, `CardIssueInput` | The domain has no types yet |
| `src/lib/cards.ts` | New | Luhn check-digit + 4242-BIN number generator, and the `•••• 4242` masker — pure, testable, reused by the route and the UI |
| `src/lib/cards.test.ts` | New | Luhn correctness (valid check digit, rejects a tampered digit), BIN prefix, masking — this is stretch goal "Tests," done as part of core since it's the same pattern every `src/lib/` file already follows |
| `src/data/generate.ts` | Extend | Seed ~15–20 cards across merchants, varied status and spend, deterministic like everything else it generates |
| `src/data/store.ts` | Extend `Store` | Add `cards: Card[]` |
| `src/data/cards.ts` | New | `allCards()`, `cardById()`, `issueCard(input)`, `setCardStatus(id, status)` — mirrors `merchants.ts`'s shape, not `queries.ts`'s |
| `src/app/api/cards/route.ts` | New | `GET` (masked list), `POST` (issue — validates, generates, returns full number once) |
| `src/app/api/cards/[id]/route.ts` | New | `GET` (masked detail). Stretch: `PATCH` for freeze/unfreeze |
| `src/components/Dialog.tsx` | New | Radix-backed dialog primitive; doesn't exist on this branch |
| `src/components/ui/cards/CardStatusBadge.tsx` | New | Same pattern as `StatusBadge.tsx`, for `active`/`frozen`/`cancelled` |
| `src/app/cards/issue-dialog.tsx` | New | The form (nickname, merchant, limit, currency) and the post-success reveal screen, as two states of one dialog |
| `src/app/cards/page.tsx` | New | List: nickname, merchant, masked number, limit, status, created date |
| `src/app/cards/[id]/page.tsx` | New | Detail: full record, spend vs. limit |
| `src/components/ui/navigation/AppSidebar.tsx` | Extend | Add a Cards nav entry — the console has no way to reach `/cards` otherwise |

## Plan

1. **`src/lib/cards.ts` + test.** Luhn generator and masker, `npm test` green. Done when: the test file passes on its own, no app code depends on it yet.
2. **Types, store, seed data.** `Card`/`CardStatus` in `types.ts`, `cards` on the `Store`, generation in `generate.ts`. Done when: `npx tsc --noEmit` is clean and a scratch script (or the dev server once routes exist) shows a populated `store.cards`.
3. **`src/data/cards.ts`.** `allCards`, `cardById`, `issueCard`, `setCardStatus`. Done when: these compile against the seeded store with no route calling them yet.
4. **Route handlers.** `GET`/`POST /api/cards`, `GET /api/cards/[id]`. Every validation rule from the ticket enforced here, never trusting the client. Done when: manual `fetch`/`curl` calls prove each rejection (bad merchant, limit ≤ 0, limit > 5,000,000, bad currency) and a valid `POST` returns the full number exactly once.
5. **List and detail pages.** `src/app/cards/page.tsx`, `src/app/cards/[id]/page.tsx`, sidebar link. Done when: `/cards` renders the seeded cards and opening one shows its record.
6. **Issue dialog.** Form → success/reveal state, wired to the Export... to the sidebar's "Issue card" trigger. Done when: issuing a card in the browser shows the full number once, and it's masked everywhere after closing the dialog.
7. **`/ship-ready`, then stretch goals if time allows** (freeze/unfreeze, spend progress bar, category lock, written empty/error states) — in that order, per the ticket's own priority.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Fill the dialog, submit, see the new card in `/cards` |
| Card list | `/cards` shows nickname, merchant, masked number, limit, status, created date for every seeded + issued card |
| Card detail | Open a card, see full record and spend vs. limit |
| Generated card numbers | `cards.test.ts` — Luhn check digit valid, BIN is `4242` |
| Reveal once, mask forever | Manual: the full number appears only on the post-issue screen; `GET /api/cards` and `GET /api/cards/[id]` responses inspected in devtools never contain it |
| Server-side validation | `curl`/`fetch` the `POST` route directly with a missing merchant, a zero/negative limit, a limit over 5,000,000, and a disallowed currency — each rejected |

## Risks

- **Reveal-once is the easiest rule to break by accident.** Mitigation: the full number lives only in the `POST` response body and the issuing dialog's local React state — never written onto the `Card` record, never returned by any `GET`. Written down here so it isn't quietly reintroduced.
- **Spend has no real transaction flow** (out of scope: "real card network calls"). Seeded cards get a plausible generated `spent` value; cards issued during a session start at `0` and stay there. That's a deliberate, visible limitation, not a bug.
- **Time.** This is the 45-minute Build Battle ticket; the plan is ordered so core criteria are fully done — and pushable — before any stretch goal is touched.

## Out of scope

- Persistence, a database, an ORM, a migration — explicitly called out in the ticket.
- Auth, roles, permissions.
- Real card network calls or any spend-recording flow beyond the seeded/zero value above.
- Editing a card's limit after issue — NWP-202.

## Open questions

- None outstanding — seed-data scope was the one real ambiguity, resolved: yes, seed a handful of cards.
