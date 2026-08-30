/**
 * Card number generation and masking.
 *
 * Every generated number starts with the 4242 test BIN and carries a valid
 * Luhn check digit — nothing here may resemble a real PAN. Numbers are
 * generated here, on the server; the full number is returned exactly once,
 * by the issuing route, and never stored on the card record.
 */

export const CARD_BIN = "4242"
const CARD_NUMBER_LENGTH = 16

/** True if `digits` (a string of digits) satisfies the Luhn checksum. */
export function luhnValid(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

/** The check digit that makes `partial + digit` pass Luhn. */
function luhnCheckDigit(partial: string): number {
  let sum = 0
  for (let i = 0; i < partial.length; i++) {
    let digit = Number(partial[partial.length - 1 - i])
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

/**
 * A full, Luhn-valid card number on the 4242 test BIN.
 * `random` is injectable so seed data can generate deterministically.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let middle = ""
  for (let i = 0; i < CARD_NUMBER_LENGTH - CARD_BIN.length - 1; i++) {
    middle += Math.floor(random() * 10)
  }
  const partial = CARD_BIN + middle
  return partial + luhnCheckDigit(partial)
}

/** The last four digits of a full card number — the only part ever stored. */
export function lastFour(cardNumber: string): string {
  return cardNumber.slice(-4)
}

/** How a card number is shown everywhere except the one-time reveal. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}
