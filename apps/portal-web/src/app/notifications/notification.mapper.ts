import {
  NotificationItem,
  NotificationSeverity,
  NotificationCategory,
  NotificationSource,
} from '../models/notification-item.model';
import { AuditLogDetails } from '../models/security-event.model';
import { isAuditLogDetails } from './audit-log-details.guard';
import { normalizeSearchText, toPlainDisplayText } from './notification-text.util';

/**
 * Options for mapping AuditLogDetails to NotificationItem.
 */
export interface NotificationMappingOptions {
  /** Source of the notification (history or signalr) */
  source: NotificationSource;
  /** Expected event ID for validation (optional) */
  expectedEventId?: string;
  /** Event type hint for matching (optional) */
  eventTypeHint?: string;
  /** Expected tenant ID for validation (optional) */
  expectedTenantId?: string;
}

/**
 * Keywords for classification - order matters (first match wins)
 */
const CLASSIFICATION_RULES: Array<{
  keywords: string[];
  severity: NotificationSeverity;
  category: NotificationCategory;
  title: string;
}> = [
  {
    keywords: ['privilege'],
    severity: 'critical',
    category: 'privilege',
    title: 'Privilege modified',
  },
  {
    keywords: ['login', 'loginanomaly', 'anomaly'],
    severity: 'critical',
    category: 'authentication',
    title: 'Login anomaly detected',
  },
  {
    keywords: ['warning', 'failed'],
    severity: 'warning',
    category: 'security',
    title: 'Security warning',
  },
];

/**
 * Default classification for unknown actions
 */
const DEFAULT_CLASSIFICATION: {
  severity: NotificationSeverity;
  category: NotificationCategory;
  title: string;
} = {
  severity: 'info',
  category: 'system',
  title: 'System activity',
};

/**
 * Gets the classification based on the audit log's event type, action, and details.
 * Uses case-insensitive matching and checks in order of priority.
 */
function getClassification(
  eventType: string | null | undefined,
  action: string,
  details: string | null
): { severity: NotificationSeverity; category: NotificationCategory; title: string } {
  // Combine searchable fields (case-insensitive)
  const searchText = normalizeSearchText(
    [eventType, action, details].filter(Boolean).join(' ')
  );

  // Check each classification rule in priority order
  for (const rule of CLASSIFICATION_RULES) {
    for (const keyword of rule.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return {
          severity: rule.severity,
          category: rule.category,
          title: rule.title,
        };
      }
    }
  }

  return DEFAULT_CLASSIFICATION;
}

/**
 * Validates that the audit log has all required fields populated.
 */
function isValidAuditLog(
  auditLog: unknown,
  options: NotificationMappingOptions
): auditLog is AuditLogDetails {
  if (!isAuditLogDetails(auditLog)) {
    return false;
  }

  // Check required fields are non-empty (cast via unknown)
  const log = auditLog as unknown as Record<string, unknown>;
  if (!log['id'] || !(log['id'] as string).trim()) return false;
  if (!log['tenantId'] || !(log['tenantId'] as string).trim()) return false;
  if (!log['action'] || !(log['action'] as string).trim()) return false;

  // Validate expectedEventId if provided
  if (
    options.expectedEventId &&
    log['id'] !== options.expectedEventId
  ) {
    return false;
  }

  // Validate expectedTenantId if provided
  if (
    options.expectedTenantId &&
    log['tenantId'] !== options.expectedTenantId
  ) {
    return false;
  }

  return true;
}

/**
 * Maps an AuditLogDetails object to a NotificationItem.
 * Returns null if the input is invalid or validation fails.
 */
export function mapAuditLogToNotification(
  auditLog: unknown,
  options: NotificationMappingOptions
): NotificationItem | null {
  // Handle malformed input
  if (
    auditLog === null ||
    auditLog === undefined ||
    typeof auditLog !== 'object'
  ) {
    return null;
  }

  // Validate required fields
  if (!isValidAuditLog(auditLog, options)) {
    return null;
  }

  const log = auditLog as AuditLogDetails;
  const classification = getClassification(
    log.eventType,
    log.action,
    log.details
  );

  // Determine actor (userId or System)
  const actor = log.userId && log.userId.trim() ? log.userId : 'System';

  // Validate and format timestamp
  let timestamp: string;
  const inputTimestamp = log.timestamp;
  if (inputTimestamp && inputTimestamp.trim() && !isNaN(Date.parse(inputTimestamp))) {
    timestamp = inputTimestamp;
  } else {
    // Fall back to current time
    timestamp = new Date().toISOString();
  }

  // Generate title and summary from action/details
  const title = toPlainDisplayText(log.action, classification.title);
  const summary = toPlainDisplayText(log.details, title);

  return {
    id: log.id,
    tenantId: log.tenantId,
    eventType: log.eventType || log.action,
    severity: classification.severity,
    category: classification.category,
    title,
    summary,
    timestamp,
    actor,
    userId: log.userId || '',
    ipAddress: log.ipAddress,
    resourceId: log.resourceId,
    correlationId: log.correlationId,
    readAt: null,
    acknowledgedAt: null,
    source: options.source,
  };
}
