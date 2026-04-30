/**
 * Full audit log details
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