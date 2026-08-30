// Tremor Checkbox [v0.0.1]

import * as React from "react"

import { cx, focusRing } from "@/lib/utils"

const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<"input">
>(({ className, ...props }, forwardedRef) => (
  <input
    ref={forwardedRef}
    type="checkbox"
    className={cx(
      "size-4 rounded border-gray-300 text-blue-500 shadow-sm dark:border-gray-800",
      "dark:bg-gray-950 dark:checked:border-blue-500 dark:checked:bg-blue-500",
      focusRing,
      className,
    )}
    {...props}
  />
))
Checkbox.displayName = "Checkbox"

export { Checkbox }
