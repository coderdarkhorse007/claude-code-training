import { merchantById } from "@/data/merchants"
import { Payment, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Card last four is opted
 * in, not opted out, since a file bound for a merchant used to need manual
 * cleanup first.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

/** Every column except last4 — the safe-to-share default. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Column names arrive from the client — request query params, eventually a
 * dialog's checkbox state. Never trust them past this. `null` (the param was
 * absent) falls back to the default set; an explicit list, including an
 * empty one, is filtered to the allowlist and returned in the order given.
 */
export function resolveExportColumns(
  requested: readonly string[] | null,
): readonly ExportColumn[] {
  if (requested === null) return DEFAULT_EXPORT_COLUMNS
  const allowed: readonly string[] = EXPORT_COLUMNS
  return requested.filter((column): column is ExportColumn =>
    allowed.includes(column),
  )
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

export function exportFilename(
  date = new Date(),
  {
    scope = "filtered",
    status = "all",
  }: { scope?: "filtered" | "all"; status?: PaymentStatus | "all" } = {},
): string {
  const day = date.toISOString().slice(0, 10)
  if (scope === "all") return `payments-all-${day}.csv`
  if (status !== "all") return `payments-${status}-${day}.csv`
  return `payments-${day}.csv`
}
