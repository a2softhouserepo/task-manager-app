import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getConfig } from '@/models/SystemConfig';

/**
 * GET /api/settings/asana - Retorna configurações públicas do Asana
 * Qualquer usuário autenticado pode acessar (necessário para o TaskModal)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Buscar apenas as configurações necessárias para o upload
    const [allowedTypes, maxSizeMB, maxFiles] = await Promise.all([
      getConfig<string[]>('asana_allowed_file_types', ['.zip']),
      getConfig<number>('asana_max_file_size_mb', 10),
      getConfig<number>('asana_max_files_per_task', 5),
    ]);

    return NextResponse.json({
      allowedTypes,
      maxSizeMB,
      maxFiles,
    });
  } catch (error) {
    console.error('Erro ao buscar configurações do Asana:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar configurações' },
      { status: 500 }
    );
  }
}
