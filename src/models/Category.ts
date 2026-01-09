import mongoose, { Schema, Model, models } from 'mongoose';

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

export interface ICategory {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Nome da categoria é obrigatório'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    icon: {
      type: String,
      default: '📋',
    },
    color: {
      type: String,
      default: '#3B82F6',
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
    collection: `${DB_PREFIX}categories`,
  }
);

// Index for faster queries
CategorySchema.index({ name: 1 });
CategorySchema.index({ active: 1 });

const Category: Model<ICategory> = models[`${DB_PREFIX}categories`] || mongoose.model<ICategory>(`${DB_PREFIX}categories`, CategorySchema);

export default Category;
