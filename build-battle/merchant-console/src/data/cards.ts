import { generateCardNumber, lastFour } from "@/lib/cards"
import { store } from "./store"
import { Card, CardIssueInput, CardStatus } from "./types"

/**
 * Card reads and writes. A small module of its own, the same shape as
 * merchants.ts — not folded into queries.ts, which is the payments query
 * builder specifically, not a general one.
 */

let seq = store.cards.length

export function allCards(): Card[] {
  return store.cards
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

/**
 * Idempotency keys seen by issueCard. "pending" while a request for that
 * key is being processed, a card id once it completes. On globalThis for
 * the same reason store.ts is: Next's dev-server module reloading must
 * not hand a retried request a second, empty map.
 *
 * claimIdempotencyKey is synchronous end to end — no await inside it —
 * which is what makes it safe against two genuinely concurrent requests
 * for the same key: Node runs one call to completion before the other's
 * code can start, so there is no window for both to observe "unclaimed."
 * The route that owns this: check-then-record across an await is not
 * good enough, because both requests can pass the check before either
 * finishes recording.
 */
declare global {
  // eslint-disable-next-line no-var
  var __northwindIssuedKeys: Map<string, "pending" | string> | undefined
}
const issuedKeys: Map<string, "pending" | string> =
  globalThis.__northwindIssuedKeys ?? new Map()
if (process.env.NODE_ENV !== "production") {
  globalThis.__northwindIssuedKeys = issuedKeys
}

/** Claims a key for a new attempt, atomically. */
export function claimIdempotencyKey(key: string): "claimed" | "pending" | "duplicate" {
  const existing = issuedKeys.get(key)
  if (existing === "pending") return "pending"
  if (existing !== undefined) return "duplicate"
  issuedKeys.set(key, "pending")
  return "claimed"
}

/** Releases a claim that didn't end in a card — a failed validation, not a race. */
export function releaseIdempotencyKey(key: string): void {
  if (issuedKeys.get(key) === "pending") issuedKeys.delete(key)
}

/** The card already issued for this idempotency key, once claim resolved to one. */
export function cardForIdempotencyKey(key: string): Card | null {
  const id = issuedKeys.get(key)
  return id && id !== "pending" ? cardById(id) : null
}

/**
 * Generates the number, stores only its last four, and returns the full
 * number alongside the record — this is the one place it ever exists
 * outside a database column that isn't there. Callers must not persist it
 * or return it from anywhere but this call's own response.
 *
 * `idempotencyKey`, when given, must already be "pending" (claimed via
 * claimIdempotencyKey before any other work started) — this call resolves
 * that claim to the card it produced.
 */
export function issueCard(
  input: CardIssueInput,
  idempotencyKey?: string,
): { card: Card; number: string } {
  const number = generateCardNumber()
  const card: Card = {
    id: `card_${String(++seq).padStart(4, "0")}`,
    merchantId: input.merchantId,
    nickname: input.nickname,
    last4: lastFour(number),
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)
  if (idempotencyKey) issuedKeys.set(idempotencyKey, card.id)
  return { card, number }
}

const TRANSITIONS: Record<CardStatus, CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

/** Guards the state machine server-side. Returns null on an illegal transition. */
export function setCardStatus(id: string, next: CardStatus): Card | null {
  const card = cardById(id)
  if (!card) return null
  if (!TRANSITIONS[card.status].includes(next)) return null
  card.status = next
  return card
}
