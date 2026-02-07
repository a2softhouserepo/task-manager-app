import mongoose, { Schema, Model, models } from 'mongoose';
import { fieldEncryptionPlugin } from '@/lib/mongoose-field-encryption';

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

export interface ITask {
  _id: string;
  requestDate: Date; // Data de solicitação
  clientId: string;
  clientName?: string; // Denormalized for quick display
  rootClientName?: string; // Nome do cliente raiz
  subClientLevels?: string[]; // Array de subclientes por nível
  categoryId: string;
  categoryName?: string; // Denormalized for quick display
  categoryIcon?: string; // Denormalized icon
  categoryColor?: string; // Denormalized color
  title: string;
  titleHash?: string;
  description: string;
  descriptionHash?: string;
  deliveryDate?: Date; // Data de entrega
  cost: number;
  observations?: string;
  status: 'pending' | 'in_progress' | 'qa' | 'completed' | 'cancelled';
  costDistribution?: {
    teamMemberId: string;
    teamMemberName: string;
    value: number;
  }[];
  asanaTaskGid?: string; // Asana task ID for updates
  asanaSynced: boolean; // Whether task was synced to Asana
  asanaSyncError?: string; // Error message if sync failed
  userId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    requestDate: {
      type: Date,
      required: [true, 'Data de solicitação é obrigatória'],
      default: Date.now,
    },
    clientId: {
      type: String,
      required: [true, 'Cliente é obrigatório'],
    },
    clientName: {
      type: String,
      trim: true,
    },
    categoryId: {
      type: String,
      required: [true, 'Categoria é obrigatória'],
    },
    categoryName: {
      type: String,
      trim: true,
    },
    categoryIcon: {
      type: String,
      trim: true,
    },
    categoryColor: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Título é obrigatório'],
      trim: true,
    },
    titleHash: {
      type: String,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Descrição é obrigatória'],
      trim: true,
    },
    descriptionHash: {
      type: String,
      index: true,
    },
    deliveryDate: {
      type: Date,
    },
    cost: {
      type: Number,
      required: [true, 'Custo é obrigatório'],
      min: [0, 'Custo não pode ser negativo'],
      default: 0,
    },
    observations: {
      type: String,
      trim: true,
    },
    costDistribution: [{
      teamMemberId: { type: String, required: true },
      teamMemberName: { type: String, required: true, trim: true },
      value: { type: Number, required: true, min: 0 },
    }],
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'qa', 'completed', 'cancelled'],
      default: 'pending',
    },
    asanaTaskGid: {
      type: String,
      index: true, // Index for quick lookup when updating Asana tasks
    },
    asanaSynced: {
      type: Boolean,
      default: false,
    },
    asanaSyncError: {
      type: String,
    },
    userId: {
      type: String,
      required: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: `${DB_PREFIX}tasks`,
  }
);

// Indexes for faster queries
TaskSchema.index({ requestDate: -1 });
TaskSchema.index({ deliveryDate: -1 });
TaskSchema.index({ clientId: 1, requestDate: -1 });
TaskSchema.index({ categoryId: 1 });
TaskSchema.index({ userId: 1, requestDate: -1 });
TaskSchema.index({ status: 1 });

/**
 * OTIMIZAÇÃO: Índices compostos adicionais para queries frequentes
 * Criados para melhorar performance de:
 * - Filtros por status + data (listagem de tarefas)
 * - Filtros por cliente + categoria + data (relatórios)
 * - Estatísticas por cliente/categoria (dashboard)
 */
TaskSchema.index({ status: 1, requestDate: -1 }); // Listagem filtrada por status
TaskSchema.index({ clientId: 1, categoryId: 1, requestDate: -1 }); // Relatórios combinados
TaskSchema.index({ clientId: 1, status: 1 }); // Stats por cliente
TaskSchema.index({ categoryId: 1, status: 1 }); // Stats por categoria
TaskSchema.index({ 'costDistribution.teamMemberId': 1 }); // Stats por membro da equipe

// Apply field encryption to sensitive fields with blind indexes
TaskSchema.plugin(fieldEncryptionPlugin, {
  fields: ['title', 'description', 'observations'],
  blindIndexFields: ['title', 'description'],
});

const Task: Model<ITask> = models[`${DB_PREFIX}tasks`] || mongoose.model<ITask>(`${DB_PREFIX}tasks`, TaskSchema);

export default Task;
