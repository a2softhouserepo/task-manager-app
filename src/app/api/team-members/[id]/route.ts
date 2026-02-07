import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import TeamMember from '@/models/TeamMember';
import Task from '@/models/Task';
import { z } from 'zod';
import { logAudit, createAuditSnapshot, logAuthFailure } from '@/lib/audit';

const updateTeamMemberSchema = z.object({
  name: z.string().min(1, 'Nome não pode estar vazio').max(100, 'Nome muito longo').optional(),
  role: z.string().max(100, 'Cargo muito longo').nullable().optional(),
  icon: z.string().max(10, 'Ícone inválido').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um código hex válido').optional(),
  active: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;

    const teamMember = await TeamMember.findById(id);
    if (!teamMember) {
      return NextResponse.json({ error: 'Membro da equipe não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ teamMember });
  } catch (error: any) {
    console.error('Error fetching team member:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const currentUserId = (session.user as any).id;
    const { id } = await params;

    await dbConnect();
    
    const teamMember = await TeamMember.findById(id);
    if (!teamMember) {
      return NextResponse.json({ error: 'Membro da equipe não encontrado' }, { status: 404 });
    }

    // RootAdmin pode editar todos, outros só podem editar seus próprios registros
    if (userRole !== 'rootAdmin' && teamMember.createdBy !== currentUserId) {
      void logAuthFailure({
        resource: 'TEAM_MEMBER',
        resourceId: id,
        reason: 'Tentativa de editar membro da equipe de outro usuário',
        attemptedAction: 'UPDATE',
      });
      return NextResponse.json(
        { error: 'Você só pode editar membros da equipe que você cadastrou' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    const validationResult = updateTeamMemberSchema.safeParse(body);
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

    const updates = validationResult.data;

    // Verifica se novo nome já existe
    if (updates.name && updates.name !== teamMember.name) {
      const existingMember = await TeamMember.findOne({ 
        name: { $regex: new RegExp(`^${updates.name}$`, 'i') },
        _id: { $ne: id }
      });

      if (existingMember) {
        return NextResponse.json(
          { error: 'Já existe um membro da equipe com este nome' },
          { status: 400 }
        );
      }
    }

    const originalMember = createAuditSnapshot(teamMember.toObject());

    // Se o nome foi alterado, atualizar o nome denormalizado nas tarefas
    if (updates.name && updates.name !== teamMember.name) {
      await Task.updateMany(
        { 'costDistribution.teamMemberId': id },
        { $set: { 'costDistribution.$[elem].teamMemberName': updates.name } },
        { arrayFilters: [{ 'elem.teamMemberId': id }] }
      );
    }

    Object.assign(teamMember, updates);
    teamMember.updatedAt = new Date();
    await teamMember.save();

    await logAudit({
      action: 'UPDATE',
      resource: 'TEAM_MEMBER',
      resourceId: id,
      details: {
        before: originalMember,
        after: createAuditSnapshot(teamMember.toObject()),
        changes: Object.keys(updates),
      },
    });

    return NextResponse.json({ teamMember });
  } catch (error: any) {
    console.error('Error updating team member:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const currentUserId = (session.user as any).id;

    // User não pode deletar
    if (userRole === 'user') {
      void logAuthFailure({
        resource: 'TEAM_MEMBER',
        resourceId: 'unknown',
        reason: 'Usuário comum tentou deletar membro da equipe',
        attemptedAction: 'DELETE',
      });
      return NextResponse.json(
        { error: 'Usuários não podem deletar registros' },
        { status: 403 }
      );
    }

    await dbConnect();
    const { id } = await params;

    const teamMember = await TeamMember.findById(id);
    if (!teamMember) {
      return NextResponse.json({ error: 'Membro da equipe não encontrado' }, { status: 404 });
    }

    // Admin só pode deletar seus próprios registros
    if (userRole === 'admin' && teamMember.createdBy !== currentUserId) {
      void logAuthFailure({
        resource: 'TEAM_MEMBER',
        resourceId: id,
        reason: 'Admin tentou deletar membro da equipe de outro usuário',
        attemptedAction: 'DELETE',
      });
      return NextResponse.json(
        { error: 'Você só pode deletar membros da equipe que você cadastrou' },
        { status: 403 }
      );
    }

    // Verifica se existem tarefas usando este membro
    const tasksUsingMember = await Task.countDocuments({ 'costDistribution.teamMemberId': id });
    if (tasksUsingMember > 0) {
      return NextResponse.json(
        { error: `Não é possível deletar. Existem ${tasksUsingMember} tarefa(s) com distribuição de custo para este membro.` },
        { status: 400 }
      );
    }

    await logAudit({
      action: 'DELETE',
      resource: 'TEAM_MEMBER',
      resourceId: id,
      details: { deleted: createAuditSnapshot(teamMember.toObject()) },
    });

    await TeamMember.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Membro da equipe deletado com sucesso' });
  } catch (error: any) {
    console.error('Error deleting team member:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
