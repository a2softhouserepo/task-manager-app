import AuditLog, { AuditAction, AuditResource, AuditSeverity, AuditStatus } from '@/models/AuditLog';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { headers } from 'next/headers';
import dbConnect from '@/lib/mongodb';

interface AuditParams {
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  details?: any;
  userId?: string;
  userName?: string;
  userEmail?: string;
  severity?: AuditSeverity;
  status?: AuditStatus;
}

/**
 * Determines the default severity based on the action type.
 * Security-related actions are marked as CRITICAL or WARN.
 */
function getDefaultSeverity(action: AuditAction, status: AuditStatus): AuditSeverity {
  // Failed actions are more severe
  if (status === 'FAILURE') {
    if (action === 'LOGIN_FAILED' || action === 'AUTH_FAILURE') {
      return 'CRITICAL';
    }
    return 'WARN';
  }
  
  // Security-sensitive successful actions
  if (action === 'DELETE' || action === 'BACKUP_DOWNLOAD' || action === 'BACKUP_RESTORE' || action === 'IMPORT') {
    return 'WARN';
  }
  
  // Normal operations
  return 'INFO';
}

/**
 * Logs an audit event to the database for compliance and security tracking.
 * Captures who did what, when, where (IP), and with which tool (user-agent).
 * 
 * This function is fail-safe: if logging fails, it will not interrupt the main operation.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    const headersList = await headers();
    
    // Extract IP address (handle proxies and cloud providers)
    const ip = 
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      'unknown';
    
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Use provided user info (for login failures) or session info
    const userId = params.userId || (session?.user as any)?.id || 'system';
    const userName = params.userName || 
      (typeof session?.user?.name === 'string' ? session.user.name : 'System') || 
      'System';
    const userEmail = params.userEmail || 
      (typeof session?.user?.email === 'string' ? session.user.email : 'system@internal') || 
      'system@internal';

    // Determine status and severity
    const status = params.status || 'SUCCESS';
    const severity = params.severity || getDefaultSeverity(params.action, status);

    await AuditLog.create({
      userId,
      userName,
      userEmail,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      details: params.details,
      ipAddress: ip,
      userAgent: userAgent,
      severity,
      status,
    });
    
    const severityIcon = severity === 'CRITICAL' ? '🚨' : severity === 'WARN' ? '⚠️' : 'ℹ️';
    console.log(`[AUDIT] ${severityIcon} ${params.action} on ${params.resource}${params.resourceId ? ` (${params.resourceId})` : ''} by ${userEmail} [${status}]`);
  } catch (error) {
    // Log to console but don't throw - audit logging should never break the main operation
    console.error('[AUDIT] Failed to create audit log:', error);
  }
}

/**
 * Helper to create a sanitized snapshot of an object for audit logs.
 * Removes sensitive fields like passwords.
 */
export function createAuditSnapshot(obj: any): any {
  if (!obj) return null;
  
  const snapshot = JSON.parse(JSON.stringify(obj));
  
  // Remove sensitive fields
  if (snapshot.password) delete (snapshot as any).password;
  if (snapshot.passwordHash) delete (snapshot as any).passwordHash;
  
  return snapshot;
}

/**
 * Log an authorization failure event.
 * Use this when a user attempts to access a resource they don't have permission for.
 * This is critical for detecting potential security threats and unauthorized access attempts.
 */
export async function logAuthFailure(params: {
  resource: AuditResource;
  resourceId?: string;
  reason: string;
  attemptedAction?: string;
}): Promise<void> {
  await logAudit({
    action: 'AUTH_FAILURE',
    resource: params.resource,
    resourceId: params.resourceId,
    details: {
      reason: params.reason,
      attemptedAction: params.attemptedAction,
    },
    severity: 'CRITICAL',
    status: 'FAILURE',
  });
}

/**
 * Log a sensitive data read event.
 * Use this when a user views detailed information about a sensitive resource.
 * Required for GDPR compliance and data access auditing.
 */
export async function logSensitiveRead(params: {
  resource: AuditResource;
  resourceId: string;
  details?: any;
}): Promise<void> {
  await logAudit({
    action: 'READ',
    resource: params.resource,
    resourceId: params.resourceId,
    details: params.details,
    severity: 'INFO',
    status: 'SUCCESS',
  });
}
