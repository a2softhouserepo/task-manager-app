import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Apenas rootAdmin pode ver logs de auditoria
    const userRole = (session.user as any).role;
    if (userRole !== 'rootAdmin') {
      return NextResponse.json(
        { error: 'Apenas Root Admin pode visualizar logs de auditoria' },
        { status: 403 }
      );
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const resource = searchParams.get('resource');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const query: any = {};

    if (action) {
      query.action = action;
    }

    if (resource) {
      query.resource = resource;
    }

    if (userId) {
      query.userId = userId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for better performance and to get plain objects
      AuditLog.countDocuments(query),
    ]);

    // Ensure all fields are properly typed
    const sanitizedLogs = logs.map(log => ({
      _id: log._id?.toString() || '',
      userId: typeof log.userId === 'string' ? log.userId : '',
      userName: typeof log.userName === 'string' ? log.userName : 'Usuário desconhecido',
      userEmail: typeof log.userEmail === 'string' ? log.userEmail : 'unknown@unknown.com',
      action: typeof log.action === 'string' ? log.action : 'UNKNOWN',
      resource: typeof log.resource === 'string' ? log.resource : 'UNKNOWN',
      resourceId: typeof log.resourceId === 'string' ? log.resourceId : undefined,
      details: log.details ? 
        (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : 
        undefined,
      ipAddress: typeof log.ipAddress === 'string' ? log.ipAddress : undefined,
      userAgent: typeof log.userAgent === 'string' ? log.userAgent : undefined,
      createdAt: log.createdAt?.toISOString() || new Date().toISOString(),
    }));

    return NextResponse.json({
      logs: sanitizedLogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
