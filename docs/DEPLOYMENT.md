# 🚀 Guia de Deployment

Este guia cobre o deployment do Task Manager App para ambientes de produção.

---

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Variáveis de Ambiente](#variáveis-de-ambiente)
3. [Configuração do Banco de Dados](#configuração-do-banco-de-dados)
4. [Deploy em Vercel](#deploy-em-vercel)
5. [Deploy em Servidor VPS](#deploy-em-servidor-vps)
6. [Deploy com Docker](#deploy-com-docker)
7. [Configurações Pós-Deploy](#configurações-pós-deploy)
8. [Monitoramento e Logs](#monitoramento-e-logs)
9. [Backup e Recuperação](#backup-e-recuperação)
10. [Troubleshooting](#troubleshooting)

---

## Pré-requisitos

### Obrigatórios
- Node.js 18+ (recomendado: 20 LTS)
- MongoDB 6+ (MongoDB Atlas ou instância própria)
- Domínio configurado (para produção)

### Opcionais
- Asana API Token (para integração)
- SMTP configurado (para notificações)
- SSL/TLS Certificate (Let's Encrypt ou similar)

---

## Variáveis de Ambiente

### Arquivo `.env.production`

Crie um arquivo `.env.production` com todas as variáveis necessárias:

```bash
# ===========================
# 🌐 APPLICATION
# ===========================
NODE_ENV=production
NEXTAUTH_URL=https://seu-dominio.com
NEXT_PUBLIC_APP_URL=https://seu-dominio.com

# ===========================
# 🗄️ DATABASE
# ===========================
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/taskmanager?retryWrites=true&w=majority
DB_PREFIX=tasks-

# ===========================
# 🔐 AUTHENTICATION
# ===========================
# Gerar com: openssl rand -base64 32
NEXTAUTH_SECRET=sua-chave-secreta-aqui-minimo-32-caracteres-produção

# ===========================
# 🔒 ENCRYPTION
# ===========================
# Gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=chave-hex-64-caracteres-para-producao

# ===========================
# 📧 EMAIL (Opcional)
# ===========================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
SMTP_FROM="Task Manager <noreply@seu-dominio.com>"

# ===========================
# 📊 ASANA (Opcional)
# ===========================
ASANA_TOKEN=seu-token-asana
ASANA_PROJECT_GID=seu-projeto-gid
ASANA_WORKSPACE_GID=seu-workspace-gid
ASANA_WEBHOOK_SECRET=webhook-secret-gerado

# ===========================
# ⚙️ CONFIGURAÇÕES
# ===========================
# Fallbacks para configurações dinâmicas
BACKUP_FREQUENCY_FALLBACK=daily
MAX_LOGIN_ATTEMPTS_FALLBACK=5
SESSION_TIMEOUT_HOURS_FALLBACK=24
```

### ⚠️ Segurança das Variáveis

**NUNCA commite o arquivo `.env.production` no Git!**

Adicione ao `.gitignore`:
```
.env.local
.env.production
.env*.local
```

---

## Configuração do Banco de Dados

### MongoDB Atlas (Recomendado)

1. **Criar Cluster:**
   - Acesse [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Crie uma conta e um cluster gratuito (M0)
   - Escolha a região mais próxima dos seus usuários

2. **Configurar Network Access:**
   ```
   Security → Network Access → Add IP Address
   → Allow Access from Anywhere (0.0.0.0/0)
   ```

3. **Criar Database User:**
   ```
   Security → Database Access → Add New Database User
   Username: taskmanager_user
   Password: [senha forte]
   Role: Read and write to any database
   ```

4. **Obter Connection String:**
   ```
   Connect → Connect your application → Copy connection string
   mongodb+srv://taskmanager_user:<password>@cluster0.xxxxx.mongodb.net/
   ```

5. **Configurar Índices (Automático):**
   Os índices são criados automaticamente pelos models do Mongoose.

### MongoDB Self-Hosted

Se usar MongoDB próprio, configure:

```bash
# Instalar MongoDB (Ubuntu/Debian)
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Iniciar serviço
sudo systemctl start mongod
sudo systemctl enable mongod

# Criar usuário
mongosh
> use admin
> db.createUser({
    user: "taskmanager_admin",
    pwd: "senha-forte",
    roles: [ { role: "readWrite", db: "taskmanager" } ]
  })
```

---

## Deploy em Vercel

A forma mais simples para deploy de aplicações Next.js.

### 1. Preparar Projeto

```bash
# Build local para testar
npm run build
npm start

# Verificar se tudo funciona
curl http://localhost:3000/api/health
```

### 2. Deploy via Vercel CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### 3. Deploy via GitHub

1. **Conectar Repositório:**
   - Acesse [vercel.com/new](https://vercel.com/new)
   - Conecte seu repositório GitHub
   - Selecione o projeto

2. **Configurar Build:**
   ```
   Framework Preset: Next.js
   Root Directory: ./
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm install
   ```

3. **Adicionar Variáveis de Ambiente:**
   - Settings → Environment Variables
   - Adicione todas as variáveis do `.env.production`
   - Marque: Production, Preview, Development

4. **Deploy:**
   - Vercel detecta automaticamente pushes no branch `main`
   - Cada commit gera um novo deploy
   - Preview URLs para PRs

### 4. Configurar Domínio Customizado

```
Settings → Domains → Add Domain
seu-dominio.com → Add
```

Vercel fornece SSL automático via Let's Encrypt.

---

## Deploy em Servidor VPS

Para deploy em servidor próprio (DigitalOcean, Linode, AWS EC2, etc).

### 1. Provisionar Servidor

```bash
# Mínimo recomendado
CPU: 2 vCPUs
RAM: 2GB
Storage: 20GB SSD
OS: Ubuntu 22.04 LTS
```

### 2. Configurar Servidor

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2 (process manager)
sudo npm install -g pm2

# Instalar Nginx (reverse proxy)
sudo apt install nginx -y

# Configurar firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 3. Deploy da Aplicação

```bash
# Criar usuário para aplicação
sudo adduser taskmanager
sudo usermod -aG sudo taskmanager

# Mudar para usuário
su - taskmanager

# Clonar repositório
git clone https://github.com/seu-usuario/task-manager-app.git
cd task-manager-app

# Instalar dependências
npm ci --production

# Criar arquivo .env.production
nano .env.production
# (Colar variáveis)

# Build da aplicação
npm run build

# Iniciar com PM2
pm2 start npm --name "task-manager" -- start
pm2 save
pm2 startup
```

### 4. Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/task-manager
```

```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/task-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Configurar SSL com Certbot

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obter certificado
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com

# Renovação automática (já configurado)
sudo certbot renew --dry-run
```

---

## Deploy com Docker

### Dockerfile

Crie um `Dockerfile` na raiz do projeto:

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    restart: unless-stopped
    depends_on:
      - mongo
    networks:
      - task-manager-network

  mongo:
    image: mongo:6
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: senha-forte
    volumes:
      - mongo-data:/data/db
    networks:
      - task-manager-network
    ports:
      - "27017:27017"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    networks:
      - task-manager-network
    restart: unless-stopped

volumes:
  mongo-data:

networks:
  task-manager-network:
    driver: bridge
```

### Deploy

```bash
# Build e iniciar
docker-compose up -d

# Ver logs
docker-compose logs -f app

# Parar
docker-compose down

# Rebuild após mudanças
docker-compose up -d --build
```

---

## Configurações Pós-Deploy

### 1. Popular Configurações Iniciais

```bash
# Seed de configurações do sistema
npm run db-config:seed

# Criar usuário rootAdmin
npm run db-users:seed:prod
```

### 2. Verificar Health Check

```bash
curl https://seu-dominio.com/api/health
# Deve retornar: {"status":"ok"}
```

### 3. Testar Autenticação

- Acesse `/login`
- Faça login com usuário root
- Verifique acesso ao dashboard

### 4. Configurar Backup Automático

No painel `/settings`:
- Definir frequência de backup
- Configurar retenção
- Testar backup manual

### 5. Configurar Asana (se aplicável)

```bash
# Registrar webhook
npm run asana:webhook:register

# Verificar webhook
npm run asana:webhook:list
```

---

## Monitoramento e Logs

### PM2 Monitoring

```bash
# Dashboard
pm2 monit

# Logs em tempo real
pm2 logs task-manager

# Métricas
pm2 show task-manager
```

### Logs de Aplicação

```bash
# Logs do Next.js
tail -f .next/standalone/server.log

# Logs do Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Monitoramento Externo

Recomendações:
- **Uptime:** UptimeRobot, Pingdom
- **APM:** New Relic, Datadog
- **Logs:** Logtail, Papertrail
- **Erros:** Sentry

---

## Backup e Recuperação

### Backup Automático

O sistema faz backup automático quando rootAdmin faz login.

### Backup Manual via Interface

1. Acesse `/backups`
2. Clique em "Criar Backup Manual"
3. Download do arquivo JSON

### Backup via Script

```bash
# Backup manual
curl -X POST https://seu-dominio.com/api/backups \
  -H "Cookie: next-auth.session-token=seu-token"

# Download de backup
curl https://seu-dominio.com/api/backups/[id]/download \
  -H "Cookie: next-auth.session-token=seu-token" \
  -o backup.json
```

### Backup do MongoDB

```bash
# Com MongoDB Atlas - Backup automático ativado por padrão

# Self-hosted
mongodump --uri="mongodb://localhost:27017/taskmanager" --out=/backup/$(date +%Y%m%d)

# Restaurar
mongorestore --uri="mongodb://localhost:27017/taskmanager" /backup/20260204
```

### Restauração de Backup

1. Acesse `/backups`
2. Clique em "Restaurar" no backup desejado
3. Confirme a ação
4. Aguarde a restauração

---

## Troubleshooting

### Problema: Build falha com "Out of memory"

**Solução:**
```bash
# Aumentar memória do Node
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Problema: MongoDB connection timeout

**Soluções:**
1. Verificar Network Access no MongoDB Atlas
2. Validar connection string
3. Testar conectividade:
   ```bash
   mongosh "mongodb+srv://cluster.mongodb.net/" --username user
   ```

### Problema: NextAuth session não persiste

**Soluções:**
1. Verificar `NEXTAUTH_URL` está correto
2. Verificar cookies não estão sendo bloqueados
3. Verificar `NEXTAUTH_SECRET` está definido

### Problema: Criptografia falha após deploy

**Causa:** `ENCRYPTION_KEY` diferente entre ambientes

**Solução:**
1. Usar a MESMA chave em todos os ambientes
2. Nunca rotacionar a chave (dados serão perdidos)

### Problema: Rate limiting muito agressivo

**Solução:**
Ajustar em `src/lib/rate-limit.ts`:
```typescript
export const rateLimiter = new RateLimiter({
  tokensPerInterval: 10, // Aumentar
  interval: "minute"
});
```

### Problema: Asana webhook não funciona

**Soluções:**
1. Verificar `ASANA_WEBHOOK_SECRET` está definido
2. URL do webhook deve ser HTTPS
3. Reregistrar webhook:
   ```bash
   npm run asana:webhook:delete
   npm run asana:webhook:register
   ```

---

## Checklist de Deploy

```
□ Variáveis de ambiente configuradas
□ MongoDB Atlas/Instância configurada
□ Build passa localmente
□ Testes executados com sucesso
□ .env.production criado (não commitado)
□ SSL/HTTPS configurado
□ Domínio apontando para servidor
□ Backup inicial criado
□ Configurações do sistema populadas
□ Usuário rootAdmin criado
□ Logs sendo monitorados
□ Health check funcionando
□ Asana webhook registrado (se aplicável)
□ SMTP testado (se aplicável)
□ Documentação atualizada
```

---

## Suporte

Para dúvidas sobre deployment:
- 📧 Email: suporte@seu-dominio.com
- 📚 Documentação: [docs/INDEX.md](INDEX.md)
- 🐛 Issues: GitHub Issues

---

*Última atualização: Fevereiro 2026*
