## 🚀 SETUP - Agente Inteligente Beleza Ecosystem

### ✅ O que foi criado

Você agora tem um **Agente Inteligente completo** integrado ao Beleza Ecosystem!

#### Estrutura de Arquivos

```
backend/
├── src/
│   ├── agent/                      # 🧠 Agente IA (NOVO)
│   │   ├── agent.service.js       # Serviço principal OpenAI
│   │   ├── actionParser.js        # Parser de ações
│   │   ├── prompt.js              # PROMPT_BASE
│   │   ├── example.js             # Script de teste
│   │   ├── test-api.sh            # Testes shell
│   │   ├── postman_collection.json # Requests Postman
│   │   ├── README.md              # Guia rápido
│   │   ├── AGENT_DOCS.md          # Documentação completa
│   │   └── index.js               # Exports
│   │
│   ├── services/                   # (NOVO)
│   │   ├── actions.service.js     # Executa ações
│   │   └── index.js               # Exports
│   │
│   ├── controllers/
│   │   └── agent.controller.js    # (NOVO) HTTP Controller
│   │
│   ├── routes/
│   │   └── agent.routes.js        # (NOVO) Rotas /api/ia
│   │
│   └── app.multitenant.js         # MODIFICADO - Integração

├── .env.example                    # NOVO - Variáveis
└── package.json                    # MODIFICADO - +openai
```

---

## 📋 Passo-a-Passo de Inicialização

### 1️⃣ Instalar Dependências

```bash
cd backend
npm install
```

Isso instalará:
- ✅ `openai` (v6.35.0)
- ✅ Todas as outras dependências

### 2️⃣ Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar com seus dados
nano .env  # ou use editor de sua preferência
```

**Variáveis OBRIGATÓRIAS:**

```env
# OpenAI
OPENAI_API_KEY=sua_chave_aqui
OPENAI_MODEL=gpt-4o-mini

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=beleza_ecosystem
DB_USER=postgres
DB_PASSWORD=sua_senha
```

**Como obter OPENAI_API_KEY:**
1. Acesse: https://platform.openai.com/api-keys
2. Clique em "Create new secret key"
3. Copie a chave
4. Cole em `OPENAI_API_KEY`

### 3️⃣ Iniciar o Servidor

```bash
# Modo desenvolvimento (com hot-reload)
npm run dev

# Ou produção
npm start
```

Você deve ver:

```
[INFO] Beleza Ecosystem API running on port 3000
[INFO] Health check: http://localhost:3000/api/health
```

### 4️⃣ Testar o Agente

#### Opção A: cURL

```bash
# Testar saúde da IA
curl http://localhost:3000/api/ia/health

# Enviar mensagem (precisa de JWT token)
curl -X POST http://localhost:3000/api/ia \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Como aumento meu faturamento?",
    "establishmentId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

#### Opção B: Postman

1. Abra Postman
2. Clique em "Import"
3. Selecione: `backend/src/agent/postman_collection.json`
4. Configure as variáveis:
   - `base_url`: http://localhost:3000
   - `token`: Seu JWT token
   - `establishment_id`: ID do seu estabelecimento

#### Opção C: Script de Teste

```bash
# Editar o script com seus dados
nano backend/src/agent/test-api.sh

# Executar
bash backend/src/agent/test-api.sh
```

#### Opção D: Script Node.js

```bash
cd backend
node src/agent/example.js
```

---

## 🎯 Exemplos de Uso

### Exemplo 1: Estratégia de Faturamento

**Requisição:**
```json
{
  "message": "Como eu aumento meu faturamento em 30%?",
  "establishmentId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Resposta esperada:**
```
📊 Análise do seu negócio:
- Receita mensal: R$ 15.000
- Agendamentos: 95
- Ticket médio: R$ 157,89

🎯 Oportunidades identificadas:
1. 35 clientes inativos (14%)
2. Horários noturnos 60% ociosos
3. Serviço de manicure com margem não explorada

💡 Estratégia recomendada:

[AÇÃO: salvar_anuncio]
Parâmetros: {
  titulo: "Noite de Beleza",
  descricao: "Segunda a sexta à noite com 20% off",
  cta: "Reserve agora",
  tipo: "promocao"
}

Impacto estimado: +R$ 2.000/mês em receita
```

### Exemplo 2: Criar Agendamento

```json
{
  "message": "Agende uma consulta para João Silva em 2026-05-10 às 14:00 para corte de cabelo",
  "establishmentId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Exemplo 3: Gerar Relatório

```json
{
  "message": "Preciso de um relatório dos últimos 30 dias",
  "establishmentId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 🔧 Personalizações

### Modificar Prompt do Agente

Edite `backend/src/agent/prompt.js`:

```javascript
const PROMPT_BASE = `Você é o AGENTE INTELIGENTE...`
```

### Adicionar Nova Ação

1. **Passo 1:** Edite `actionParser.js`

```javascript
const validActions = [
  'criar_agendamento',
  'sua_nova_acao'  // ← Adicione
];

const handlers = {
  'sua_nova_acao': 'suaNovaAcao'  // ← Mapeie
};
```

2. **Passo 2:** Implemente em `actions.service.js`

```javascript
async suaNovaAcao(params) {
  // Sua implementação aqui
  return { success: true, data: {...} };
}
```

3. **Passo 3:** Atualize o `prompt.js`

```
[AÇÃO: sua_nova_acao]
Parâmetros: { campo1, campo2 }
```

---

## 🐛 Troubleshooting

### ❌ Erro: `OPENAI_API_KEY is not defined`

**Solução:**
```bash
# Verificar se .env existe
ls -la backend/.env

# Se não existir, criar
cp backend/.env.example backend/.env
nano backend/.env  # Editar com sua chave
```

### ❌ Erro: `Database connection failed`

**Solução:**
```bash
# Verificar se PostgreSQL está rodando
psql -h localhost -U postgres

# Verificar variáveis de banco
cat backend/.env | grep DB_
```

### ❌ Erro: `404 Not Found`

**Solução:**
```bash
# Verificar se servidor está rodando
curl http://localhost:3000/api/health

# Verificar se rota /api/ia existe
curl http://localhost:3000/api/ia
```

### ❌ Erro: `Unauthorized (401)`

**Solução:**
```bash
# POST requer JWT token
# GET /api/ia e /api/ia/health não precisam

curl -H "Authorization: Bearer SEU_TOKEN" \
  -X POST http://localhost:3000/api/ia \
  -d '{...}'
```

---

## 📚 Próximas Leituras

1. **Guia Rápido:** [backend/src/agent/README.md](./backend/src/agent/README.md)
2. **Documentação Completa:** [backend/src/agent/AGENT_DOCS.md](./backend/src/agent/AGENT_DOCS.md)
3. **OpenAI Docs:** https://platform.openai.com/docs
4. **Sequelize Docs:** https://sequelize.org

---

## ✨ Recursos Implementados

✅ **Agente IA com OpenAI**
- Processa mensagens em linguagem natural
- Integra com GPT-4o-mini

✅ **8 Ações Automáticas**
- criar_agendamento
- atualizar_agendamento
- listar_agendamentos
- salvar_anuncio
- gerar_relatorio
- consultar_clientes
- enviar_whatsapp
- analisar_desempenho

✅ **Parser de Ações**
- Detecta [AÇÃO: ...] nas respostas
- Valida parâmetros
- Executa funções reais

✅ **Integração com BD**
- PostgreSQL + Sequelize
- Isolamento por tenant
- Queries otimizadas

✅ **API REST Completa**
- GET /api/ia (info)
- POST /api/ia (enviar mensagem)
- GET /api/ia/health (status)

✅ **Documentação**
- README.md (guia rápido)
- AGENT_DOCS.md (completo)
- .env.example (config)
- postman_collection.json (requests)

---

## 🎓 Conclusão

Seu **Agente Inteligente** está pronto para:

1. 📞 Responder clientes
2. 📅 Gerenciar agendamentos
3. 📊 Analisar dados
4. 💰 Sugerir estratégias de faturamento
5. 🎯 Automatizar tarefas

**Use-o para crescer seu negócio! 🚀**

---

**Desenvolvido para:** Beleza Ecosystem  
**Versão:** 1.0.0  
**Data:** 28 de Abril de 2026
