import mongoose, { Schema, Model, models } from 'mongoose';
import bcrypt from 'bcryptjs';
import { fieldEncryptionPlugin } from '@/lib/mongoose-field-encryption';

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

export interface IUser {
  _id: string;
  username: string;
  password: string;
  name: string;
  email?: string;
  emailHash?: string; // Blind index for searching encrypted email
  role: 'user' | 'admin' | 'rootAdmin';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Username é obrigatório'],
      unique: true,
      trim: true,
      minlength: [3, 'Username deve ter pelo menos 3 caracteres'],
    },
    password: {
      type: String,
      required: [true, 'Senha é obrigatória'],
      minlength: [6, 'Senha deve ter pelo menos 6 caracteres'],
    },
    name: {
      type: String,
      required: [true, 'Nome é obrigatório'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    emailHash: {
      type: String,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'rootAdmin'],
      default: 'user',
    },
  },
  {
    timestamps: true,
    collection: `${DB_PREFIX}users`,
  }
);

// Pre-save hook to hash password
UserSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Hash password with cost of 10
    const hashedPassword = await bcrypt.hash(this.password, 10);
    this.password = hashedPassword;
    next();
  } catch (error: any) {
    next(error);
  }
});

// Apply field encryption to email with blind index for exact-match search
UserSchema.plugin(fieldEncryptionPlugin, {
  fields: ['email'],
  blindIndexFields: ['email'],
});

const User: Model<IUser> = models[`${DB_PREFIX}users`] || mongoose.model<IUser>(`${DB_PREFIX}users`, UserSchema);

export default User;
