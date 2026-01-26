import mongoose, { Schema, Model, models } from 'mongoose';
import { fieldEncryptionPlugin } from '@/lib/mongoose-field-encryption';

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

export interface IClient {
  _id: string;
  name: string;
  nameHash?: string; // Blind index for searching
  // Campos de hierarquia
  parentId?: string | null; // ID do cliente pai (null = cliente raiz)
  path: string[]; // Array com IDs de todos os ancestrais
  depth: number; // Nível na hierarquia (0 = raiz)
  rootClientId?: string | null; // ID do cliente raiz da árvore
  childrenCount: number; // Contador de filhos diretos
  // Campos de contato
  phone?: string;
  phoneHash?: string;
  address?: string;
  email?: string;
  emailHash?: string;
  notes?: string;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    name: {
      type: String,
      required: [true, 'Nome do cliente é obrigatório'],
    },
    nameHash: {
      type: String,
      index: true,
    },
    // Campos de hierarquia
    parentId: {
      type: String,
      default: null,
      index: true,
    },
    path: {
      type: [String],
      default: [],
      index: true,
    },
    depth: {
      type: Number,
      default: 0,
      index: true,
    },
    rootClientId: {
      type: String,
      default: null,
      index: true,
    },
    childrenCount: {
      type: Number,
      default: 0,
    },
    // Campos de contato
    phone: {
      type: String,
    },
    phoneHash: {
      type: String,
      index: true,
    },
    address: {
      type: String,
    },
    email: {
      type: String,
    },
    emailHash: {
      type: String,
      index: true,
    },
    notes: {
      type: String,
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: `${DB_PREFIX}clients`,
  }
);

// Index for faster queries
ClientSchema.index({ active: 1 });
ClientSchema.index({ createdBy: 1 });
// Índices para hierarquia
ClientSchema.index({ parentId: 1, active: 1 });
ClientSchema.index({ rootClientId: 1, active: 1 });
ClientSchema.index({ depth: 1, active: 1 });

// Apply field encryption to sensitive fields with blind indexes for search
ClientSchema.plugin(fieldEncryptionPlugin, {
  fields: ['name', 'phone', 'email', 'address', 'notes'],
  blindIndexFields: ['name', 'phone', 'email'],
});

const Client: Model<IClient> = models[`${DB_PREFIX}clients`] || mongoose.model<IClient>(`${DB_PREFIX}clients`, ClientSchema);

export default Client;
