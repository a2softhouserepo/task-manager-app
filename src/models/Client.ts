import mongoose, { Schema, Model, models } from 'mongoose';
import { fieldEncryptionPlugin } from '@/lib/mongoose-field-encryption';

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

export interface IClient {
  _id: string;
  name: string;
  nameHash?: string; // Blind index for searching
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

// Apply field encryption to sensitive fields with blind indexes for search
ClientSchema.plugin(fieldEncryptionPlugin, {
  fields: ['name', 'phone', 'email', 'address', 'notes'],
  blindIndexFields: ['name', 'phone', 'email'],
});

const Client: Model<IClient> = models[`${DB_PREFIX}clients`] || mongoose.model<IClient>(`${DB_PREFIX}clients`, ClientSchema);

export default Client;
