export type NotificationSeverity = 'critical' | 'warning' | 'info';
export type NotificationCategory = 'privilege' | 'authentication' | 'security' | 'system';
export type NotificationSource = 'history' | 'signalr';

export interface NotificationItem {
  id: string;
  tenantId: string;
  eventType: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  title: string;
  summary: string;
  timestamp: string;
  actor: string;
  userId: string;
  ipAddress: string | null;
  resourceId: string;
  correlationId: string | null;
  readAt: string | null;
  acknowledgedAt: string | null;
  source: NotificationSource;
}
