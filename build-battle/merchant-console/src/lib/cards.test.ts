import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  generateCardNumber,
  lastFour,
  luhnValid,
  maskCardNumber,
} from "./cards"

/**
 * A generated number that fails Luhn or doesn't carry the 4242 test BIN is
 * the one correctness rule this ticket calls out twice — nothing here may
 * resemble a real PAN.
 */

describe("generateCardNumber", () => {
  it("starts with the 4242 test BIN", () => {
    expect(generateCardNumber().startsWith(CARD_BIN)).toBe(true)
  })

  it("is 16 digits", () => {
    expect(generateCardNumber()).toHaveLength(16)
  })

  it("carries a valid Luhn check digit", () => {
    expect(luhnValid(generateCardNumber())).toBe(true)
  })

  it("is deterministic when given a seeded random source", () => {
    const seeded = () => 0.5
    expect(generateCardNumber(seeded)).toBe(generateCardNumber(seeded))
  })
})

describe("luhnValid", () => {
  it("accepts a known-valid number", () => {
    expect(luhnValid("4242424242424242")).toBe(true)
  })

  it("rejects the same number with one digit tampered", () => {
    expect(luhnValid("4242424242424241")).toBe(false)
  })
})

describe("lastFour", () => {
  it("takes the last four digits of a full number", () => {
    expect(lastFour("4242424242424242")).toBe("4242")
  })
})

describe("maskCardNumber", () => {
  it("shows only the last four, everywhere but the reveal", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})
