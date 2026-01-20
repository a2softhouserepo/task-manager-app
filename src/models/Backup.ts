import mongoose, { Schema, Model, models } from 'mongoose';

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

export interface IBackup {
  _id: string;
  filename: string;
  data: string; // JSON stringify dos dados
  size: number;
  type: 'AUTO' | 'MANUAL';
  createdBy: string; // ID do usuário ou 'SYSTEM'
  stats: {
    tasks: number;
    clients: number;
    categories: number;
    users: number;
  };
  createdAt: Date;
}

const BackupSchema = new Schema<IBackup>(
  {
    filename: { 
      type: String, 
      required: true,
      index: true,
    },
    data: { 
      type: String, 
      required: true 
    },
    size: { 
      type: Number, 
      required: true 
    },
    type: { 
      type: String, 
      enum: ['AUTO', 'MANUAL'], 
      default: 'MANUAL',
      index: true,
    },
    createdBy: { 
      type: String, 
      required: true 
    },
    stats: {
      tasks: { type: Number, default: 0 },
      clients: { type: Number, default: 0 },
      categories: { type: Number, default: 0 },
      users: { type: Number, default: 0 },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: `${DB_PREFIX}backups`,
  }
);

// Índice para buscar por data de criação
BackupSchema.index({ createdAt: -1 });

// Índice composto para verificar backup automático do dia
BackupSchema.index({ type: 1, createdAt: -1 });

const Backup: Model<IBackup> = models[`${DB_PREFIX}backups`] || mongoose.model<IBackup>(`${DB_PREFIX}backups`, BackupSchema);

export default Backup;
