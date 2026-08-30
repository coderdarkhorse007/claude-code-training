"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/Button"
import { Checkbox } from "@/components/Checkbox"
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
import { cx, focusRing } from "@/lib/utils"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
} from "@/lib/csv"
import { Download } from "lucide-react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Date",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

/**
 * The Export button's options dialog (NWP-101). Column and scope choices
 * live here, client-side, purely for UX — the export route re-validates
 * both before anything is written to the file.
 */
export function ExportDialog({
  queryString,
  filteredCount,
  allCount,
}: {
  /** The payments page's current filters, as a query string, no `page`. */
  queryString: string
  filteredCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<"filtered" | "all">("filtered")

  const toggleColumn = (column: ExportColumn) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const columns = EXPORT_COLUMNS.filter((column) => selected.has(column))
  const rowCount = scope === "filtered" ? filteredCount : allCount

  const href = useMemo(() => {
    const params = new URLSearchParams(queryString)
    params.set("scope", scope)
    params.set("columns", columns.join(","))
    return `/api/payments/export?${params.toString()}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString, scope, columns.join(",")])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export payments</DialogTitle>
          <DialogDescription>
            Choose the columns and the scope. Card last four is off by
            default.
          </DialogDescription>
        </DialogHeader>

        <fieldset>
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Columns
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {EXPORT_COLUMNS.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <Checkbox
                  checked={selected.has(column)}
                  onChange={() => toggleColumn(column)}
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Scope
          </legend>
          <div className="mt-3 space-y-2.5">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                className={cx(
                  "size-4 border-gray-300 text-blue-500 dark:border-gray-800 dark:bg-gray-950",
                  focusRing,
                )}
                checked={scope === "filtered"}
                onChange={() => setScope("filtered")}
              />
              Current filter — {filteredCount.toLocaleString()} payments
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                className={cx(
                  "size-4 border-gray-300 text-blue-500 dark:border-gray-800 dark:bg-gray-950",
                  focusRing,
                )}
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              All payments — {allCount.toLocaleString()} payments
            </label>
          </div>
        </fieldset>

        <p className="mt-5 text-sm text-gray-500">
          {columns.length === 0
            ? "Select at least one column to download."
            : `${rowCount.toLocaleString()} row${rowCount === 1 ? "" : "s"} will be exported.`}
        </p>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="primary"
            className="py-1.5"
            disabled={columns.length === 0}
            asChild={columns.length > 0}
          >
            {columns.length > 0 ? <a href={href}>Download</a> : <span>Download</span>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
