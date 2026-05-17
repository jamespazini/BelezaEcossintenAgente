# 📊 Arquitetura Visual - Agente Inteligente

## Fluxo Completo de Processamento

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         🧠 AGENTE INTELIGENTE                               │
│                      Beleza Ecosystem - SaaS                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1️⃣  CAMADA DE APRESENTAÇÃO                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   Frontend (Vite)                  Mobile App                API Postman     │
│   ┌──────────────┐                ┌──────────────┐        ┌──────────────┐ │
│   │ React Chat   │                │ React Native │        │ HTTP Client  │ │
│   │ Component    │                │   Component  │        │              │ │
│   └──────┬───────┘                └──────┬───────┘        └──────┬───────┘ │
│          │                                │                      │         │
│          └────────────────────────────────┴──────────────────────┘         │
│                              ▼                                              │
│                      POST /api/ia                                          │
│                   {"message": "...",                                        │
│                    "establishmentId": "..."}                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 2️⃣  CAMADA DE AUTENTICAÇÃO & VALIDAÇÃO                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────┐          │
│   │ AgentController.processMessage()                            │          │
│   │ ├─ Validar entrada (message + establishmentId)             │          │
│   │ ├─ Verificar JWT token (authenticate middleware)           │          │
│   │ └─ Buscar dados do estabelecimento no BD                   │          │
│   └───────────────────┬─────────────────────────────────────────┘          │
│                       │                                                     │
│                       ▼                                                     │
│            Dados do Estabelecimento:                                       │
│            ├─ Nome                                                         │
│            ├─ Total de clientes                                            │
│            ├─ Receita mensal                                               │
│            ├─ Agendamentos este mês                                        │
│            └─ Ticket médio                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 3️⃣  CAMADA DE PROCESSAMENTO IA                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   AgentService.processMessage()                                            │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────┐             │
│   │ 1. Injetar Contexto Dinâmico no PROMPT_BASE             │             │
│   │                                                           │             │
│   │    PROMPT_BASE = `                                       │             │
│   │    Você é o AGENTE INTELIGENTE...                       │             │
│   │    FERRAMENTAS: [criar_agendamento, ...]                │             │
│   │    {CONTEXTO_DINAMICO}  ← INJETADO AQUI                 │             │
│   │    `                                                      │             │
│   └──────────────────┬───────────────────────────────────────┘             │
│                      │                                                      │
│                      ▼                                                      │
│   ┌──────────────────────────────────────────────────────────┐             │
│   │ 2. Chamar OpenAI API (gpt-4o-mini)                       │             │
│   │                                                           │             │
│   │    openai.chat.completions.create({                      │             │
│   │      model: "gpt-4o-mini",                               │             │
│   │      messages: [                                         │             │
│   │        {role: "system", content: PROMPT_COMPLETO},      │             │
│   │        {role: "user", content: message}                 │             │
│   │      ],                                                   │             │
│   │      temperature: 0.7,                                   │             │
│   │      max_tokens: 2000                                    │             │
│   │    })                                                     │             │
│   └──────────────────┬───────────────────────────────────────┘             │
│                      │                                                      │
│                      ▼                                                      │
│                  🌐 OpenAI                                                   │
│              ┌─────────────┐                                                │
│              │ GPT-4o-mini │  ← Processa e gera resposta                   │
│              └─────────────┘                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 4️⃣  CAMADA DE PARSING DE AÇÕES                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ActionParser.parseActions(response)                                      │
│                                                                              │
│   OpenAI Response:                                                          │
│   ┌────────────────────────────────────────────────────────┐               │
│   │ "Análise do seu negócio...                             │               │
│   │                                                         │               │
│   │  [AÇÃO: salvar_anuncio]                               │               │
│   │  Parâmetros: {                                         │               │
│   │    titulo: "Promoção",                                 │               │
│   │    descricao: "20% off",                               │               │
│   │    cta: "Reserve agora",                               │               │
│   │    tipo: "promocao"                                    │               │
│   │  }                                                      │               │
│   │                                                         │               │
│   │  Impacto: +R$ 2.000/mês"                              │               │
│   └────────────────────────────────────────────────────────┘               │
│          │                                                                   │
│          ▼                                                                   │
│   ┌────────────────────────────────────────────────────────┐               │
│   │ Regex: /\[AÇÃO:\s*(\w+)\].*?Parâmetros:\s*({...})/g  │               │
│   │                                                         │               │
│   │ Extrai:                                                │               │
│   │ ├─ name: "salvar_anuncio"                             │               │
│   │ ├─ params: { titulo, descricao, cta, tipo }          │               │
│   │ └─ rawText: "[AÇÃO: ...]"                            │               │
│   └────────────────────────────────────────────────────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 5️⃣  CAMADA DE EXECUÇÃO DE AÇÕES                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Para cada ação detectada:                                                │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────┐              │
│   │ 1. Validar ação                                         │              │
│   │    isValidAction("salvar_anuncio") → true              │              │
│   │                                                         │              │
│   │ 2. Mapear para handler                                 │              │
│   │    getActionHandler("salvar_anuncio")                  │              │
│   │    → "saveAnnouncement"                                │              │
│   │                                                         │              │
│   │ 3. Executar ação                                       │              │
│   │    ActionsService.saveAnnouncement(params)            │              │
│   └─────────────────┬───────────────────────────────────────┘              │
│                     │                                                       │
│          ┌──────────┴──────────┐                                           │
│          │                     │                                           │
│          ▼                     ▼                                           │
│  ┌──────────────────┐  ┌──────────────────┐                               │
│  │  Validar Dados   │  │  Adicionar Contexto                              │
│  │  - Obrigatórios  │  │  - establishment                                 │
│  │  - Formatos      │  │  - timestamps                                    │
│  │  - Ranges        │  │  - user_id                                       │
│  └─────────┬────────┘  └─────────┬────────┘                               │
│            │                     │                                         │
│            └─────────┬───────────┘                                         │
│                      ▼                                                      │
│         Executar no PostgreSQL (Sequelize)                                 │
│                      │                                                      │
│         ┌────────────┴────────────┐                                        │
│         │                         │                                        │
│         ▼                         ▼                                        │
│    CREATE (INSERT)          UPDATE/DELETE                                  │
│    Novo registro            Registro existente                             │
│                                                                              │
│         ▼                         ▼                                        │
│    ┌──────────────────────────────────────┐                                │
│    │ MarketingCampaign criado:            │                                │
│    │ ├─ id: uuid-123                      │                                │
│    │ ├─ EstablishmentId: ...              │                                │
│    │ ├─ name: "Promoção"                  │                                │
│    │ ├─ description: "20% off"            │                                │
│    │ └─ status: "ativo"                   │                                │
│    └──────────────────────────────────────┘                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 6️⃣  CAMADA DE RESPOSTA                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   AgentController.processMessage() retorna:                                │
│                                                                              │
│   {                                                                          │
│     success: true,                                                          │
│     response: "[TEXTO DA IA COMPLETO]",                                    │
│     actions: [                                                              │
│       {                                                                      │
│         name: "salvar_anuncio",                                            │
│         status: "success",                                                  │
│         result: {                                                           │
│           success: true,                                                    │
│           data: { id, name, description, ... },                            │
│           message: "Anúncio criado com sucesso"                            │
│         }                                                                    │
│       }                                                                      │
│     ],                                                                       │
│     metadata: {                                                             │
│       model: "gpt-4o-mini",                                                │
│       tokensUsed: 1523,                                                    │
│       timestamp: "2026-04-28T10:30:00.000Z",                               │
│       establishmentId: "..."                                               │
│     }                                                                        │
│   }                                                                          │
│                                                                              │
│          ▼                                                                   │
│       HTTP 200 OK                                                           │
│          │                                                                   │
└──────────┼──────────────────────────────────────────────────────────────────┘
           │
           ▼
    ┌─────────────────────────────────────────┐
    │ Frontend/App recebe resposta            │
    │ ├─ Exibe mensagem da IA                │
    │ ├─ Mostra ações executadas             │
    │ ├─ Atualiza UI com dados               │
    │ └─ Log de operação                     │
    └─────────────────────────────────────────┘


```

---

## 📦 Camadas Técnicas

### Layer 1: HTTP API
```
GET  /api/ia           (info)
POST /api/ia           (message)
GET  /api/ia/health    (status)
```

### Layer 2: Controllers
```
AgentController
├─ processMessage()
├─ health()
└─ getInfo()
```

### Layer 3: Services
```
AgentService (OpenAI)
└─ processMessage()

ActionsService (Database)
├─ createAppointment()
├─ updateAppointment()
├─ listAppointments()
├─ saveAnnouncement()
├─ generateReport()
├─ consultClients()
├─ sendWhatsApp()
└─ analyzePerformance()
```

### Layer 4: Models (Sequelize)
```
Appointment
Client
Service
Professional
MarketingCampaign
FinancialEntry
```

### Layer 5: Database
```
PostgreSQL
├─ appointments
├─ clients
├─ services
├─ professionals
├─ marketing_campaigns
└─ financial_entries
```

---

## 🔄 Ciclo de Vida de uma Ação

```
┌─────────────────────────────────────────────────────────┐
│ AÇÃO DETECTADA                                          │
│ "[AÇÃO: criar_agendamento]"                            │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
        ┌─────────────────────────────────┐
        │ 1. VALIDAR AÇÃO                 │
        │ isValidAction()                 │
        │ ✅ Ação existe?                │
        └──────────────┬──────────────────┘
                       │
                       ▼
        ┌─────────────────────────────────┐
        │ 2. MAPEAR HANDLER               │
        │ getActionHandler()              │
        │ → "createAppointment"           │
        └──────────────┬──────────────────┘
                       │
                       ▼
        ┌─────────────────────────────────┐
        │ 3. INJETAR CONTEXTO             │
        │ params.estabelecimentoId        │
        │ params.userId                   │
        └──────────────┬──────────────────┘
                       │
                       ▼
        ┌─────────────────────────────────┐
        │ 4. VALIDAR PARÂMETROS           │
        │ - Obrigatórios                  │
        │ - Tipos corretos                │
        │ - Ranges                        │
        └──────────────┬──────────────────┘
                       │
        ┌──────────────┴──────────────────┐
        │                                 │
        ▼                                 ▼
    ❌ INVÁLIDO                      ✅ VÁLIDO
    └─────────────────────────────────────────────┐
                                                   │
                                                   ▼
                                   ┌──────────────────────────┐
                                   │ 5. EXECUTAR NO BD        │
                                   │ await Appointment.create │
                                   └────────────┬─────────────┘
                                                │
                                   ┌────────────┴─────────────┐
                                   │                          │
                                   ▼                          ▼
                              ✅ SUCESSO                  ❌ ERRO
                              ├─ Data: {...}             └─ Log erro
                              ├─ ID: uuid                 └─ Continua próxima
                              └─ Status: OK
```

---

## 🛡️ Camada de Segurança

```
┌────────────────────────────────────────────────────────┐
│ REQUEST CHEGA                                          │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
            ┌───────────────────────────┐
            │ 1. AUTENTICAÇÃO           │
            │ ├─ JWT válido?            │
            │ ├─ Não expirado?          │
            │ └─ Assinatura OK?         │
            └────────────┬──────────────┘
                         │
                    ┌────┴────┐
                    │          │
                    ▼          ▼
                ❌ Reject   ✅ Continue
                            │
                            ▼
                ┌───────────────────────────┐
                │ 2. VALIDAÇÃO             │
                │ ├─ Message não vazio?    │
                │ ├─ EstablishmentId OK?   │
                │ └─ Formato correto?      │
                └────────────┬──────────────┘
                             │
                             ▼
                ┌───────────────────────────┐
                │ 3. ISOLAMENTO POR TENANT  │
                │ ├─ User pertence tenant?  │
                │ ├─ Tenant ativo?         │
                │ └─ Subscrição válida?    │
                └────────────┬──────────────┘
                             │
                             ▼
                ┌───────────────────────────┐
                │ 4. RATE LIMITING          │
                │ ├─ IP não excedeu?       │
                │ ├─ Tenant não excedeu?   │
                │ └─ Usuário não excedeu?  │
                └────────────┬──────────────┘
                             │
                             ▼
                ┌───────────────────────────┐
                │ 5. VALIDAR AÇÕES          │
                │ ├─ Ação permitida?       │
                │ ├─ Tenant tem direito?   │
                │ └─ Recurso existe?       │
                └────────────┬──────────────┘
                             │
                        ┌────┴────┐
                        │          │
                        ▼          ▼
                    ❌ Block    ✅ Proceed
```

---

## 📡 Fluxo de Dados (Simplificado)

```
FRONTEND
   ↓
HTTP POST /api/ia
   ↓
AgentController
   ├─→ Autenticação (JWT)
   ├─→ Validação de entrada
   └─→ Buscar estabelecimento
   ↓
AgentService
   ├─→ Injetar contexto
   ├─→ Chamar OpenAI
   └─→ Receber resposta
   ↓
ActionParser
   ├─→ Regex match [AÇÃO: ...]
   └─→ Extrair parâmetros
   ↓
For each Action:
   ├─→ Validar ação
   ├─→ Mapear handler
   └─→ ActionsService
       ├─→ Validar parâmetros
       └─→ ExecutSQL no PostgreSQL
           ├─→ INSERT/UPDATE/SELECT
           └─→ Retornar resultado
   ↓
Compilar resposta
   ├─→ Mensagem da IA
   ├─→ Ações executadas
   └─→ Metadata
   ↓
HTTP 200 OK
   ↓
FRONTEND
   ├─→ Exibe mensagem
   ├─→ Mostra dados
   └─→ Atualiza UI
```

---

## 🎯 Resumo de Componentes

| Componente | Função | Localização |
|-----------|--------|------------|
| **Agent Service** | Integração OpenAI | `agent.service.js` |
| **Action Parser** | Parse de ações | `actionParser.js` |
| **Prompt Base** | Instruções da IA | `prompt.js` |
| **Actions Service** | Executa ações | `actions.service.js` |
| **Agent Controller** | HTTP Handler | `agent.controller.js` |
| **Agent Routes** | Endpoints | `agent.routes.js` |
| **Models** | Banco de dados | `models/` |

---

**Última atualização:** 28 de Abril de 2026  
**Versão:** 1.0.0
