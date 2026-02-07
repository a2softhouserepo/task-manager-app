import mongoose, { Schema, Model, models } from 'mongoose';

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

export interface ITeamMember {
  _id: string;
  name: string;
  role?: string;
  icon?: string;
  color?: string;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberSchema = new Schema<ITeamMember>(
  {
    name: {
      type: String,
      required: [true, 'Nome do membro é obrigatório'],
      trim: true,
    },
    role: {
      type: String,
      trim: true,
    },
    icon: {
      type: String,
      default: '👤',
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
    collection: `${DB_PREFIX}team-members`,
  }
);

// Indexes for faster queries
TeamMemberSchema.index({ name: 1 });
TeamMemberSchema.index({ active: 1 });

const TeamMember: Model<ITeamMember> = models[`${DB_PREFIX}team-members`] || mongoose.model<ITeamMember>(`${DB_PREFIX}team-members`, TeamMemberSchema);

export default TeamMember;
