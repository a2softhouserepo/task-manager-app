import mongoose, { Schema, Model, models } from 'mongoose';
import { fieldEncryptionPlugin } from '@/lib/mongoose-field-encryption';

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

export interface ITask {
  _id: string;
  requestDate: Date; // Data de solicitação
  clientId: string;
  clientName?: string; // Denormalized for quick display
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
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  asanaEmailSent: boolean;
  asanaEmailError?: string;
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
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    asanaEmailSent: {
      type: Boolean,
      default: false,
    },
    asanaEmailError: {
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

// Apply field encryption to sensitive fields with blind indexes
TaskSchema.plugin(fieldEncryptionPlugin, {
  fields: ['title', 'description', 'observations'],
  blindIndexFields: ['title', 'description'],
});

const Task: Model<ITask> = models[`${DB_PREFIX}tasks`] || mongoose.model<ITask>(`${DB_PREFIX}tasks`, TaskSchema);

export default Task;
