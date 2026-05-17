# 🧠 Documentação Completa - Agente Inteligente

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Como Funciona](#como-funciona)
4. [Prompts e Instruções](#prompts-e-instruções)
5. [Ações Disponíveis](#ações-disponíveis)
6. [Integração com Banco de Dados](#integração-com-banco-de-dados)
7. [Tratamento de Erros](#tratamento-de-erros)
8. [Performance e Otimização](#performance-e-otimização)
9. [Segurança](#segurança)

---

## Visão Geral

O **Agente Inteligente** do Beleza Ecosystem é um assistente de IA que:

- ✅ Processa mensagens em linguagem natural
- ✅ Analisa dados do negócio em tempo real
- ✅ Detecta e executa ações automáticas
- ✅ Fornece recomendações estratégicas
- ✅ Integra com banco de dados PostgreSQL

### Diferenças do AI Assistant Existente

| Aspecto | AI Assistant | Agente Inteligente |
|--------|-------------|------------------|
| **Engine** | Regras/Heurísticas | OpenAI GPT-4o-mini |
| **Tipo** | Passive (derives data) | Active (takes action) |
| **Ações** | Apenas leitura | Leitura + Escrita |
| **Rota** | `/api/ai` | `/api/ia` |
| **Foco** | Dashboard metrics | Business automation |

---

## Arquitetura

### Estrutura de Pastas

```
backend/src/
├── agent/                          # 🧠 Core Agent Module
│   ├── agent.service.js            # Serviço principal (OpenAI)
│   ├── actionParser.js             # Parser de ações [AÇÃO: ...]
│   ├── prompt.js                   # PROMPT_BASE do agente
│   ├── example.js                  # Script de teste
│   ├── index.js                    # Exports
│   ├── README.md                   # Guia rápido
│   └── AGENT_DOCS.md              # (Este arquivo)
│
├── services/
│   ├── actions.service.js          # Executa ações (CRUD)
│   └── index.js                    # Exports
│
├── controllers/
│   └── agent.controller.js         # HTTP Controller
│
├── routes/
│   └── agent.routes.js             # Rotas /api/ia
│
└── app.multitenant.js              # App principal (integração)
```

### Fluxo de Dados

```
┌─────────────────┐
│   Cliente HTTP  │
│   POST /api/ia  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  AgentController.processMessage  │
└────────┬────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  AgentService.processMessage     │  ← OpenAI API call
│  - Monta PROMPT_BASE             │
│  - Injeta contexto dinâmico      │
│  - Chama OpenAI                  │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  ActionParser.parseActions       │
│  - Detecta [AÇÃO: ...]          │
│  - Extrai parâmetros JSON        │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  ActionsService.execute          │  ← Executa funções reais
│  - Valida parâmetros             │
│  - Executa CRUD no BD            │
│  - Retorna resultado             │
└────────┬─────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  Resposta Completa                 │
│  {                                 │
│    response: "Texto da IA",        │
│    actions: [...],                 │
│    metadata: {...}                 │
│  }                                 │
└────────────────────────────────────┘
```

---

## Como Funciona

### 1. Recebimento de Mensagem

```javascript
POST /api/ia
{
  "message": "Como aumento meu faturamento?",
  "establishmentId": "uuid-estabelecimento"
}
```

### 2. Preparação do Contexto

O `AgentService` busca dados do estabelecimento:

```javascript
const establishmentData = {
  name: "Salão Central",
  totalClients: 250,
  monthlyRevenue: 15000,
  appointmentsThisMonth: 95,
  averageTicket: 157.89,
  activeServices: 12,
  inactiveClients: 35
};
```

Esses dados são **injetados** no prompt:

```javascript
// Antes
const systemPrompt = PROMPT_BASE.replace(
  '{CONTEXTO_DINAMICO}',
  dynamicContext
);
```

### 3. Chamada à OpenAI

```javascript
const response = await this.openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: message }
  ],
  temperature: 0.7,
  max_tokens: 2000
});
```

### 4. Parsing de Ações

A resposta da IA contém marcadores de ação:

```
Vou criar uma promoção para aumentar vendas:

[AÇÃO: salvar_anuncio]
Parâmetros: { 
  titulo: "Promoção Noite", 
  descricao: "Segunda a sexta à noite com 20% off",
  cta: "Reserve agora",
  tipo: "promocao"
}

Isso pode gerar +R$ 2.000/mês!
```

O `ActionParser` extrai as ações usando regex:

```javascript
const ACTION_REGEX = /\[AÇÃO:\s*(\w+)\]\s*\n\s*Parâmetros:\s*({[\s\S]*?})/g;
```

### 5. Execução de Ações

```javascript
// Detecta ação "salvar_anuncio"
const handler = getActionHandler("salvar_anuncio");  // → "saveAnnouncement"

// Executa
const result = await actionsService[handler](params);
```

### 6. Retorno ao Cliente

```json
{
  "success": true,
  "response": "[RESPOSTA DO AGENTE]",
  "actions": [
    {
      "name": "salvar_anuncio",
      "status": "success",
      "result": { ... }
    }
  ],
  "metadata": { ... }
}
```

---

## Prompts e Instruções

### PROMPT_BASE

Localização: `src/agent/prompt.js`

O PROMPT_BASE define o comportamento completo do agente:

```javascript
const PROMPT_BASE = `Você é o AGENTE INTELIGENTE do Beleza Ecosystem...
- FERRAMENTAS DISPONÍVEIS
- REGRAS DE DECISÃO
- FORMATO DE RESPOSTA
- EXEMPLOS
`
```

### Contexto Dinâmico

Injetado em tempo de execução:

```javascript
// Antes (template)
{CONTEXTO_DINAMICO}

// Depois (injetado)
**Estabelecimento:** Salão Central
**Clientes ativos:** 250
**Receita este mês:** R$ 15.000
...
```

### Temperatura do Modelo

```javascript
temperature: 0.7  // Balanço entre criatividade e precisão
```

- `0.0` = Determinístico (sempre mesma resposta)
- `0.7` = Criativo mas consistente ✅
- `1.0` = Muito aleatório

---

## Ações Disponíveis

### 1. criar_agendamento

Criar um novo agendamento.

```javascript
[AÇÃO: criar_agendamento]
Parâmetros: {
  clientId: "uuid-cliente",
  dataHora: "2026-05-10T14:00:00",
  servicoId: "uuid-servico",
  profissionalId: "uuid-profissional"
}
```

**Validações:**
- ✅ clientId obrigatório
- ✅ dataHora obrigatório (ISO 8601)
- ✅ servicoId obrigatório
- ✅ profissionalId opcional

**Retorno:**
```javascript
{
  success: true,
  data: { Appointment object },
  message: "Agendamento criado com sucesso para João"
}
```

---

### 2. atualizar_agendamento

Atualizar um agendamento existente.

```javascript
[AÇÃO: atualizar_agendamento]
Parâmetros: {
  agendamentoId: "uuid-agendamento",
  dataHora: "2026-05-10T15:00:00",
  status: "confirmado"
}
```

---

### 3. listar_agendamentos

Listar agendamentos por período e filtros.

```javascript
[AÇÃO: listar_agendamentos]
Parâmetros: {
  dataInicio: "2026-05-01",
  dataFim: "2026-05-31",
  status: "agendado"
}
```

**Retorno:**
```javascript
{
  success: true,
  data: [ ... ],
  count: 25
}
```

---

### 4. salvar_anuncio

Criar campanha de marketing/anúncio.

```javascript
[AÇÃO: salvar_anuncio]
Parâmetros: {
  titulo: "Promoção Manicure",
  descricao: "Manicure express com 30% de desconto",
  cta: "Clique para agendar",
  tipo: "promocao"
}
```

**Tipos válidos:**
- `promocao` - Promoção
- `desconto` - Desconto
- `anuncio` - Anúncio geral
- `event` - Evento

---

### 5. gerar_relatorio

Gerar relatório de desempenho.

```javascript
[AÇÃO: gerar_relatorio]
Parâmetros: {
  tipo: "vendas",
  periodo: "30"
}
```

**Tipos:**
- `vendas` - Relatório de vendas
- `clientes` - Análise de clientes
- `desempenho` - Desempenho geral

**Retorno:**
```javascript
{
  success: true,
  data: {
    tipo: "vendas",
    periodo: "30 dias",
    agendamentos: 95,
    receita: 15000,
    clientesNovos: 12,
    ticketMedio: "157.89"
  }
}
```

---

### 6. consultar_clientes

Buscar clientes por filtro.

```javascript
[AÇÃO: consultar_clientes]
Parâmetros: {
  filtro: "João",
  limite: 10
}
```

---

### 7. enviar_whatsapp

Enviar mensagem WhatsApp (mock atualmente).

```javascript
[AÇÃO: enviar_whatsapp]
Parâmetros: {
  telefone: "+5511999999999",
  mensagem: "Olá! Confirmando seu agendamento..."
}
```

**⚠️ Nota:** Atualmente retorna mock. Integração real pendente com Twilio.

---

### 8. analisar_desempenho

Análise detalhada de desempenho.

```javascript
[AÇÃO: analisar_desempenho]
Parâmetros: {
  dataInicio: "2026-04-01",
  dataFim: "2026-04-30"
}
```

**Retorno:**
```javascript
{
  success: true,
  data: {
    totalAgendamentos: 95,
    receita: 15000,
    ticketMedio: "157.89",
    servicosMaisVendidos: [
      { servico: "Cabelo", agendamentos: 35, receita: 5250 },
      ...
    ]
  }
}
```

---

## Integração com Banco de Dados

### Modelos Utilizados

```javascript
// src/models/

Appointment     // Agendamentos
Client          // Clientes
Service         // Serviços
Professional    // Profissionais
MarketingCampaign // Campanhas
FinancialEntry  // Entradas financeiras
```

### Exemplo: Criar Agendamento

```javascript
// ActionsService.createAppointment()

const appointment = await Appointment.create({
  ClientId: clientId,
  ServiceId: servicoId,
  ProfessionalId: profissionalId || null,
  EstablishmentId: estabelecimentoId,
  appointmentDateTime: new Date(dataHora),
  status: 'agendado',
  notes: 'Criado pelo agente IA'
});
```

### Queries com Sequelize

```javascript
// Exemplo: Listar agendamentos com includes
const appointments = await Appointment.findAll({
  where: {
    EstablishmentId: estabelecimentoId,
    appointmentDateTime: {
      [sequelize.Op.between]: [dataInicio, dataFim]
    }
  },
  include: ['Client', 'Service'],
  order: [['appointmentDateTime', 'DESC']]
});
```

---

## Tratamento de Erros

### Níveis de Erro

**1. Erro na OpenAI API**
```javascript
try {
  const response = await this.openai.chat.completions.create(...);
} catch (error) {
  logger.error('[AGENT] Erro ao processar mensagem:', error);
  throw new Error(`Erro ao processar mensagem: ${error.message}`);
}
```

**2. Erro ao executar ação**
```javascript
executedActions.push({
  name: action.name,
  status: 'error',
  error: error.message
});
```

**3. Erro ao fazer parse**
```javascript
try {
  const params = JSON.parse(paramsStr);
} catch (error) {
  console.error(`Erro ao fazer parse dos parâmetros da ação ${actionName}:`, error);
  // Continua processando próximas ações
}
```

### Tratamento Gracioso

```javascript
// Não interrompe por completo, continua processando
for (const action of actions) {
  try {
    // Executar
  } catch (error) {
    // Log do erro
    // Registra como erro
    // Continua com próxima ação
  }
}
```

---

## Performance e Otimização

### 1. Caching de Contexto

```javascript
// Oportunidade futura
const cache = new Map();
const contextoKey = `estabelecimento:${estabelecimentoId}`;
if (cache.has(contextoKey)) {
  const estabelecimentoData = cache.get(contextoKey);
}
```

### 2. Batch Processing

```javascript
// Para múltiplas ações
Promise.all(actions.map(action => executeAction(action)))
```

### 3. Rate Limiting

```javascript
// app.multitenant.js
app.use('/api/ia', 
  agentLimiter,  // Rate limit
  requireActiveSubscription(), 
  agentRoutes
);
```

### 4. Token Management

```javascript
// Monitorar uso de tokens
{
  metadata: {
    tokensUsed: 1523,
    estimatedCost: 0.0012  // Futuro
  }
}
```

---

## Segurança

### 1. Autenticação

```javascript
// Todas as rotas POST requerem JWT
router.post('/', authenticate, AgentController.processMessage);
```

### 2. Validação de Entrada

```javascript
// No controller
if (!message || !establishmentId) {
  return res.status(400).json({
    success: false,
    error: 'Mensagem e establishmentId são obrigatórios'
  });
}
```

### 3. Isolamento por Tenant

```javascript
// Cada ação inclui establishmentId
action.params.estabelecimentoId = establishmentId;

// Queries sempre filtram por tenant
where: { EstablishmentId: estabelecimentoId }
```

### 4. Sanitização de Ações

```javascript
// Validar ação antes de executar
if (!isValidAction(action.name)) {
  logger.warn(`[CONTROLLER] Ação inválida: ${action.name}`);
  continue;
}
```

### 5. Proteção de Chaves

```env
OPENAI_API_KEY=sua_chave_aqui  # Nunca commitar
```

---

## 🚀 Próximos Passos

- [ ] Integração WhatsApp real
- [ ] Histórico de conversas
- [ ] Feedback loop (usuário avalia ações)
- [ ] Multi-idioma
- [ ] Análise de sentimento
- [ ] Sugestões automáticas baseadas em padrões
- [ ] Webhooks para eventos
- [ ] Custom actions por estabelecimento

---

**Versão:** 1.0.0  
**Última atualização:** 28 de abril de 2026  
**Desenvolvido para:** Beleza Ecosystem
