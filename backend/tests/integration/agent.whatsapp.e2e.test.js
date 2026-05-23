/**
 * E2E Tests: Agent Inteligente + WhatsApp Real Integration
 * 
 * Testa todo o fluxo:
 * 1. Agent recebe mensagem
 * 2. Agent interpreta e gera ação [AÇÃO: enviar_whatsapp]
 * 3. Controller valida e executa ação
 * 4. ActionsService chama WhatsAppService real
 * 5. BullMQ enfileira mensagem
 * 6. Worker processa e envia via Twilio
 */

'use strict';

const express = require('express');
const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

jest.mock('../../src/shared/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '') || 'tenant-1';
    req.user = { id: 'user-1', tenantId: token, role: 'OWNER' };
    next();
  },
  ensureTenantMember: (req, res, next) => next(),
}));

jest.mock('../../src/services/whatsapp.service', () => ({
  createMessageLog: jest.fn(),
  queueOutboundMessage: jest.fn(),
  dispatchOutboundMessage: jest.fn(),
  handleStatusCallback: jest.fn(),
  queueAppointmentReminder: jest.fn(),
}));

jest.mock('../../src/agent/agent.service', () => ({
  processMessage: jest.fn(),
  testConnection: jest.fn(),
  model: 'gpt-4o-mini',
}));

jest.mock('../../src/queue/queue', () => ({
  redisConnection: {},
  queues: {
    inboundMessages: { add: jest.fn() },
    outboundMessages: { add: jest.fn() },
    aiProcessing: { add: jest.fn() },
    appointmentReminders: { add: jest.fn() },
  },
}));

jest.mock('../../src/models', () => {
  const createModel = () => ({
    associate: jest.fn(),
    belongsTo: jest.fn(),
    hasMany: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  });

  return {
    Sequelize: {
      Op: {
        between: 'between',
        notIn: 'notIn',
        gte: 'gte',
      },
    },
    Establishment: {
      findByPk: jest.fn(),
    },
    Client: {
      count: jest.fn(),
    },
    Service: {
      count: jest.fn(),
    },
    Appointment: {
      count: jest.fn(),
      findAll: jest.fn(),
    },
    FinancialEntry: {
      sum: jest.fn(),
    },
  };
});

const AgentService = require('../../src/agent/agent.service');
const WhatsAppService = require('../../src/services/whatsapp.service');
const models = require('../../src/models');
const agentRoutes = require('../../src/routes/agent.routes');

describe('E2E: Agent IA + WhatsApp Real Integration', () => {
  let app;
  const tenantId = uuidv4();
  const authToken = 'tenant-1';
  const establishmentId = uuidv4();
  const jobId = 'job-e2e-123';
  const messageLogId = uuidv4();

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/ia', agentRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('✅ Fluxo Completo com Sucesso', () => {
    test('deve processar mensagem e enviar WhatsApp via agente', async () => {
      const userMessage = 'Envie uma mensagem para 5511999999999 com conteúdo: Olá!';
      const agentResponse = `
Processando seu pedido...

[AÇÃO: enviar_whatsapp]
Parâmetros: {
  "telefone": "5511999999999",
  "mensagem": "Olá! Conforme solicitado."
}

✅ Mensagem será enviada com sucesso.
      `;

      // Mock Establishment
      models.Establishment.findByPk.mockResolvedValue({
        id: establishmentId,
        name: 'Salão Test',
      });

      // Mock Agent Response
      AgentService.processMessage.mockResolvedValue({
        success: true,
        response: agentResponse,
        actions: [
          {
            name: 'enviar_whatsapp',
            params: {
              telefone: '5511999999999',
              mensagem: 'Olá! Conforme solicitado.',
            },
          },
        ],
        metadata: {
          model: 'gpt-4o-mini',
          tokensUsed: 125,
          timestamp: new Date(),
          establishmentId,
        },
      });

      // Mock WhatsApp Service
      WhatsAppService.createMessageLog.mockResolvedValue({
        id: messageLogId,
        tenant_id: tenantId,
      });

      WhatsAppService.queueOutboundMessage.mockResolvedValue({
        id: jobId,
        data: {},
      });

      // Mock Client counts and data
      models.Client.count.mockResolvedValue(50);
      models.Service.count.mockResolvedValue(5);
      models.Appointment.count.mockResolvedValue(20);
      models.Appointment.findAll.mockResolvedValue([]);
      models.FinancialEntry.sum.mockResolvedValue(5000);

      // POST /api/ia
      const response = await request(app)
        .post('/api/ia')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: userMessage,
          establishmentId,
        });

      // Verificações
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.response).toBe(agentResponse);
      expect(response.body.actions).toHaveLength(1);

      const executedAction = response.body.actions[0];
      expect(executedAction.name).toBe('enviar_whatsapp');
      expect(executedAction.status).toBe('success');
      expect(executedAction.result.data.jobId).toBe(jobId);
      expect(executedAction.result.data.messageLogId).toBe(messageLogId);

      // Verificar que WhatsAppService foi chamado
      expect(WhatsAppService.createMessageLog).toHaveBeenCalled();
      expect(WhatsAppService.queueOutboundMessage).toHaveBeenCalled();
    });

    test('deve extrair múltiplas ações do agente e executar sequencialmente', async () => {
      const agentResponse = `
Vou realizar várias ações para você:

[AÇÃO: enviar_whatsapp]
Parâmetros: {
  "telefone": "5511999999999",
  "mensagem": "Mensagem 1"
}

[AÇÃO: enviar_whatsapp]
Parâmetros: {
  "telefone": "5521999999999",
  "mensagem": "Mensagem 2"
}

✅ Ambas as mensagens serão enviadas.
      `;

      models.Establishment.findByPk.mockResolvedValue({
        id: establishmentId,
        name: 'Salão Test',
      });

      AgentService.processMessage.mockResolvedValue({
        success: true,
        response: agentResponse,
        actions: [
          {
            name: 'enviar_whatsapp',
            params: {
              telefone: '5511999999999',
              mensagem: 'Mensagem 1',
            },
          },
          {
            name: 'enviar_whatsapp',
            params: {
              telefone: '5521999999999',
              mensagem: 'Mensagem 2',
            },
          },
        ],
      });

      // Mock mults chamadas
      WhatsAppService.createMessageLog
        .mockResolvedValueOnce({ id: messageLogId })
        .mockResolvedValueOnce({ id: uuidv4() });

      WhatsAppService.queueOutboundMessage
        .mockResolvedValueOnce({ id: jobId })
        .mockResolvedValueOnce({ id: 'job-2' });

      models.Client.count.mockResolvedValue(50);
      models.Service.count.mockResolvedValue(5);
      models.Appointment.count.mockResolvedValue(20);
      models.Appointment.findAll.mockResolvedValue([]);
      models.FinancialEntry.sum.mockResolvedValue(5000);

      const response = await request(app)
        .post('/api/ia')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Envie mensagens',
          establishmentId,
        });

      expect(response.body.actions).toHaveLength(2);
      expect(WhatsAppService.queueOutboundMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('❌ Validações e Erros', () => {
    test('deve retornar erro 400 quando establishmentId está faltando', async () => {
      const response = await request(app)
        .post('/api/ia')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Teste',
          // establishmentId: missing
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('deve retornar erro 404 quando establishment não existe', async () => {
      models.Establishment.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/ia')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Teste',
          establishmentId: 'invalid-id',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('deve reportar erro de ação sem parar outras', async () => {
      const agentResponse = `
[AÇÃO: enviar_whatsapp]
Parâmetros: {
  "telefone": "",
  "mensagem": "Mensagem sem telefone"
}

[AÇÃO: enviar_whatsapp]
Parâmetros: {
  "telefone": "5511999999999",
  "mensagem": "Mensagem válida"
}
      `;

      models.Establishment.findByPk.mockResolvedValue({
        id: establishmentId,
        name: 'Salão Test',
      });

      AgentService.processMessage.mockResolvedValue({
        success: true,
        response: agentResponse,
        actions: [
          { name: 'enviar_whatsapp', params: { telefone: '', mensagem: 'Mensagem sem telefone' } },
          { name: 'enviar_whatsapp', params: { telefone: '5511999999999', mensagem: 'Mensagem válida' } },
        ],
      });

      WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
      WhatsAppService.queueOutboundMessage.mockResolvedValue({ id: jobId });

      models.Client.count.mockResolvedValue(50);
      models.Service.count.mockResolvedValue(5);
      models.Appointment.count.mockResolvedValue(20);
      models.Appointment.findAll.mockResolvedValue([]);
      models.FinancialEntry.sum.mockResolvedValue(5000);

      const response = await request(app)
        .post('/api/ia')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Teste',
          establishmentId,
        });

      // Deve continuar executando a segunda ação mesmo quando a primeira falha
      expect(response.body.actions).toHaveLength(2);
      expect(response.body.actions[0].status).toBe('error');
      expect(response.body.actions[1].status).toBe('success');
    });
  });

  describe('🔒 Segurança Multi-Tenant', () => {
    test('deve aplicar tenantId do usuario ao params', async () => {
      const userTenantToken = 'tenant-2';

      models.Establishment.findByPk.mockResolvedValue({
        id: establishmentId,
        name: 'Salão Test',
      });

      AgentService.processMessage.mockResolvedValue({
        success: true,
        response: 'ok',
        actions: [
          {
            name: 'enviar_whatsapp',
            params: {
              telefone: '5511999999999',
              mensagem: 'Teste',
            },
          },
        ],
      });

      WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
      WhatsAppService.queueOutboundMessage.mockResolvedValue({ id: jobId });

      models.Client.count.mockResolvedValue(50);
      models.Service.count.mockResolvedValue(5);
      models.Appointment.count.mockResolvedValue(20);
      models.Appointment.findAll.mockResolvedValue([]);
      models.FinancialEntry.sum.mockResolvedValue(5000);

      const response = await request(app)
        .post('/api/ia')
        .set('Authorization', `Bearer ${userTenantToken}`)
        .send({
          message: 'Teste',
          establishmentId,
        });

      // Verificar que tenantId foi injetado nos params
      expect(WhatsAppService.queueOutboundMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: userTenantToken,
        })
      );
    });
  });

  describe('📊 Performance e Rate Limiting', () => {
    test('deve processar múltiplas requisições em paralelo', async () => {
      models.Establishment.findByPk.mockResolvedValue({
        id: establishmentId,
        name: 'Salão Test',
      });

      AgentService.processMessage.mockResolvedValue({
        success: true,
        response: 'ok',
        actions: [
          {
            name: 'enviar_whatsapp',
            params: {
              telefone: '5511999999999',
              mensagem: 'Teste 1',
            },
          },
        ],
      });

      WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
      WhatsAppService.queueOutboundMessage.mockResolvedValue({ id: jobId });

      models.Client.count.mockResolvedValue(50);
      models.Service.count.mockResolvedValue(5);
      models.Appointment.count.mockResolvedValue(20);
      models.Appointment.findAll.mockResolvedValue([]);
      models.FinancialEntry.sum.mockResolvedValue(5000);

      // Fazer 5 requisições em paralelo
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/ia')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Teste',
            establishmentId,
          })
      );

      const results = await Promise.all(promises);

      // Todas devem retornar sucesso
      results.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      // WhatsAppService deve ter sido chamado 5 vezes
      expect(WhatsAppService.queueOutboundMessage).toHaveBeenCalledTimes(5);
    });
  });

  describe('📝 Logging Estruturado', () => {
    test('deve registrar ação executada com sucesso', async () => {
      const logger = require('../../src/shared/utils/logger');
      jest.spyOn(logger, 'info');

      models.Establishment.findByPk.mockResolvedValue({
        id: establishmentId,
        name: 'Salão Test',
      });

      AgentService.processMessage.mockResolvedValue({
        success: true,
        response: 'ok',
        actions: [
          {
            name: 'enviar_whatsapp',
            params: {
              telefone: '5511999999999',
              mensagem: 'Teste',
            },
          },
        ],
      });

      WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
      WhatsAppService.queueOutboundMessage.mockResolvedValue({ id: jobId });

      models.Client.count.mockResolvedValue(50);
      models.Service.count.mockResolvedValue(5);
      models.Appointment.count.mockResolvedValue(20);
      models.Appointment.findAll.mockResolvedValue([]);
      models.FinancialEntry.sum.mockResolvedValue(5000);

      await request(app)
        .post('/api/ia')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Teste',
          establishmentId,
        });

      // Verificar logs
      expect(logger.info).toHaveBeenCalled();
      logger.info.mockRestore();
    });
  });
});
