import { cardById, setCardStatus } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

/** A card's detail. Masked, same as the list — no route ever returns the full number. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 })
  }
  return NextResponse.json(card)
}

/** Freeze, unfreeze, or cancel. The state machine is guarded here, not just in the UI. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const status = body && typeof body === "object" ? (body as Record<string, unknown>).status : null

  if (typeof status !== "string" || !STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { error: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const existing = cardById(id)
  if (!existing) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 })
  }

  const updated = setCardStatus(id, status as CardStatus)
  if (!updated) {
    return NextResponse.json(
      { error: `Cannot move a ${existing.status} card to ${status}.` },
      { status: 400 },
    )
  }

  return NextResponse.json(updated)
}
