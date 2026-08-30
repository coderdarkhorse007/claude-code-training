"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { merchants } from "@/data/merchants"
import { Currency } from "@/data/types"
import { useRouter } from "next/navigation"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

/**
 * Issues a card (NWP-201). Two states of one dialog: the form, then —
 * on success — the one-time reveal. The full number lives only in this
 * component's own state and is discarded when the dialog closes; it is
 * never written back onto the card record.
 */
export function IssueCardDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [spendLimit, setSpendLimit] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<{ number: string; last4: string } | null>(
    null,
  )
  // One key per open dialog, not per keystroke or per click — a double
  // submit of the same attempt reuses it, so the server can recognize the
  // retry instead of issuing a second card. Doesn't need to be state: it
  // never drives a render.
  const idempotencyKey = useRef("")

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setCurrency("USD")
    setSpendLimit("")
    setError(null)
    setRevealed(null)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) idempotencyKey.current = crypto.randomUUID()
    else reset()
  }

  const handleMerchantChange = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  const canSubmit =
    nickname.trim().length > 0 && merchantId.length > 0 && spendLimit.trim().length > 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const res = await fetch("/api/cards", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey.current,
      },
      body: JSON.stringify({ merchantId, nickname, spendLimit, currency }),
    })
    const body = await res.json()

    if (!res.ok) {
      setError(body.error ?? "Something went wrong.")
      setSubmitting(false)
      return
    }

    setRevealed({ number: body.number, last4: body.card.last4 })
    setSubmitting(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="primary" className="py-1.5">
          Issue card
        </Button>
      </DialogTrigger>

      <DialogContent>
        {revealed ? (
          <>
            <DialogHeader>
              <DialogTitle>Card issued</DialogTitle>
              <DialogDescription>
                This is the only time the full number is shown. It will read{" "}
                <span className="font-mono">•••• {revealed.last4}</span>{" "}
                everywhere else, from now on.
              </DialogDescription>
            </DialogHeader>
            <p className="rounded-md border border-gray-200 bg-gray-50 p-3 text-center font-mono text-lg tracking-wider text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50">
              {revealed.number}
            </p>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="primary" className="py-1.5">
                  Done
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Issue a card</DialogTitle>
              <DialogDescription>
                Single-merchant, always virtual, with a limit from the moment
                it exists.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-gray-900 dark:text-gray-50">
                  Nickname
                </span>
                <Input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ad spend"
                  required
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-gray-900 dark:text-gray-50">
                  Merchant
                </span>
                <Select value={merchantId} onValueChange={handleMerchantChange}>
                  <SelectTrigger aria-label="Merchant">
                    <SelectValue placeholder="Select a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-gray-900 dark:text-gray-50">
                    Spend limit
                  </span>
                  <Input
                    value={spendLimit}
                    onChange={(event) => setSpendLimit(event.target.value)}
                    placeholder="250.00"
                    inputMode="decimal"
                    required
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-gray-900 dark:text-gray-50">
                    Currency
                  </span>
                  <Select value={currency} disabled>
                    <SelectTrigger aria-label="Currency, set by the selected merchant">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="mt-1 block text-xs text-gray-500">
                    Follows the merchant
                  </span>
                </label>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-500">{error}</p>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary" className="py-1.5" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="primary"
                className="py-1.5"
                type="submit"
                disabled={!canSubmit || submitting}
                isLoading={submitting}
              >
                Issue card
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
