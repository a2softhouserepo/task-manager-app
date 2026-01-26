import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import SystemConfig, { getAllConfigs, setConfig } from '@/models/SystemConfig';
import { logAudit } from '@/lib/audit';

/**
 * GET /api/settings - Lista todas as configurações do sistema
 * Apenas rootAdmin pode acessar
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any).role !== 'rootAdmin') {
      return NextResponse.json(
        { error: 'Não autorizado. Apenas rootAdmin pode acessar configurações.' },
        { status: 403 }
      );
    }

    const configs = await getAllConfigs();

    return NextResponse.json({ configs });
  } catch (error) {
    console.error('Erro ao listar configurações:', error);
    return NextResponse.json(
      { error: 'Erro ao listar configurações' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings - Atualiza múltiplas configurações
 * Apenas rootAdmin pode acessar
 * Body: { configs: [{ key: string, value: any }] }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any).role !== 'rootAdmin') {
      return NextResponse.json(
        { error: 'Não autorizado. Apenas rootAdmin pode alterar configurações.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { configs } = body;

    if (!Array.isArray(configs)) {
      return NextResponse.json(
        { error: 'Formato inválido. Esperado: { configs: [{ key, value }] }' },
        { status: 400 }
      );
    }

    await dbConnect();
    const userId = (session.user as any).id;
    const userName = session.user?.name || 'Unknown';
    const results: { key: string; success: boolean; oldValue?: any; newValue?: any }[] = [];

    for (const config of configs) {
      const { key, value } = config;
      
      if (!key) continue;

      // Buscar valor anterior para auditoria
      const existing = await SystemConfig.findOne({ key });
      const oldValue = existing?.value;

      // Atualizar configuração
      const updated = await setConfig(key, value, userId);

      if (updated) {
        results.push({ key, success: true, oldValue, newValue: value });

        // Registrar alteração no log de auditoria
        await logAudit({
          action: 'UPDATE',
          resource: 'SYSTEM_CONFIG',
          resourceId: key,
          userId,
          userName,
          details: {
            configKey: key,
            oldValue,
            newValue: value,
            label: existing?.label,
            category: existing?.category,
          },
        });
      } else {
        results.push({ key, success: false });
      }
    }

    // Buscar todas as configs atualizadas para retornar
    const allConfigs = await getAllConfigs();

    return NextResponse.json({
      success: true,
      results,
      configs: allConfigs,
      message: 'Configurações atualizadas com sucesso',
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar configurações' },
      { status: 500 }
    );
  }
}
