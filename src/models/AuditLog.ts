import mongoose, { Schema, Model, models } from 'mongoose';

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

export interface IAuditLog {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'EXPORT';
  resource: 'TASK' | 'USER' | 'CLIENT' | 'CATEGORY' | 'AUDIT_LOG';
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'EXPORT'],
      index: true,
    },
    resource: {
      type: String,
      required: true,
      enum: ['TASK', 'USER', 'CLIENT', 'CATEGORY', 'AUDIT_LOG'],
      index: true,
    },
    resourceId: {
      type: String,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: `${DB_PREFIX}audit-logs`,
  }
);

// Compound indexes for efficient queries
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, action: 1, createdAt: -1 });

const AuditLog: Model<IAuditLog> = models[`${DB_PREFIX}audit-logs`] || mongoose.model<IAuditLog>(`${DB_PREFIX}audit-logs`, AuditLogSchema);

export default AuditLog;
