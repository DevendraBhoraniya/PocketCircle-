/**
 * PocketCircle Decimal Currency Utilities
 * 
 * Enforces zero floating-point arithmetic for currency calculations.
 * All math is conducted using exact integer paisa arithmetic (1 Rupee = 100 Paisa).
 */

/**
 * Parses a decimal currency string (e.g., "12.34", "10", "0.5") into an exact integer of paisa.
 * Returns null if the format is invalid or represents a negative amount.
 */
export function parseToPaisa(amountStr: string): number | null {
  const trimmed = amountStr.trim();
  if (!trimmed) return null;

  // Enforce numeric decimal format with 0 to 2 decimal digits
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  const [rupeesPart, paisePart = ""] = trimmed.split(".");
  const rupees = parseInt(rupeesPart, 10);
  if (isNaN(rupees)) return null;

  const paise = parseInt(paisePart.padEnd(2, "0"), 10);
  return rupees * 100 + paise;
}

/**
 * Formats an integer paisa amount back to standard 2-decimal string format (e.g., 10050 -> "100.50").
 */
export function formatPaisaToString(paisa: number): string {
  const sign = paisa < 0 ? "-" : "";
  const abs = Math.abs(paisa);
  const rupees = Math.floor(abs / 100);
  const paise = (abs % 100).toString().padStart(2, "0");
  return `${sign}${rupees}.${paise}`;
}

/**
 * Safely formats a decimal amount string or number to "X.XX" with exact 2 decimals.
 */
export function formatCurrency(amount: string | number): string {
  if (typeof amount === "number") {
    return formatPaisaToString(Math.round(amount * 100));
  }
  const paisa = parseToPaisa(amount);
  if (paisa !== null) {
    return formatPaisaToString(paisa);
  }
  return amount;
}
