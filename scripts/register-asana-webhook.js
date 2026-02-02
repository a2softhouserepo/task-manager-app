/**
 * Script para registrar webhook do Asana
 * 
 * Execute com:
 *   node scripts/register-asana-webhook.js <URL_DO_WEBHOOK>
 * 
 * Exemplo:
 *   node scripts/register-asana-webhook.js https://seu-dominio.com/api/asana/webhook
 * 
 * Para desenvolvimento local com ngrok:
 *   ngrok http 3000
 *   node scripts/register-asana-webhook.js https://abc123.ngrok.io/api/asana/webhook
 * 
 * Requisitos:
 * - ASANA_ACCESS_TOKEN configurado no .env.local
 * - ASANA_PROJECT_GID configurado no .env.local
 */

require('dotenv').config({ path: '.env.local' });

const ASANA_API_BASE = 'https://app.asana.com/api/1.0';

async function registerWebhook(targetUrl) {
  const accessToken = process.env.ASANA_ACCESS_TOKEN;
  const projectGid = process.env.ASANA_PROJECT_GID;

  if (!accessToken) {
    console.error('❌ ASANA_ACCESS_TOKEN não configurado no .env.local');
    process.exit(1);
  }

  if (!projectGid) {
    console.error('❌ ASANA_PROJECT_GID não configurado no .env.local');
    process.exit(1);
  }

  if (!targetUrl) {
    console.error('❌ URL do webhook não fornecida');
    console.log('\nUso: node scripts/register-asana-webhook.js <URL_DO_WEBHOOK>');
    console.log('Exemplo: node scripts/register-asana-webhook.js https://seu-dominio.com/api/asana/webhook');
    process.exit(1);
  }

  // Validate URL
  try {
    new URL(targetUrl);
  } catch {
    console.error('❌ URL inválida:', targetUrl);
    process.exit(1);
  }

  if (!targetUrl.startsWith('https://')) {
    console.error('❌ O Asana requer HTTPS para webhooks');
    console.log('💡 Dica: Use ngrok para desenvolvimento local: ngrok http 3000');
    process.exit(1);
  }

  console.log('🔧 Registrando webhook do Asana...\n');
  console.log(`   Project GID: ${projectGid}`);
  console.log(`   Target URL:  ${targetUrl}`);
  console.log('');

  try {
    const response = await fetch(`${ASANA_API_BASE}/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        data: {
          resource: projectGid,
          target: targetUrl,
          filters: [
            {
              resource_type: 'task',
              action: 'changed',
            },
            {
              resource_type: 'task',
              action: 'added',
            },
            {
              resource_type: 'task',
              action: 'removed',
            },
            {
              resource_type: 'task',
              action: 'deleted',
            },
          ],
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Erro ao registrar webhook:');
      console.error(JSON.stringify(data, null, 2));
      
      if (data.errors?.[0]?.message?.includes('handshake')) {
        console.log('\n💡 O Asana não conseguiu completar o handshake.');
        console.log('   Verifique se:');
        console.log('   1. A URL está acessível publicamente');
        console.log('   2. O servidor está rodando');
        console.log('   3. O endpoint /api/asana/webhook existe');
      }
      
      process.exit(1);
    }

    console.log('✅ Webhook registrado com sucesso!\n');
    console.log('Detalhes:');
    console.log(`   GID:      ${data.data.gid}`);
    console.log(`   Resource: ${data.data.resource.gid}`);
    console.log(`   Target:   ${data.data.target}`);
    console.log(`   Active:   ${data.data.active}`);
    
    // O X-Hook-Secret é retornado diretamente na resposta da API!
    const webhookSecret = data['X-Hook-Secret'];
    
    if (webhookSecret) {
      console.log('\n' + '═'.repeat(60));
      console.log('🔐 WEBHOOK SECRET OBTIDO COM SUCESSO!');
      console.log('═'.repeat(60));
      console.log('\n📋 Adicione às variáveis de ambiente (Vercel/.env.local):\n');
      console.log(`ASANA_WEBHOOK_SECRET=${webhookSecret}`);
      console.log(`ASANA_WEBHOOK_GID=${data.data.gid}`);
      console.log('\n' + '═'.repeat(60));
    } else {
      console.log('\n⚠️  X-Hook-Secret não retornado na resposta da API.');
      console.log('   Verifique os logs do servidor para o valor do secret.');
    }

  } catch (error) {
    console.error('❌ Erro ao registrar webhook:', error.message);
    process.exit(1);
  }
}

async function listWebhooks() {
  const accessToken = process.env.ASANA_ACCESS_TOKEN;
  const projectGid = process.env.ASANA_PROJECT_GID;

  if (!accessToken || !projectGid) {
    return;
  }

  console.log('\n📋 Webhooks existentes para este projeto:\n');

  try {
    // First get workspace from project
    const projectResponse = await fetch(`${ASANA_API_BASE}/projects/${projectGid}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    
    const projectData = await projectResponse.json();
    const workspaceGid = projectData.data?.workspace?.gid;
    
    if (!workspaceGid) {
      console.log('   Não foi possível obter o workspace do projeto');
      return;
    }

    const response = await fetch(`${ASANA_API_BASE}/webhooks?workspace=${workspaceGid}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    const data = await response.json();
    const webhooks = data.data || [];
    
    // Filter webhooks for our project
    const projectWebhooks = webhooks.filter(w => w.resource?.gid === projectGid);

    if (projectWebhooks.length === 0) {
      console.log('   Nenhum webhook registrado para este projeto');
    } else {
      projectWebhooks.forEach((webhook, index) => {
        console.log(`   ${index + 1}. GID: ${webhook.gid}`);
        console.log(`      Target: ${webhook.target}`);
        console.log(`      Active: ${webhook.active}`);
        console.log('');
      });
    }
  } catch (error) {
    console.log('   Erro ao listar webhooks:', error.message);
  }
}

async function deleteWebhook(webhookGid) {
  const accessToken = process.env.ASANA_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('❌ ASANA_ACCESS_TOKEN não configurado');
    process.exit(1);
  }

  console.log(`🗑️  Deletando webhook ${webhookGid}...`);

  try {
    const response = await fetch(`${ASANA_API_BASE}/webhooks/${webhookGid}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      console.log('✅ Webhook deletado com sucesso!');
    } else {
      const data = await response.json();
      console.error('❌ Erro ao deletar webhook:', data);
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Main
const args = process.argv.slice(2);
const command = args[0];

if (command === '--list' || command === '-l') {
  listWebhooks();
} else if (command === '--delete' || command === '-d') {
  const webhookGid = args[1];
  if (!webhookGid) {
    console.error('❌ Forneça o GID do webhook para deletar');
    console.log('Uso: node scripts/register-asana-webhook.js --delete <WEBHOOK_GID>');
    process.exit(1);
  }
  deleteWebhook(webhookGid);
} else if (command === '--help' || command === '-h') {
  console.log(`
Asana Webhook Manager

Uso:
  node scripts/register-asana-webhook.js <URL>              Registrar novo webhook
  node scripts/register-asana-webhook.js --list             Listar webhooks existentes
  node scripts/register-asana-webhook.js --delete <GID>     Deletar um webhook

Exemplos:
  node scripts/register-asana-webhook.js https://meusite.com/api/asana/webhook
  node scripts/register-asana-webhook.js -l
  node scripts/register-asana-webhook.js -d 1234567890123456

Para desenvolvimento local:
  1. Instale ngrok: npm install -g ngrok
  2. Execute: ngrok http 3000
  3. Use a URL HTTPS gerada pelo ngrok
  `);
} else {
  listWebhooks().then(() => {
    if (command) {
      registerWebhook(command);
    } else {
      console.log('\n💡 Para registrar um novo webhook:');
      console.log('   node scripts/register-asana-webhook.js <URL_HTTPS>');
      console.log('\n   Use --help para ver todas as opções');
    }
  });
}
