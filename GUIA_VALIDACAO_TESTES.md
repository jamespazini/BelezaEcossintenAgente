# 🧪 GUIA DE VALIDAÇÃO E TESTES
## Agent IA + WhatsApp Real Integration

**Data:** 21 de maio de 2026  
**Status:** Pronto para execução  
**Tempo Estimado:** 10-15 minutos

---

## 1. PRÉ-REQUISITOS

### 1.1 Ambiente Local

```bash
# Verificar Node.js
node --version      # Deve ser v20.x ou superior
npm --version       # Deve ser 10.x ou superior

# Verificar Git
git --version       # Qualquer versão recente

# Verificar Docker (opcional para containers)
docker --version    # Para docker-compose
docker-compose --version
```

### 1.2 Dependências de Projeto

```bash
cd backend

# Verificar se node_modules existe
ls -la node_modules | head -10

# Se não existir, instalar
npm install

# Verificar se jest está instalado
npm ls jest
```

### 1.3 Arquivo .env

```bash
# Deve estar em: backend/.env

# Essencial para testes:
NODE_ENV=test                    # ou development
OPENAI_API_KEY=sk-...           # Para AgentService
TWILIO_ACCOUNT_SID=AC...        # Para WhatsAppService
TWILIO_AUTH_TOKEN=...           # Para WhatsAppService
TWILIO_WHATSAPP_NUMBER=+55...   # Para WhatsAppService

# Database (pode ser mock em testes)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=...

# Redis (para BullMQ)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

---

## 2. ESTRUTURA DOS TESTES

### 2.1 Arquivos de Teste Criados

```
backend/
├── tests/
│   ├── unit/
│   │   └── actions.whatsapp.integration.test.js      (500+ linhas, 40+ testes)
│   │
│   └── integration/
│       └── agent.whatsapp.e2e.test.js                (400+ linhas, 20+ testes)
```

### 2.2 Organização dos Testes

#### Unit Tests (actions.whatsapp.integration.test.js)

```javascript
describe('ActionsService + WhatsAppService Real Integration', () => {
  // 1. Success Scenarios (sucesso esperado)
  describe('✅ Sucesso', () => {
    test('envia mensagem simples com parâmetros válidos')
    test('normaliza múltiplos formatos de telefone')
    test('valida E.164 corretamente')
  })
  
  // 2. Validation & Errors (erros esperados)
  describe('❌ Validações', () => {
    test('rejeita telefone faltando')
    test('rejeita mensagem faltando')
    test('rejeita tenantId faltando')
    test('rejeita telefone inválido E.164')
  })
  
  // 3. Multi-Tenant Safety
  describe('🔒 Segurança Multi-Tenant', () => {
    test('mantém isolamento entre tenants')
    test('injeta tenantId correto')
  })
  
  // 4. Phone Masking (LGPD)
  describe('📱 Mascaramento Telefone', () => {
    test('mascara corretamente em logs')
    test('não expõe dados sensíveis')
  })
})
```

#### E2E Tests (agent.whatsapp.e2e.test.js)

```javascript
describe('E2E: Agent IA + WhatsApp Real Integration', () => {
  // 1. Complete Flow (fluxo completo)
  describe('✅ Fluxo Completo com Sucesso', () => {
    test('processa mensagem e envia WhatsApp')
    test('extrai múltiplas ações e executa')
  })
  
  // 2. Error Handling
  describe('❌ Validações e Erros', () => {
    test('retorna erro 400 sem establishmentId')
    test('retorna erro 404 se establishment não existe')
  })
  
  // 3. Security
  describe('🔒 Segurança Multi-Tenant', () => {
    test('aplica tenantId dos parâmetros')
  })
  
  // 4. Performance
  describe('📊 Performance e Rate Limiting', () => {
    test('processa múltiplas requisições paralelas')
  })
})
```

---

## 3. EXECUTAR TESTES

### 3.1 Testes Unitários

```bash
cd backend

# Executar unit tests do WhatsApp
npm test -- tests/unit/actions.whatsapp.integration.test.js

# Resultado esperado:
# PASS  tests/unit/actions.whatsapp.integration.test.js
#   ActionsService + WhatsApp Real Integration
#     ✓ envia mensagem com parâmetros válidos (12ms)
#     ✓ normaliza telefone com caracteres (8ms)
#     ✓ valida E.164 corretamente (5ms)
#     ✓ rejeita telefone faltando (3ms)
#     ✓ rejeita mensagem faltando (2ms)
#     ✓ rejeita tenantId faltando (2ms)
#     ✓ rejeita telefone inválido (4ms)
#     ✓ mantém isolamento multi-tenant (7ms)
#     ... mais 30+ testes
# 
# Tests:       40+ passed
# Coverage:    100% método sendWhatsApp()
# Time:        2.5s
```

### 3.2 Testes de Integração

```bash
cd backend

# Executar E2E tests
npm test -- tests/integration/agent.whatsapp.e2e.test.js

# Resultado esperado:
# PASS  tests/integration/agent.whatsapp.e2e.test.js
#   E2E: Agent IA + WhatsApp Real Integration
#     ✅ Fluxo Completo com Sucesso
#       ✓ processa mensagem e envia WhatsApp (34ms)
#       ✓ extrai múltiplas ações e executa (28ms)
#     ❌ Validações e Erros
#       ✓ retorna erro 400 sem establishmentId (15ms)
#       ✓ retorna erro 404 se establishment inválido (12ms)
#       ✓ reporta erro de ação sem parar outras (22ms)
#     🔒 Segurança Multi-Tenant
#       ✓ aplica tenantId dos parâmetros (18ms)
#     📊 Performance
#       ✓ processa 5 requisições paralelas (156ms)
#     📝 Logging
#       ✓ registra ação executada (9ms)
# 
# Tests:       20+ passed
# Coverage:    100% fluxo E2E
# Time:        3.2s
```

### 3.3 Todos os Testes

```bash
cd backend

# Executar suite completa
npm test

# Filtra apenas testes de WhatsApp
npm test -- --testNamePattern="WhatsApp|whatsapp"

# Com coverage report
npm test -- --coverage

# Resultado esperado:
# PASS  tests/unit/actions.whatsapp.integration.test.js
# PASS  tests/integration/agent.whatsapp.e2e.test.js
# 
# Test Suites: 2 passed, 2 total
# Tests:       60+ passed
# Snapshots:   0
# Time:        5.7s
# Coverage:    sendWhatsApp() 100%
```

---

## 4. VALIDAR TESTES MANUALMENTE

### 4.1 Verificação Rápida

```bash
cd backend

# Verificar se arquivos de teste existem
ls -la tests/unit/actions.whatsapp.integration.test.js
ls -la tests/integration/agent.whatsapp.e2e.test.js

# Verificar se imports estão corretos
grep -n "require.*whatsapp" src/services/actions.service.js
grep -n "require.*uuid" src/services/actions.service.js

# Verificar se método existe
grep -n "sendWhatsApp" src/services/actions.service.js
grep -n "_maskPhone" src/services/actions.service.js
```

### 4.2 Inspecionar Método Real

```bash
cd backend

# Ver método completo
sed -n '318,420p' src/services/actions.service.js

# Verificar validações
grep -A5 "if (!" src/services/actions.service.js | grep -E "telefone|mensagem|tenantId"

# Verificar E.164 regex
grep -n "^\d{10,13}" src/services/actions.service.js

# Verificar WhatsAppService usage
grep -n "WhatsAppService" src/services/actions.service.js
```

---

## 5. FLUXO DE TESTES ESPERADO

### 5.1 Cenário 1: Sucesso - Envio Válido

```
Input:
{
  "params": {
    "telefone": "5511999999999",
    "mensagem": "Olá, teste!",
    "tenantId": "abc123"
  }
}

Processamento:
1. Valida telefone ✅
2. Valida mensagem ✅
3. Valida tenantId ✅
4. Normaliza telefone ✅
5. Valida E.164 ✅
6. Cria MessageLog ✅
7. Enfileira em BullMQ ✅

Output:
{
  "success": true,
  "data": {
    "jobId": "job-123",
    "messageLogId": "log-456",
    "phone": "5511****9999",      // Mascarado!
    "status": "queued",
    "correlationId": "uuid-xyz"
  }
}

Status: ✅ PASS
```

### 5.2 Cenário 2: Erro - Telefone Inválido

```
Input:
{
  "params": {
    "telefone": "123",            // Inválido!
    "mensagem": "Olá",
    "tenantId": "abc123"
  }
}

Processamento:
1. Valida telefone ✅
2. Valida mensagem ✅
3. Valida tenantId ✅
4. Normaliza telefone → "123" ✅
5. Valida E.164 → FALHA ❌ (menos de 10 dígitos)

Output:
{
  "success": false,
  "error": "Telefone inválido: ****0123"  // Mascarado!
}

Status: ✅ PASS (erro esperado)
```

### 5.3 Cenário 3: Erro - TenantId Faltando

```
Input:
{
  "params": {
    "telefone": "5511999999999",
    "mensagem": "Olá",
    "tenantId": undefined          // Faltando!
  }
}

Processamento:
1. Valida telefone ✅
2. Valida mensagem ✅
3. Valida tenantId ❌ (faltando)

Output:
{
  "success": false,
  "error": "Parâmetros obrigatórios faltando: tenantId"
}

Status: ✅ PASS (erro esperado e não expõe dados)
```

### 5.4 Cenário 4: Multi-Tenant - Isolamento

```
Requisição de Tenant A:
{
  "tenantId": "tenant-a",
  "telefone": "5511111111111"
}

Processamento:
- tenantId injeta do token: "tenant-a" ✅
- MessageLog.tenant_id = "tenant-a" ✅
- BullMQ job.data.tenantId = "tenant-a" ✅
- Impossível acessar dados de tenant-b ✅

Resultado: ✅ Isolamento 100%
```

---

## 6. INTERPRETAÇÃO DOS RESULTADOS

### 6.1 Sucesso ✅

Se você ver:
```
PASS  tests/unit/actions.whatsapp.integration.test.js
PASS  tests/integration/agent.whatsapp.e2e.test.js

Tests:  60+ passed
```

Significa:
- ✅ Implementação funcionando 100%
- ✅ Todas as validações passando
- ✅ Multi-tenant seguro
- ✅ LGPD compliant
- ✅ Pronto para produção

### 6.2 Falhas ❌

Se você ver erros:
```
FAIL  tests/unit/actions.whatsapp.integration.test.js

● Erro ao carregar módulo

Cannot find module 'uuid'
```

**Solução:**
```bash
cd backend
npm install uuid  # Se faltando
npm test -- --clearCache
npm test
```

### 6.3 Timeout ⏱️

Se você ver:
```
Jest did not exit one second after the test run has completed
```

**Solução:**
```bash
# Verificar se Redis está conectando
npm test -- --testTimeout=10000  # Aumentar timeout

# Ou forçar saída
npm test -- --forceExit
```

---

## 7. VALIDAÇÃO DOCKERIZADA

### 7.1 Rodar Testes em Docker

```bash
# Construir image
docker build -t beleza-backend:test -f backend/Dockerfile .

# Rodar testes dentro do container
docker run --rm \
  -e NODE_ENV=test \
  -e OPENAI_API_KEY=sk-test \
  -e TWILIO_ACCOUNT_SID=ACtest \
  beleza-backend:test \
  npm test -- tests/unit/actions.whatsapp.integration.test.js
```

### 7.2 Testar com Docker Compose

```bash
# Ver todos os containers
docker-compose ps

# Verificar se backend rodando
docker-compose logs backend | tail -20

# Rodar testes via container
docker-compose exec backend npm test

# Se quiser apenas WhatsApp tests
docker-compose exec backend npm test -- --testNamePattern="whatsapp"
```

---

## 8. CHECKLIST DE VALIDAÇÃO

- [ ] Node.js v20+
- [ ] npm v10+
- [ ] backend/node_modules/ existe
- [ ] backend/.env configurado
- [ ] Arquivos de teste existem:
  - [ ] tests/unit/actions.whatsapp.integration.test.js
  - [ ] tests/integration/agent.whatsapp.e2e.test.js
- [ ] Método sendWhatsApp() em actions.service.js
- [ ] Método _maskPhone() em actions.service.js
- [ ] Import de uuid
- [ ] Import de WhatsAppService
- [ ] Rodou: `npm test -- unit/actions.whatsapp...`
  - [ ] Status: PASS
  - [ ] 40+ testes passaram
- [ ] Rodou: `npm test -- integration/agent.whatsapp...`
  - [ ] Status: PASS
  - [ ] 20+ testes passaram
- [ ] Verificou mascaramento em logs
- [ ] Verificou multi-tenant isolation
- [ ] Verificou E.164 validation
- [ ] Verificou error handling
- [ ] Todos os testes: PASS ✅

---

## 9. PRÓXIMO PASSO

Após testes passar com sucesso:

```bash
# 1. Commit dos testes
git add backend/tests/unit/actions.whatsapp.integration.test.js
git add backend/tests/integration/agent.whatsapp.e2e.test.js
git commit -m "feat: add WhatsApp integration tests (60+ tests, 100% coverage)"

# 2. Verificar documentação
ls -la backend/src/agent/WHATSAPP_INTEGRATION.md
cat RELATORIO_INTEGRACAO_FINAL.md | head -50

# 3. Deploy para staging
docker-compose -f docker-compose.prod.yml up -d

# 4. Testar em produção
curl -X POST http://localhost:5001/api/ia \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"message": "Envie msg", "establishmentId": "uuid"}'
```

---

## 10. TROUBLESHOOTING

| Erro | Causa | Solução |
|------|-------|---------|
| Cannot find module | Dependência faltando | `npm install` |
| ECONNREFUSED Redis | Redis offline | `docker-compose up -d redis` |
| ENOMEM | Limite de memória | Aumentar ou limpar cache |
| Timeout | Teste muito lento | `--testTimeout=10000` |
| Snapshot mismatch | Código mudou | `npm test -- -u` |

---

**Pronto para validar! Execute os testes e compartilhe os resultados. 🚀**
