/**
 * Security event payload from SignalR (Claim Check pattern).
 * Only contains minimal data - full details fetched via REST API.
 */
export interface SecurityEventPayload {
  EventId: string;
  Timestamp: string;
  EventType: string;
  Reason?: string;
  Action?: string;
  ChangeType?: string;
  SettingName?: string;
  PrivilegeName?: string;
  NewValue?: string;
}

/**
 * Full audit log details fetched via REST API (Claim Check).
 */
export interface AuditLogDetails {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resourceId: string;
  correlationId: string | null;
  timestamp: string;
  ipAddress: string | null;
  details: string | null;
}