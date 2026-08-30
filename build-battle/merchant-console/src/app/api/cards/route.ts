import {
  allCards,
  cardForIdempotencyKey,
  claimIdempotencyKey,
  issueCard,
  releaseIdempotencyKey,
} from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { Currency } from "@/data/types"
import { parseAmountToMinorUnits } from "@/lib/money"
import { NextRequest, NextResponse } from "next/server"

const ALLOWED_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const MAX_SPEND_LIMIT = 5_000_000

/**
 * Lists every issued card. Card objects carry last4 only — there is no
 * field on the type for a full number, so there's nothing here to leak.
 */
export function GET() {
  return NextResponse.json(allCards())
}

/**
 * Issues a card. Every check here runs against the request body, not the
 * client's own validation — merchant, limit, and currency are all
 * re-checked before anything is generated or stored.
 *
 * An Idempotency-Key header, when present, guards against a double-click
 * or a network retry producing two cards for one submission. The claim
 * happens before any `await` in this function, synchronously — that's
 * what makes it correct for two genuinely concurrent requests, not just
 * sequential retries. Checking, then awaiting the body, then recording
 * the key is not enough: both requests can pass the check before either
 * finishes recording.
 */
export async function POST(request: NextRequest) {
  const rawKey = request.headers.get("idempotency-key")
  const key = rawKey && rawKey.length > 0 && rawKey.length <= 200 ? rawKey : null

  if (key) {
    const claim = claimIdempotencyKey(key)
    if (claim === "duplicate") {
      return NextResponse.json(
        { error: "This card was already issued.", card: cardForIdempotencyKey(key) },
        { status: 409 },
      )
    }
    if (claim === "pending") {
      return NextResponse.json(
        { error: "This card is already being issued." },
        { status: 409 },
      )
    }
  }

  let issued = false
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }

    const { merchantId, nickname, spendLimit, currency } = body as Record<
      string,
      unknown
    >

    const merchant = typeof merchantId === "string" ? merchantById(merchantId) : undefined
    if (!merchant) {
      return NextResponse.json({ error: "Select a merchant." }, { status: 400 })
    }

    if (typeof nickname !== "string" || nickname.trim().length === 0) {
      return NextResponse.json({ error: "Give the card a nickname." }, { status: 400 })
    }

    if (typeof currency !== "string" || !ALLOWED_CURRENCIES.includes(currency as Currency)) {
      return NextResponse.json(
        { error: "Currency must be USD, EUR, or GBP." },
        { status: 400 },
      )
    }
    if (currency !== merchant.currency) {
      return NextResponse.json(
        { error: `${merchant.name} settles in ${merchant.currency}. A card for them can't be issued in ${currency}.` },
        { status: 400 },
      )
    }

    const limit =
      typeof spendLimit === "string"
        ? parseAmountToMinorUnits(spendLimit)
        : null
    if (limit === null || limit <= 0) {
      return NextResponse.json(
        { error: "Spend limit must be a positive amount." },
        { status: 400 },
      )
    }
    if (limit > MAX_SPEND_LIMIT) {
      return NextResponse.json(
        { error: "Spend limit cannot exceed 50,000.00." },
        { status: 400 },
      )
    }

    const { card, number } = issueCard(
      {
        merchantId: merchant.id,
        nickname: nickname.trim(),
        spendLimit: limit,
        currency: merchant.currency,
      },
      key ?? undefined,
    )
    issued = true

    return NextResponse.json({ card, number }, { status: 201 })
  } finally {
    // A validation failure shouldn't permanently lock out a legitimate
    // retry with corrected data — only a completed issue keeps the claim.
    if (key && !issued) releaseIdempotencyKey(key)
  }
}
