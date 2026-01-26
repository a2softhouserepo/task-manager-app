import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { rateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { getCookieNames } from '@/lib/cookie-config';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Por favor, forneça usuário e senha');
        }

        // Rate limiting by username
        const rateLimitResult = rateLimit(`login:${credentials.username}`, {
          maxAttempts: 5,
          windowMs: 15 * 60 * 1000, // 15 minutes
        });

        if (!rateLimitResult.allowed) {
          const resetMinutes = Math.ceil((rateLimitResult.resetTime - Date.now()) / 60000);
          throw new Error(`Muitas tentativas de login. Tente novamente em ${resetMinutes} minutos.`);
        }

        await dbConnect();

        const user = await User.findOne({ username: credentials.username });

        if (!user) {
          // Log failed login attempt
          await logAudit({
            action: 'LOGIN_FAILED',
            resource: 'USER',
            userId: 'unknown',
            userName: credentials.username,
            userEmail: 'unknown',
            details: {
              reason: 'User not found',
              username: credentials.username,
            },
          });
          throw new Error('Usuário ou senha incorretos');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          // Log failed login attempt
          await logAudit({
            action: 'LOGIN_FAILED',
            resource: 'USER',
            userId: user._id.toString(),
            userName: user.name,
            userEmail: user.email || '',
            details: {
              reason: 'Invalid password',
              username: credentials.username,
            },
          });
          throw new Error('Usuário ou senha incorretos');
        }

        // Log successful login
        await logAudit({
          action: 'LOGIN_SUCCESS',
          resource: 'USER',
          userId: user._id.toString(),
          userName: user.name,
          userEmail: user.email || '',
          details: {
            username: credentials.username,
            role: user.role,
          },
        });

        // Executar backup automático de forma síncrona se for rootAdmin
        if (user.role === 'rootAdmin') {
          try {
            const { checkAndTriggerAutoBackup } = await import('@/lib/backup-service');
            const { getConfig } = await import('@/models/SystemConfig');
            
            // Buscar frequência do banco de dados, fallback para .env
            const backupFrequency = await getConfig<'daily' | 'every_login' | 'disabled'>(
              'backup_frequency',
              (process.env.BACKUP_FREQUENCY_FALLBACK || 'daily') as 'daily' | 'every_login' | 'disabled'
            );
            
            console.log(`🔧 Backup automático configurado como: ${backupFrequency}`);
            await checkAndTriggerAutoBackup(backupFrequency);
          } catch (backupError) {
            console.error('❌ Erro ao executar backup automático:', backupError);
            // Não bloqueia o login se backup falhar
          }
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email || '',
          role: user.role,
          username: user.username,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).username = token.username;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 1 day (refresh token daily)
  },
  cookies: {
    sessionToken: {
      name: getCookieNames().sessionToken,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: getCookieNames().callbackUrl,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: getCookieNames().csrfToken,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
