import mongoose, { Schema, Model, models } from 'mongoose';
import dbConnect from '@/lib/mongodb';

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

export interface ISystemConfig {
  _id: string;
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json';
  category: 'backup' | 'email' | 'security' | 'general' | 'asana';
  label: string;
  description?: string;
  options?: string[];
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const SystemConfigSchema = new Schema<ISystemConfig>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    type: {
      type: String,
      enum: ['string', 'number', 'boolean', 'json'],
      default: 'string',
    },
    category: {
      type: String,
      enum: ['backup', 'email', 'security', 'general', 'asana'],
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
    },
    description: String,
    options: [String],
    updatedBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: `${DB_PREFIX}system-config`,
  }
);

const SystemConfig: Model<ISystemConfig> =
  models[`${DB_PREFIX}system-config`] ||
  mongoose.model<ISystemConfig>(`${DB_PREFIX}system-config`, SystemConfigSchema);

export default SystemConfig;

// Fallback values from .env
const FALLBACK_VALUES: Record<string, string | undefined> = {
  backup_frequency: process.env.BACKUP_FREQUENCY_FALLBACK,
};

/**
 * Busca uma configuração do banco de dados
 * Se não existir, usa o fallback do .env ou o defaultValue
 */
export async function getConfig<T = any>(key: string, defaultValue?: T): Promise<T> {
  try {
    await dbConnect();
    const config = await SystemConfig.findOne({ key });
    
    if (config) {
      return config.value as T;
    }
    
    // Fallback para .env
    const envFallback = FALLBACK_VALUES[key];
    if (envFallback !== undefined) {
      return envFallback as unknown as T;
    }
    
    return defaultValue as T;
  } catch (error) {
    console.error(`Erro ao buscar config ${key}:`, error);
    
    // Em caso de erro, tenta fallback
    const envFallback = FALLBACK_VALUES[key];
    if (envFallback !== undefined) {
      return envFallback as unknown as T;
    }
    
    return defaultValue as T;
  }
}

/**
 * Atualiza uma configuração no banco de dados
 */
export async function setConfig(key: string, value: any, userId: string): Promise<ISystemConfig | null> {
  try {
    await dbConnect();
    return await SystemConfig.findOneAndUpdate(
      { key },
      { value, updatedBy: userId },
      { new: true }
    );
  } catch (error) {
    console.error(`Erro ao salvar config ${key}:`, error);
    return null;
  }
}

/**
 * Busca todas as configurações do sistema
 */
export async function getAllConfigs(): Promise<ISystemConfig[]> {
  try {
    await dbConnect();
    return await SystemConfig.find({}).sort({ category: 1, key: 1 }).lean();
  } catch (error) {
    console.error('Erro ao buscar todas as configs:', error);
    return [];
  }
}

/**
 * Busca configurações por categoria
 */
export async function getConfigsByCategory(category: string): Promise<ISystemConfig[]> {
  try {
    await dbConnect();
    return await SystemConfig.find({ category }).sort({ key: 1 }).lean();
  } catch (error) {
    console.error(`Erro ao buscar configs da categoria ${category}:`, error);
    return [];
  }
}
