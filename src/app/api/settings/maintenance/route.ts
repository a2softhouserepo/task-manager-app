import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { getConfig } from '@/models/SystemConfig';

/**
 * GET /api/settings/maintenance
 * Retorna o status do modo manutenção
 * Usado pelo middleware e pela página de settings
 */
export async function GET(request: NextRequest) {
  try {
    // Permitir requests internos (do middleware)
    const isInternal = request.headers.get('x-internal-request') === 'true';
    
    if (!isInternal) {
      // Verificar autenticação para requests externos
      const session = await getServerSession(authOptions);
      
      if (!session) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
      }
    }
    
    await dbConnect();
    const enabled = await getConfig<boolean>('maintenance_mode', false);
    
    return NextResponse.json({ 
      enabled,
      message: enabled ? 'Sistema em modo manutenção' : 'Sistema operacional'
    });
  } catch (error) {
    console.error('Erro ao verificar modo manutenção:', error);
    // Em caso de erro, assumir que não está em manutenção (fail-safe)
    return NextResponse.json({ enabled: false });
  }
}
