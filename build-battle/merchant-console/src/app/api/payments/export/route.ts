import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, resolveExportColumns, toCsv } from "@/lib/csv"
import { NextRequest } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Reuses the query builder for both scopes — "all payments" is the same
 * filterPayments() called with no filters, not a second query path. Column
 * names come from the client and are re-validated against the allowlist
 * here rather than trusted from the request.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const scope = params.get("scope") === "all" ? "all" : "filtered"

  const requestedColumns = params.has("columns")
    ? params.get("columns")!.split(",").filter(Boolean)
    : null
  const columns = resolveExportColumns(requestedColumns)
  if (columns.length === 0) {
    return new Response("Select at least one column to export.", {
      status: 400,
    })
  }

  const rows = sortPayments(
    scope === "all" ? filterPayments({}) : filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), { scope, status: filters.status })}"`,
    },
  })
}
