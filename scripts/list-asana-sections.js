/**
 * Script para listar as seções (colunas) do projeto Asana
 * 
 * Execute com:
 *   node scripts/list-asana-sections.js
 * 
 * Certifique-se de ter ASANA_ACCESS_TOKEN e ASANA_PROJECT_GID configurados no .env.local
 */

require('dotenv').config({ path: '.env.local' });

const ASANA_API_BASE = 'https://app.asana.com/api/1.0';

async function listSections() {
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

  console.log('🔍 Buscando seções do projeto Asana...\n');

  try {
    const response = await fetch(`${ASANA_API_BASE}/projects/${projectGid}/sections`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const sections = data.data;

    if (!sections || sections.length === 0) {
      console.log('⚠️  Nenhuma seção encontrada no projeto.');
      return;
    }

    console.log('📋 Seções encontradas:\n');
    console.log('─'.repeat(60));
    
    sections.forEach((section, index) => {
      console.log(`  ${index + 1}. ${section.name}`);
      console.log(`     GID: ${section.gid}`);
      console.log('');
    });

    console.log('─'.repeat(60));
    console.log('\n📝 Copie os GIDs para o .env.local:\n');
    
    // Tenta mapear automaticamente baseado nos nomes comuns
    const mapping = {
      pending: null,
      in_progress: null,
      completed: null,
      cancelled: null,
    };

    sections.forEach(section => {
      const name = section.name.toLowerCase();
      if (name.includes('pendente') || name.includes('pending') || name.includes('to do') || name.includes('a fazer')) {
        mapping.pending = section.gid;
      } else if (name.includes('progresso') || name.includes('progress') || name.includes('doing') || name.includes('em andamento')) {
        mapping.in_progress = section.gid;
      } else if (name.includes('concluíd') || name.includes('complet') || name.includes('done') || name.includes('feit')) {
        mapping.completed = section.gid;
      } else if (name.includes('cancelad') || name.includes('cancel')) {
        mapping.cancelled = section.gid;
      }
    });

    console.log(`ASANA_SECTION_PENDING=${mapping.pending || ''}`);
    console.log(`ASANA_SECTION_IN_PROGRESS=${mapping.in_progress || ''}`);
    console.log(`ASANA_SECTION_COMPLETED=${mapping.completed || ''}`);
    console.log(`ASANA_SECTION_CANCELLED=${mapping.cancelled || ''}`);
    
    console.log('\n⚠️  Verifique se o mapeamento automático está correto!');
    console.log('   Se não estiver, copie manualmente os GIDs das seções acima.');

  } catch (error) {
    console.error('❌ Erro ao buscar seções:', error.message);
    process.exit(1);
  }
}

listSections();
