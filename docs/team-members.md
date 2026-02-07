# Membros da Equipe e Distribuição de Custos

## Visão Geral

O módulo de Membros da Equipe permite cadastrar membros e distribuir o custo (esforço) de cada tarefa entre eles. A distribuição é **opcional** — tarefas podem existir sem distribuição de custo.

## Regras de Negócio

### Membros da Equipe
- Cada membro possui: **nome**, **cargo/função** (opcional), **ícone**, **cor** e **status** (ativo/inativo)
- Nomes devem ser únicos (case-insensitive)
- Membros inativos não aparecem no dropdown de distribuição
- Não é possível excluir um membro que possua distribuição de custo em alguma tarefa

### Distribuição de Custo
- A distribuição é **opcional** em cada tarefa
- Quando utilizada, a **soma dos valores** distribuídos **deve ser igual** ao custo total da tarefa
- Valores são em **pontos de custo** (não percentuais)
- Valor mínimo por membro: **0,1**
- Precisão: **1 casa decimal**
- Cada membro pode aparecer apenas uma vez por tarefa

### Interface de Distribuição
- A seção de distribuição aparece apenas quando o custo da tarefa é > 0 e existem membros cadastrados
- Utiliza **sliders de barra** (range inputs) para ajuste visual dos valores
- Exibe o **valor restante** a ser distribuído em tempo real
- Validação no frontend impede salvar se a soma ≠ custo total

## Modelo de Dados

### TeamMember
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| name | String | Sim | Nome do membro |
| role | String | Não | Cargo/função |
| icon | String | Não | Emoji (default: 👤) |
| color | String | Não | Cor hex (default: #3B82F6) |
| active | Boolean | Não | Se está ativo (default: true) |
| createdBy | String | Sim | ID do usuário criador |

### Task.costDistribution (Array)
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| teamMemberId | String | Sim | ID do membro |
| teamMemberName | String | Sim | Nome denormalizado |
| value | Number | Sim | Valor do custo atribuído |

## API

### Membros da Equipe

#### GET /api/team-members
Lista todos os membros da equipe.

**Query params:**
- `active` (boolean) - Filtrar por status

**Resposta:**
```json
{
  "teamMembers": [
    {
      "_id": "...",
      "name": "Ana Silva",
      "role": "Desenvolvedora",
      "icon": "👩‍💻",
      "color": "#3B82F6",
      "active": true
    }
  ]
}
```

#### POST /api/team-members
Cria um novo membro da equipe.

**Body:**
```json
{
  "name": "Ana Silva",
  "role": "Desenvolvedora",
  "icon": "👩‍💻",
  "color": "#3B82F6"
}
```

#### PUT /api/team-members/:id
Atualiza um membro. Se o nome for alterado, atualiza o nome denormalizado em todas as tarefas.

#### DELETE /api/team-members/:id
Remove um membro. Falha se existirem tarefas com distribuição para este membro.

### Estatísticas

#### GET /api/team-members/stats
Retorna totais de custo distribuído por membro.

**Resposta:**
```json
{
  "currentMonth": [
    { "_id": "member_id", "teamMemberName": "Ana Silva", "total": 25.5, "count": 8 }
  ],
  "allTime": [
    { "_id": "member_id", "teamMemberName": "Ana Silva", "total": 150.0, "count": 42 }
  ]
}
```

### Tarefas (campos adicionados)

Os endpoints `POST /api/tasks` e `PUT /api/tasks/:id` agora aceitam o campo opcional `costDistribution`:

```json
{
  "cost": 10,
  "costDistribution": [
    { "teamMemberId": "id1", "teamMemberName": "Ana Silva", "value": 6.0 },
    { "teamMemberId": "id2", "teamMemberName": "Bruno Santos", "value": 4.0 }
  ]
}
```

## Navegação

- **Cadastro de membros**: Página de Categorias (`/categories`) — seção "Membros da Equipe" no final da página
- **Distribuição de custo**: Modal de criação/edição de tarefas (`TaskModal`)
- **Visualização**: Modais de detalhes em `/tasks` e `/dashboard`
- **Estatísticas**: Card "Equipe (Mês Atual)" no Dashboard

## Scripts

| Script | Descrição |
|--------|-----------|
| `seed-team-members.js` | Popula membros de exemplo |
| `clear-team-members.js` | Remove todos os membros |
