import { allCards, issueCard } from "@/data/cards"
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
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const { merchantId, nickname, spendLimit, currency } = body as Record<
    string,
    unknown
  >

  if (typeof merchantId !== "string" || !merchantById(merchantId)) {
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

  const { card, number } = issueCard({
    merchantId,
    nickname: nickname.trim(),
    spendLimit: limit,
    currency: currency as Currency,
  })

  return NextResponse.json({ card, number }, { status: 201 })
}
