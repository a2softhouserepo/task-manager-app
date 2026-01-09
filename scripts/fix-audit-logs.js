const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const auditSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  userEmail: String,
  action: String,
  resource: String,
  resourceId: String,
  details: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  createdAt: Date
});

const AuditLog = mongoose.model('AuditLog', auditSchema, 'tasks-audit-logs');

async function fixAuditLogs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const logs = await AuditLog.find({});
    console.log(`Found ${logs.length} audit logs`);

    let fixedCount = 0;
    for (const log of logs) {
      let needsUpdate = false;

      if (typeof log.userName !== 'string') {
        log.userName = 'Usuário desconhecido';
        needsUpdate = true;
      }

      if (typeof log.userEmail !== 'string') {
        log.userEmail = 'unknown@unknown.com';
        needsUpdate = true;
      }

      if (needsUpdate) {
        await log.save();
        fixedCount++;
      }
    }

    console.log(`Fixed ${fixedCount} audit logs`);
    console.log('Audit logs fix completed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAuditLogs();