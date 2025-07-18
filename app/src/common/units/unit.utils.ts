import { AllUnits, Unit } from './unit.enums';

export interface ParsedQuantity {
  value: number | null;
  unit: Unit | null;
}

/**
 * Parses a quantity string (e.g., "500g", "1.5 l") into a numeric value and a recognized unit.
 * @param quantityString The string to parse.
 * @returns An object containing the parsed value and unit, or null if parsing fails.
 */
export function parseQuantity(
  quantityString: string | undefined | null,
): ParsedQuantity {
  if (!quantityString) {
    return { value: null, unit: null };
  }

  // Regex to capture the first number and the subsequent unit, ignoring the rest.
  const match = quantityString.trim().match(/^([\d.,]+)\s*([a-zA-Z]+)/);

  if (!match) {
    return { value: null, unit: null };
  }

  const [, valueStr, unitStr] = match;

  // Normalize the number string (e.g., replace ',' with '.') before parsing.
  const normalizedValueStr = valueStr.replace(',', '.');
  const value = parseFloat(normalizedValueStr);

  // Normalize the unit string to match against our enum.
  const normalizedUnit = unitStr.toLowerCase().replace(/[^a-z]/g, '');

  // Find the corresponding unit in our enum values
  const foundUnit = (AllUnits as string[]).find(
    (u) => u.toLowerCase() === normalizedUnit,
  );

  if (!foundUnit) {
    return { value, unit: null }; // Return value even if unit is not recognized
  }

  return { value, unit: foundUnit as Unit };
}
