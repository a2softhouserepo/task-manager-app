import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import TeamMember from '@/models/TeamMember';
import { z } from 'zod';
import { logAudit, createAuditSnapshot } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    
    const query: any = {};
    if (active !== null) {
      query.active = active === 'true';
    }

    const teamMembers = await TeamMember.find(query).sort({ name: 1 });

    return NextResponse.json({ teamMembers });
  } catch (error: any) {
    console.error('Error fetching team members:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

const createTeamMemberSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  role: z.string().max(100, 'Cargo muito longo').optional(),
  icon: z.string().max(10, 'Ícone inválido').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um código hex válido').optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await dbConnect();

    const body = await request.json();
    
    const validationResult = createTeamMemberSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues || [];
      const errorMessages = errors.length > 0
        ? errors.map((err) => `${err.path.join('.')}: ${err.message}`).join('; ')
        : 'Dados inválidos';
      return NextResponse.json(
        { error: `Erro de validação: ${errorMessages}`, details: errors },
        { status: 400 }
      );
    }

    const { name, role, icon, color } = validationResult.data;

    // Verifica se já existe membro com esse nome
    const existingMember = await TeamMember.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'Já existe um membro da equipe com este nome' },
        { status: 400 }
      );
    }

    const teamMember = await TeamMember.create({
      name,
      role: role || undefined,
      icon: icon || '👤',
      color: color || '#3B82F6',
      active: true,
      createdBy: (session.user as any).id,
    });

    await logAudit({
      action: 'CREATE',
      resource: 'TEAM_MEMBER',
      resourceId: teamMember._id.toString(),
      details: createAuditSnapshot(teamMember.toObject()),
    });

    return NextResponse.json({ teamMember }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating team member:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
