"use client"

import { useState } from "react"
import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"

/**
 * Freeze/unfreeze from the list, no full page reload — the PATCH route
 * already guards the state machine server-side; this just calls it and
 * refreshes the server data in place. Cancelled is terminal, so it renders
 * nothing for a cancelled card rather than a control that would 400.
 */
export function CardStatusToggle({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  if (status === "cancelled") return null

  const next: CardStatus = status === "active" ? "frozen" : "active"
  const label = status === "active" ? "Freeze" : "Unfreeze"

  const toggle = async () => {
    setPending(true)
    const res = await fetch(`/api/cards/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
    setPending(false)
    if (res.ok) router.refresh()
  }

  return (
    <Button
      variant="ghost"
      className="px-2 py-1 text-xs"
      onClick={toggle}
      isLoading={pending}
      loadingText={label}
    >
      {label}
    </Button>
  )
}
