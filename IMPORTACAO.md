# 📥 Guia de Importação de Dados

Este guia explica como importar dados históricos de tarefas do arquivo Excel para o sistema.

## 🚀 Comandos Rápidos

### Importar dados de 2025
```bash
npm run import:2025
```

### Limpar dados importados
```bash
npm run import:clear
```

### Gerar relatório de importação
```bash
npm run import:report
```

### Verificar dados no banco
```bash
npm run import:verify
```

---

## 📋 Processo Completo de Importação

### 1. Preparar o arquivo Excel

Coloque o arquivo `.xlsx` na pasta `import-file/` com o nome:
```
Relação de serviços prestados em 2025.xlsx
```

### 2. Estrutura esperada do arquivo

O arquivo deve conter:
- **Aba Dashboard**: Contém totais por mês (será ignorada na importação)
- **Abas de meses**: Fevereiro, Março, Abril, etc. (serão importadas)

#### Colunas necessárias (podem variar por mês):
- `Data` ou `Data da Solicitação`
- `Categoria`
- `Cliente` (opcional - padrão: A2 Horizons)
- `Item` (título da tarefa)
- `Esforço Estimado` ou `Esforço Estimado (h)`
- `Entregue em:` ou `Data da Entrega`
- `Observações` (opcional - usa o Item se não existir)

### 3. Executar a importação

#### Opção 1: Importação limpa (recomendado)
```bash
npm run import:clear && npm run import:2025
```

#### Opção 2: Apenas importar (adiciona aos dados existentes)
```bash
npm run import:2025
```

### 4. Verificar o resultado

```bash
npm run import:report
```

Você verá:
- Total de tarefas importadas
- Clientes e categorias criados
- Comparativo com os dados do Dashboard
- Valor total importado

---

## ⚙️ Regras de Importação

### Conversão de Valores
- **1 hora de esforço = R$ 100,00**
- Exemplo: 2.5h → R$ 250,00

### Clientes
- Se o cliente não existir, será criado automaticamente
- Email padrão: `cliente@cliente.com`
- Telefone padrão: `(00) 00000-0000`

### Categorias
- Se a categoria não existir, será criada automaticamente
- Cores e ícones pré-definidos para categorias conhecidas:
  - **E-mail MKT**: Laranja, ícone de email
  - **E-mail**: Azul, ícone de email
  - **Sustentação**: Verde, ícone de ferramenta
  - **Conteúdo**: Cinza, ícone de pasta

### Tarefas
- Status padrão: `completed` (concluída)
- Usuário: `root` (usuário sistema)
- Descrição: Usa "Observações" se disponível, caso contrário usa o "Item"

---

## 🔍 Scripts Disponíveis

### `import-full-2025.js`
Script principal de importação. Lê o arquivo Excel e insere todos os dados no banco.

### `clear-imported-data.js`
Remove todos os clientes, categorias e tarefas do banco (mantém usuários).

### `generate-report.js`
Gera um relatório comparativo entre o Dashboard e os dados importados.

### `verify-database.js`
Lista informações detalhadas sobre os dados no banco de dados.

### `analyze-excel.js`
Analisa a estrutura do arquivo Excel (útil para debug).

### `verify-totals.js`
Verifica se os totais batem com o Dashboard do Excel.

---

## 📊 Exemplo de Saída

```
🚀 Iniciando importação...

📦 Processando: Fevereiro
   👤 Cliente criado: A2 Horizons
   🏷️  Categoria criada: E-mail MKT
   ✓ Fevereiro concluído

📦 Processando: Março
   👤 Cliente criado: Sírio-Libanês
   🏷️  Categoria criada: E-mail
   ✓ Março concluído

==================================================
✅ IMPORTAÇÃO CONCLUÍDA!
==================================================
👤 Clientes criados: 8
🏷️  Categorias criadas: 5
📋 Tarefas criadas: 247

📊 Validando com Dashboard...
💰 Valor total importado: R$ 26.600,00
```

---

## ⚠️ Solução de Problemas

### Erro: "Usuário root não encontrado"
Execute o seed de usuários primeiro:
```bash
npm run users:seed
```

### Erro: "Arquivo não encontrado"
Verifique se o arquivo está em `import-file/` com o nome correto.

### Diferença nos valores
Pequenas diferenças (<5%) são normais devido a:
- Arredondamentos
- Variações nas colunas entre meses
- Formato do Excel

### Duplicação de dados
Se executar a importação múltiplas vezes, os dados serão duplicados.
Use `npm run import:clear` antes de reimportar.

---

## 📝 Notas Importantes

1. **Backup**: Sempre faça backup do banco antes de importar dados
2. **Testes**: Teste a importação em ambiente de desenvolvimento primeiro
3. **Validação**: Verifique o relatório após cada importação
4. **Produção**: Em produção, execute com cautela e monitore logs

---

## 🎯 Checklist de Importação

- [ ] Arquivo Excel está na pasta `import-file/`
- [ ] Nome do arquivo está correto
- [ ] Usuário root existe no banco (`npm run users:seed`)
- [ ] Backup do banco foi feito (se necessário)
- [ ] Executou `npm run import:clear` (se quiser dados limpos)
- [ ] Executou `npm run import:2025`
- [ ] Verificou o relatório com `npm run import:report`
- [ ] Testou a interface visual
- [ ] Validou os valores no Dashboard

---

Para mais informações, consulte o arquivo `RELATORIO_IMPORTACAO.md`.
