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
 * Generates the number, stores only its last four, and returns the full
 * number alongside the record — this is the one place it ever exists
 * outside a database column that isn't there. Callers must not persist it
 * or return it from anywhere but this call's own response.
 */
export function issueCard(input: CardIssueInput): { card: Card; number: string } {
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
