/**
 * Text utilities for notification display text processing.
 * Converts various case formats to plain text and normalizes search text.
 */

/**
 * Converts a value to plain display text by normalizing whitespace and stripping HTML.
 * Handles camelCase, PascalCase, snake_case, and kebab-case by converting to space-separated lowercase words.
 * @param value - The value to convert to plain text
 * @param fallback - Fallback text if value is not a valid string or after processing is empty
 * @returns Plain text representation or fallback
 */
export function toPlainDisplayText(value: unknown, fallback: string = ''): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value
    // Strip HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Remove control characters
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    // Normalize various case formats to spaces
    .replace(/([a-z])([A-Z])/g, '$1 $2')   // camelCase -> camel Case
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // PascalCase -> Pascal Case
    .replace(/_/g, ' ')                      // snake_case -> snake case
    .replace(/-/g, ' ')                      // kebab-case -> kebab case
    // Convert to lowercase
    .toLowerCase()
    // Collapse multiple whitespace
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.length > 0 ? normalized : fallback;
}

/**
 * Normalizes a value for search by converting to lowercase and trimming whitespace.
 * @param value - The value to normalize for search
 * @returns Normalized search text or empty string for invalid input
 */
export function normalizeSearchText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
