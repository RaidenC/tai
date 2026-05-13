/**
 * Notification item optimized for display in NotificationPanel
 */
export interface NotificationPanelItem {
  id: string;
  title: string;
  summary: string | null;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  actor: string;
  timestamp: string;
  userId?: string | null;
  readAt: string | null;
  acknowledgedAt: string | null;
}

/**
 * Full audit log details (deprecated - use NotificationPanelItem)
 * @deprecated Use NotificationPanelItem instead
 */
export interface AuditLogDetails {
  id: string;
  tenantId: string;
  userId?: string | null;
  action: string;
  resourceId: string;
  correlationId: string | null;
  timestamp: string;
  ipAddress: string | null;
  details: string | null;
  eventType?: string | null;
}
