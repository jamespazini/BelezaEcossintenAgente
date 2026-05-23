# 🧠 Agente Inteligente - Beleza Ecosystem

## Visão Geral

O **Agente Inteligente** é um assistente de IA alimentado por OpenAI que ajuda profissionais de beleza a automatizar e crescer seus negócios.

### Capacidades Principais

✅ **Agendamentos** - Criar, atualizar e listar agendamentos  
✅ **Marketing** - Gerar anúncios e campanhas  
✅ **WhatsApp** - Enviar e receber mensagens com gravação de cliente e conversa  
✅ **Relatórios** - Análises de desempenho e faturamento  
✅ **Clientes** - Consultar e gerenciar  
✅ **Estratégia** - Sugerir ações para aumentar receita  

---

## 🚀 Configuração

### 1. Instalar Dependências

```bash
cd backend
npm install openai pg express cors dotenv
```

### 2. Configurar Variáveis de Ambiente

Copie e configure o arquivo `.env`:

```bash
cp .env.example .env
```

**Variáveis obrigatórias:**

```env
OPENAI_API_KEY=sua_chave_aqui
OPENAI_MODEL=gpt-4o-mini
DB_HOST=localhost
DB_PORT=5432
DB_NAME=beleza_ecosystem
DB_USER=postgres
DB_PASSWORD=yourpassword
```

### 3. Obter Chave da OpenAI

1. Acesse: https://platform.openai.com/api-keys
2. Crie uma nova chave
3. Cole em `OPENAI_API_KEY`

### 4. Iniciar o Servidor

```bash
npm run dev
```

---

## 📡 API Endpoints

### 1. Informações do Agente

**GET** `/api/ia`

```bash
curl http://localhost:3000/api/ia
```

**Resposta:**
```json
{
  "success": true,
  "message": "Agente Inteligente - Beleza Ecosystem",
  "endpoints": {
    "POST /api/ia": "Enviar mensagem para o agente",
    "GET /api/ia/health": "Verificar status da IA"
  }
}
```

### 2. Enviar Mensagem para o Agente

**POST** `/api/ia`

**Headers:**
```
Authorization: Bearer <seu_token_jwt>
Content-Type: application/json
```

**Body:**
```json
{
  "message": "Preciso aumentar meu faturamento",
  "establishmentId": "uuid-do-seu-estabelecimento"
}
```

**Resposta:**
```json
{
  "success": true,
  "response": "[RESPOSTA DO AGENTE COM AÇÕES]\n\n...",
  "actions": [
    {
      "name": "salvar_anuncio",
      "status": "success",
      "result": {
        "success": true,
        "data": { ... },
        "message": "Anúncio criado com sucesso"
      }
    }
  ],
  "metadata": {
    "model": "gpt-4o-mini",
    "tokensUsed": 1523,
    "timestamp": "2026-04-28T10:30:00.000Z",
    "establishmentId": "uuid..."
  }
}
```

### 3. Verificar Status da IA

**GET** `/api/ia/health`

```bash
curl http://localhost:3000/api/ia/health
```

**Resposta:**
```json
{
  "success": true,
  "message": "Agente IA está funcionando",
  "model": "gpt-4o-mini"
}
```

---

## 💬 Exemplos de Uso

### Exemplo 1: Aumentar Faturamento

```bash
curl -X POST http://localhost:3000/api/ia \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Como eu aumento meu faturamento em 30%?",
    "establishmentId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Resposta esperada:**
```
📊 Análise do seu negócio:
- Receita mensal: R$ 12.000
- Agendamentos: 80
- Ticket médio: R$ 150

💡 Oportunidades:
1. Clientes inativos (15%) 
2. Serviços não explorados
3. Horários ociosos

[AÇÃO: salvar_anuncio]
Parâmetros: { titulo: "Promoção", ... }
```

---

### Exemplo 2: Criar Agendamento

```bash
curl -X POST http://localhost:3000/api/ia \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Agende uma consulta para João Silva em 2026-05-10 às 14:00 para cabelo",
    "establishmentId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

---

### Exemplo 3: Gerar Relatório

```bash
curl -X POST http://localhost:3000/api/ia \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Quero um relatório dos últimos 30 dias",
    "establishmentId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

---

## 🧠 Arquitetura

```
backend/
├── src/
│   ├── agent/
│   │   ├── prompt.js              # PROMPT_BASE do agente
│   │   ├── actionParser.js        # Detecta ações [AÇÃO: ...]
│   │   └── agent.service.js       # Integração OpenAI
│   ├── services/
│   │   └── actions.service.js     # Executa ações reais
│   ├── controllers/
│   │   └── agent.controller.js    # Controlador HTTP
│   └── routes/
│       └── agent.routes.js        # Rotas /api/ia
```

### Fluxo de Processamento

```
1. Usuário envia mensagem
   ↓
2. AgentController recebe requisição
   ↓
3. AgentService chama OpenAI com PROMPT_BASE
   ↓
4. OpenAI retorna resposta + ações
   ↓
5. ActionParser detecta [AÇÃO: ...]
   ↓
6. ActionsService executa funções
   ↓
7. Retorna resposta + dados ao usuário
```

---

## 🔧 Personalization

### Modificar o PROMPT_BASE

Edite [src/agent/prompt.js](src/agent/prompt.js):

```javascript
const PROMPT_BASE = `Você é o AGENTE INTELIGENTE do Beleza Ecosystem...`
```

### Adicionar Nova Ação

1. Adicione em `src/agent/actionParser.js`:
```javascript
const validActions = [
  'criar_agendamento',
  'sua_nova_acao'  // ← Adicione aqui
];
```

2. Implemente em `src/services/actions.service.js`:
```javascript
async suaNovaAcao(params) {
  // Implementação
}
```

3. Atualize o `prompt.js` com a nova ação.

---

## 🐛 Debugging

### Ativar Debug Mode

```env
AGENT_DEBUG=true
```

### Logs Detalhados

```bash
npm run dev -- --inspect
```

### Testar Conexão OpenAI

```bash
curl http://localhost:3000/api/ia/health
```

---

## ⚠️ Limitações Atuais

- ✅ WhatsApp real com Twilio, webhook inbound, fila outbound e persistência de conversa  
- 🔒 Cliente novo é criado automaticamente no primeiro contato WhatsApp  
- ⏳ Contexto: Máximo de tokens limitado
- 🔄 Transações: Sem rollback automático

---

## 📚 Próximos Passos

- [x] Integrar WhatsApp real (Twilio/WhatsApp Business API)
- [x] Adicionar histórico de conversas
- [ ] Implementar feedback loop
- [ ] Multi-idioma
- [ ] Análise de sentimento
- [ ] Sugestões automáticas

---

## 🤝 Contribuir

Para adicionar funcionalidades:

1. Crie um branch: `git checkout -b feature/nova-acao`
2. Implemente a ação (3 arquivos)
3. Teste a integração
4. Faça PR

---

## 📞 Suporte

**Docs do Agente:** [AGENT_DOCS.md](AGENT_DOCS.md)  
**OpenAI Docs:** https://platform.openai.com/docs  
**Sequelize:** https://sequelize.org  

---

**Desenvolvido com ❤️ para o Beleza Ecosystem**
