import mongoose, { Schema, Document, Model } from 'mongoose';

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

export interface ILoginAttempt extends Document {
  username: string;
  ipAddress: string;
  success: boolean;
  userAgent?: string;
  createdAt: Date;
}

const LoginAttemptSchema = new Schema<ILoginAttempt>(
  {
    username: { 
      type: String, 
      required: true, 
      index: true 
    },
    ipAddress: { 
      type: String, 
      required: true,
      index: true 
    },
    success: { 
      type: Boolean, 
      required: true 
    },
    userAgent: {
      type: String
    },
    createdAt: { 
      type: Date, 
      default: Date.now, 
      expires: 3600 // TTL: 1 hora - documentos são removidos automaticamente
    }
  },
  {
    timestamps: false, // Usamos createdAt manual para TTL
    collection: `${DB_PREFIX}login-attempts`,
  }
);

// Índice composto para consultas eficientes
LoginAttemptSchema.index({ username: 1, createdAt: -1 });
LoginAttemptSchema.index({ ipAddress: 1, createdAt: -1 });

const LoginAttempt: Model<ILoginAttempt> = 
  mongoose.models[`${DB_PREFIX}login-attempts`] || 
  mongoose.model<ILoginAttempt>(`${DB_PREFIX}login-attempts`, LoginAttemptSchema);

export default LoginAttempt;

/**
 * Registra uma tentativa de login
 */
export async function recordLoginAttempt(
  username: string, 
  ipAddress: string, 
  success: boolean,
  userAgent?: string
): Promise<void> {
  try {
    await LoginAttempt.create({ 
      username, 
      ipAddress, 
      success,
      userAgent,
      createdAt: new Date()
    });
  } catch (err) {
    console.error('Erro ao registrar tentativa de login:', err);
  }
}

/**
 * Verifica se o usuário/IP está bloqueado por excesso de tentativas
 */
export async function isLoginBlocked(
  username: string, 
  ipAddress: string,
  maxAttempts: number = 5,
  windowMinutes: number = 15
): Promise<{ blocked: boolean; remainingAttempts: number; minutesUntilReset: number }> {
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);
  
  try {
    // Contar tentativas falhas recentes por username OU IP
    const failedAttempts = await LoginAttempt.countDocuments({
      $or: [{ username }, { ipAddress }],
      success: false,
      createdAt: { $gte: windowStart }
    });
    
    const blocked = failedAttempts >= maxAttempts;
    const remainingAttempts = Math.max(0, maxAttempts - failedAttempts);
    
    // Calcular tempo até reset
    let minutesUntilReset = 0;
    if (blocked) {
      const oldestAttempt = await LoginAttempt.findOne({
        $or: [{ username }, { ipAddress }],
        success: false,
        createdAt: { $gte: windowStart }
      }).sort({ createdAt: 1 });
      
      if (oldestAttempt) {
        const resetTime = new Date(oldestAttempt.createdAt);
        resetTime.setMinutes(resetTime.getMinutes() + windowMinutes);
        minutesUntilReset = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 60000));
      }
    }
    
    return { blocked, remainingAttempts, minutesUntilReset };
  } catch (err) {
    console.error('Erro ao verificar bloqueio de login:', err);
    // Em caso de erro, não bloquear (fail-safe)
    return { blocked: false, remainingAttempts: maxAttempts, minutesUntilReset: 0 };
  }
}

/**
 * Limpa tentativas de login após login bem-sucedido
 */
export async function clearLoginAttempts(username: string, ipAddress: string): Promise<void> {
  try {
    await LoginAttempt.deleteMany({
      $or: [{ username }, { ipAddress }],
      success: false
    });
  } catch (err) {
    console.error('Erro ao limpar tentativas de login:', err);
  }
}
