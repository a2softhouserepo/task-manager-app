import AuditLog from '@/models/AuditLog';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { headers } from 'next/headers';
import dbConnect from '@/lib/mongodb';

interface AuditParams {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'EXPORT';
  resource: 'TASK' | 'USER' | 'CLIENT' | 'CATEGORY' | 'AUDIT_LOG';
  resourceId?: string;
  details?: any;
  userId?: string;
  userName?: string;
  userEmail?: string;
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
    });
    
    console.log(`[AUDIT] ${params.action} on ${params.resource}${params.resourceId ? ` (${params.resourceId})` : ''} by ${userEmail}`);
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
  if (snapshot.password) delete snapshot.password;
  if (snapshot.passwordHash) delete snapshot.passwordHash;
  
  return snapshot;
}
