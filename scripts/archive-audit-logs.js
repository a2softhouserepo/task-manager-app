/**
 * Archive Audit Logs Script
 * 
 * Este script gerencia a retenção de logs de auditoria:
 * - Exporta logs mais antigos que 1 ano para arquivo JSON (cold storage)
 * - Remove logs arquivados do MongoDB para economizar espaço
 * - Mantém logs recentes (1 ano) no banco para consultas rápidas
 * 
 * Uso:
 *   node scripts/archive-audit-logs.js           # Modo dry-run (apenas mostra o que faria)
 *   node scripts/archive-audit-logs.js --execute # Executa o arquivamento
 *   node scripts/archive-audit-logs.js --days 365 # Customiza o período de retenção
 * 
 * Conformidade:
 *   - GDPR: Logs devem ser mantidos pelo tempo necessário para fins legítimos
 *   - SOC2: Logs de auditoria devem ser protegidos e ter política de retenção definida
 */

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

// Parse command line arguments
const args = process.argv.slice(2);
const executeMode = args.includes('--execute');
const daysIndex = args.indexOf('--days');
const retentionDays = daysIndex !== -1 && args[daysIndex + 1] 
  ? parseInt(args[daysIndex + 1], 10) 
  : 365; // Default: 1 year

// Calculate cutoff date
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

console.log('='.repeat(60));
console.log('📦 AUDIT LOG ARCHIVAL SCRIPT');
console.log('='.repeat(60));
console.log(`Mode: ${executeMode ? '🚀 EXECUTE' : '🔍 DRY-RUN (use --execute to apply)'}`);
console.log(`Retention Period: ${retentionDays} days`);
console.log(`Cutoff Date: ${cutoffDate.toISOString()}`);
console.log('='.repeat(60));

// Define AuditLog schema (minimal for this script)
const AuditLogSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  userEmail: String,
  action: String,
  resource: String,
  resourceId: String,
  details: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  severity: String,
  status: String,
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: `${DB_PREFIX}audit-logs`,
});

async function archiveAuditLogs() {
  try {
    // Connect to MongoDB
    console.log('\n🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const AuditLog = mongoose.model(`${DB_PREFIX}audit-logs`, AuditLogSchema);

    // Count total logs
    const totalLogs = await AuditLog.countDocuments();
    console.log(`📊 Total audit logs in database: ${totalLogs.toLocaleString()}`);

    // Count logs to archive (older than cutoff)
    const logsToArchive = await AuditLog.countDocuments({
      createdAt: { $lt: cutoffDate }
    });
    console.log(`📁 Logs older than ${retentionDays} days: ${logsToArchive.toLocaleString()}`);

    if (logsToArchive === 0) {
      console.log('\n✨ No logs to archive. Database is within retention policy.');
      return;
    }

    // Get statistics by severity for logs to archive
    const severityStats = await AuditLog.aggregate([
      { $match: { createdAt: { $lt: cutoffDate } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n📈 Logs to archive by severity:');
    severityStats.forEach(s => {
      const icon = s._id === 'CRITICAL' ? '🚨' : s._id === 'WARN' ? '⚠️' : 'ℹ️';
      console.log(`   ${icon} ${s._id || 'UNKNOWN'}: ${s.count.toLocaleString()}`);
    });

    // Get statistics by action
    const actionStats = await AuditLog.aggregate([
      { $match: { createdAt: { $lt: cutoffDate } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n📈 Logs to archive by action:');
    actionStats.forEach(s => {
      console.log(`   • ${s._id}: ${s.count.toLocaleString()}`);
    });

    if (!executeMode) {
      console.log('\n⚠️  DRY-RUN MODE: No changes made.');
      console.log('    Run with --execute flag to perform the archival.');
      return;
    }

    // Create archives directory
    const archivesDir = path.join(process.cwd(), 'archives', 'audit-logs');
    if (!fs.existsSync(archivesDir)) {
      fs.mkdirSync(archivesDir, { recursive: true });
    }

    // Generate archive filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveFilename = `audit-logs-archive-${timestamp}.json`;
    const archivePath = path.join(archivesDir, archiveFilename);

    console.log('\n📥 Exporting logs to archive file...');

    // Fetch logs in batches to avoid memory issues
    const batchSize = 1000;
    let exported = 0;
    const writeStream = fs.createWriteStream(archivePath);
    
    writeStream.write('[\n');

    let cursor = AuditLog.find({ createdAt: { $lt: cutoffDate } })
      .sort({ createdAt: 1 })
      .cursor();

    let isFirst = true;
    for await (const doc of cursor) {
      if (!isFirst) {
        writeStream.write(',\n');
      }
      writeStream.write(JSON.stringify(doc.toObject()));
      isFirst = false;
      exported++;

      if (exported % batchSize === 0) {
        process.stdout.write(`\r   Exported: ${exported.toLocaleString()} logs...`);
      }
    }

    writeStream.write('\n]');
    writeStream.end();

    console.log(`\n✅ Exported ${exported.toLocaleString()} logs to: ${archiveFilename}`);

    // Calculate file size
    const stats = fs.statSync(archivePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📦 Archive file size: ${fileSizeMB} MB`);

    // Delete archived logs from database
    console.log('\n🗑️  Removing archived logs from database...');
    const deleteResult = await AuditLog.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount.toLocaleString()} logs from MongoDB`);

    // Final statistics
    const remainingLogs = await AuditLog.countDocuments();
    console.log(`\n📊 Remaining logs in database: ${remainingLogs.toLocaleString()}`);

    // Create archive metadata file
    const metadataPath = path.join(archivesDir, `${archiveFilename}.meta.json`);
    const metadata = {
      archiveDate: new Date().toISOString(),
      cutoffDate: cutoffDate.toISOString(),
      retentionDays,
      logsArchived: exported,
      logsDeleted: deleteResult.deletedCount,
      fileSizeBytes: stats.size,
      severityBreakdown: severityStats,
      actionBreakdown: actionStats,
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`📋 Metadata saved to: ${archiveFilename}.meta.json`);

    console.log('\n' + '='.repeat(60));
    console.log('✨ ARCHIVAL COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n💡 Tip: Store the archive file in a secure location (S3, Azure Blob, etc.)`);
    console.log(`   for long-term retention and disaster recovery.`);

  } catch (error) {
    console.error('\n❌ Error during archival:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
archiveAuditLogs();
