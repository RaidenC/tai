import { AuditLogDetails } from '../models/security-event.model';

/**
 * Type guard to check if a value is a valid AuditLogDetails object.
 * Validates that the object has required non-empty string fields.
 * Note: timestamp is not required here - it can be empty and will fall back to current time.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Extracts tenantId as string, handling both string and object formats.
 * Object format: { value: "tenant-123" }
 */
function extractTenantId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    return (value as Record<string, unknown>)['value'] as string;
  }
  return undefined;
}

/**
 * Type guard to check if a value is a valid AuditLogDetails object.
 * Validates that the object has required non-empty string fields.
 * Note: timestamp is optional - it can be empty and will fall back to current time during mapping.
 */
export function isAuditLogDetails(value: unknown): value is AuditLogDetails {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const tenantIdValue = extractTenantId(candidate['tenantId']);
  return (
    isNonEmptyString(candidate['id']) &&
    isNonEmptyString(tenantIdValue) &&
    isNonEmptyString(candidate['action']) &&
    isNonEmptyString(candidate['resourceId'])
    // Note: timestamp is NOT required here - it can be empty and will fall back to current time
  );
}
