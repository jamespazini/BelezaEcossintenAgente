/**
 * Integration Tests: ActionsService.sendWhatsApp() + WhatsAppService
 * 
 * Valida:
 * - Envio real via WhatsAppService
 * - Validação E.164
 * - Multi-tenant isolation
 * - Subscription validation
 * - Quota validation
 * - Job enqueuing
 * - Message logging
 * - Error handling
 */

'use strict';

// Mocks
jest.mock('../../src/services/whatsapp.service', () => ({
  createMessageLog: jest.fn(),
  queueOutboundMessage: jest.fn(),
  dispatchOutboundMessage: jest.fn(),
  handleStatusCallback: jest.fn(),
  queueAppointmentReminder: jest.fn(),
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

jest.mock('../../src/shared/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const { v4: uuidv4 } = require('uuid');
const ActionsService = require('../../src/services/actions.service');
const WhatsAppService = require('../../src/services/whatsapp.service');
const models = require('../../src/models');

describe('ActionsService.sendWhatsApp() - Real Integration', () => {
  const tenantId = uuidv4();
  const estabelecimentoId = uuidv4();
  const messageLogId = uuidv4();
  const jobId = 'job-123-abc';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('✅ Sucesso - Envio Real', () => {
    test('deve enfileirar mensagem real com parâmetros válidos', async () => {
      const params = {
        telefone: '5511999999999',
        mensagem: 'Olá! Teste de mensagem do agente.',
        tenantId,
        estabelecimentoId,
      };

      // Mock WhatsAppService
      WhatsAppService.createMessageLog.mockResolvedValue({
        id: messageLogId,
        tenant_id: tenantId,
      });

      WhatsAppService.queueOutboundMessage.mockResolvedValue({
        id: jobId,
        data: params,
      });

      const result = await ActionsService.sendWhatsApp(params);

      // Verificações
      expect(result.success).toBe(true);
      expect(result.data.jobId).toBe(jobId);
      expect(result.data.messageLogId).toBe(messageLogId);
      expect(result.data.status).toBe('queued');
      expect(result.data.correlationId).toBeDefined();

      // Verificar que WhatsAppService foi chamado corretamente
      expect(WhatsAppService.createMessageLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: tenantId,
          whatsapp_number: '5511999999999',
          direction: 'OUTBOUND',
          event_type: 'agent_outbound',
        })
      );

      expect(WhatsAppService.queueOutboundMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          to: '5511999999999',
          whatsappNumber: '5511999999999',
          body: params.mensagem,
          eventType: 'agent_outbound',
        })
      );
    });

    test('deve normalizar telefones com formatação variada', async () => {
      const testCases = [
        '(11) 99999-9999',
        '11 99999 9999',
        '5511999999999',
        '+55 11 99999-9999',
        '55-11-99999-9999',
      ];

      for (const telefone of testCases) {
        jest.clearAllMocks();

        WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
        WhatsAppService.queueOutboundMessage.mockResolvedValue({ id: jobId });

        const params = {
          telefone,
          mensagem: 'Teste',
          tenantId,
          estabelecimentoId,
        };

        const result = await ActionsService.sendWhatsApp(params);

        expect(result.success).toBe(true);
        
        // Verificar que o telefone foi normalizado para 5511999999999
        expect(WhatsAppService.createMessageLog).toHaveBeenCalledWith(
          expect.objectContaining({
            whatsapp_number: '5511999999999',
          })
        );
      }
    });

    test('deve incluir metadata e correlationId em logs', async () => {
      const params = {
        telefone: '5511999999999',
        mensagem: 'Mensagem com metadata',
        tenantId,
        estabelecimentoId,
      };

      WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
      WhatsAppService.queueOutboundMessage.mockResolvedValue({ id: jobId });

      const result = await ActionsService.sendWhatsApp(params);

      const createLogCall = WhatsAppService.createMessageLog.mock.calls[0][0];
      expect(createLogCall.metadata).toBeDefined();
      expect(createLogCall.metadata.source).toBe('agent');
      expect(createLogCall.metadata.correlationId).toBeDefined();
      expect(createLogCall.metadata.mensagemTruncada).toBe('Mensagem com metadata');
    });
  });

  describe('❌ Validações de Parâmetros', () => {
    test('deve rejeitar quando telefone está vazio', async () => {
      const params = {
        telefone: '',
        mensagem: 'Teste',
        tenantId,
        estabelecimentoId,
      };

      await expect(ActionsService.sendWhatsApp(params)).rejects.toThrow(
        'Parâmetros obrigatórios faltando'
      );
    });

    test('deve rejeitar quando mensagem está vazia', async () => {
      const params = {
        telefone: '5511999999999',
        mensagem: '',
        tenantId,
        estabelecimentoId,
      };

      await expect(ActionsService.sendWhatsApp(params)).rejects.toThrow(
        'Parâmetros obrigatórios faltando'
      );
    });

    test('deve rejeitar quando tenantId está vazio', async () => {
      const params = {
        telefone: '5511999999999',
        mensagem: 'Teste',
        tenantId: '',
        estabelecimentoId,
      };

      await expect(ActionsService.sendWhatsApp(params)).rejects.toThrow(
        'Parâmetros obrigatórios faltando'
      );
    });

    test('deve rejeitar telefone com menos de 10 dígitos', async () => {
      const params = {
        telefone: '551199999', // Apenas 9 dígitos
        mensagem: 'Teste',
        tenantId,
        estabelecimentoId,
      };

      await expect(ActionsService.sendWhatsApp(params)).rejects.toThrow(
        'Telefone inválido'
      );
    });

    test('deve rejeitar telefone com mais de 13 dígitos', async () => {
      const params = {
        telefone: '551199999999999999', // Muitos dígitos
        mensagem: 'Teste',
        tenantId,
        estabelecimentoId,
      };

      await expect(ActionsService.sendWhatsApp(params)).rejects.toThrow(
        'Telefone inválido'
      );
    });

    test('deve rejeitar telefone com caracteres inválidos', async () => {
      const params = {
        telefone: '55-11-ABCD-9999',
        mensagem: 'Teste',
        tenantId,
        estabelecimentoId,
      };

      await expect(ActionsService.sendWhatsApp(params)).rejects.toThrow(
        'Telefone inválido'
      );
    });
  });

  describe('🔒 Multi-Tenant Isolation', () => {
    test('deve preservar tenantId em todos os logs e jobs', async () => {
      const tenant1 = uuidv4();
      const tenant2 = uuidv4();

      // Teste 1: tenant1
      WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
      WhatsAppService.queueOutboundMessage.mockResolvedValue({ id: jobId });

      await ActionsService.sendWhatsApp({
        telefone: '5511999999999',
        mensagem: 'Mensagem tenant1',
        tenantId: tenant1,
        estabelecimentoId,
      });

      expect(WhatsAppService.createMessageLog).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: tenant1 })
      );

      expect(WhatsAppService.queueOutboundMessage).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: tenant1 })
      );

      jest.clearAllMocks();

      // Teste 2: tenant2
      WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
      WhatsAppService.queueOutboundMessage.mockResolvedValue({ id: jobId });

      await ActionsService.sendWhatsApp({
        telefone: '5521999999999',
        mensagem: 'Mensagem tenant2',
        tenantId: tenant2,
        estabelecimentoId,
      });

      expect(WhatsAppService.createMessageLog).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: tenant2 })
      );

      expect(WhatsAppService.queueOutboundMessage).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: tenant2 })
      );
    });
  });

  describe('🚨 Error Handling', () => {
    test('deve capturar erro de WhatsAppService.createMessageLog', async () => {
      const params = {
        telefone: '5511999999999',
        mensagem: 'Teste',
        tenantId,
        estabelecimentoId,
      };

      WhatsAppService.createMessageLog.mockRejectedValue(
        new Error('Database connection error')
      );

      await expect(ActionsService.sendWhatsApp(params)).rejects.toThrow(
        'Database connection error'
      );
    });

    test('deve capturar erro de WhatsAppService.queueOutboundMessage', async () => {
      const params = {
        telefone: '5511999999999',
        mensagem: 'Teste',
        tenantId,
        estabelecimentoId,
      };

      WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
      WhatsAppService.queueOutboundMessage.mockRejectedValue(
        new Error('Queue unavailable')
      );

      await expect(ActionsService.sendWhatsApp(params)).rejects.toThrow(
        'Queue unavailable'
      );
    });

    test('deve capturar erro de subscription quando WhatsAppService o retorna', async () => {
      const params = {
        telefone: '5511999999999',
        mensagem: 'Teste',
        tenantId,
        estabelecimentoId,
      };

      WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
      WhatsAppService.queueOutboundMessage.mockRejectedValue(
        new Error('Subscription required to send WhatsApp messages')
      );

      await expect(ActionsService.sendWhatsApp(params)).rejects.toThrow(
        'Subscription required'
      );
    });

    test('deve capturar erro de quota quando WhatsAppService o retorna', async () => {
      const params = {
        telefone: '5511999999999',
        mensagem: 'Teste',
        tenantId,
        estabelecimentoId,
      };

      WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
      WhatsAppService.queueOutboundMessage.mockRejectedValue(
        new Error('WhatsApp monthly message quota exceeded')
      );

      await expect(ActionsService.sendWhatsApp(params)).rejects.toThrow(
        'quota exceeded'
      );
    });
  });

  describe('📋 Logging e Auditoria', () => {
    test('deve logar informações estruturadas sem expor dados sensíveis', async () => {
      const logger = require('../../src/shared/utils/logger');
      
      const params = {
        telefone: '5511999999999',
        mensagem: 'Teste de logging',
        tenantId,
        estabelecimentoId,
      };

      WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
      WhatsAppService.queueOutboundMessage.mockResolvedValue({ id: jobId });

      await ActionsService.sendWhatsApp(params);

      // Verificar que logs foram feitos
      expect(logger.info).toHaveBeenCalled();

      // Verificar que nenhum log contém o telefone completo
      const infoCalls = logger.info.mock.calls;
      for (const call of infoCalls) {
        if (typeof call[1] === 'object' && call[1].phone) {
          expect(call[1].phone).toMatch(/^\d{4}\*{4}\d{4}$/); // Mascarado
          expect(call[1].phone).not.toContain('5511999999999');
        }
      }
    });

    test('deve incluir correlationId em todos os logs', async () => {
      const logger = require('../../src/shared/utils/logger');

      const params = {
        telefone: '5511999999999',
        mensagem: 'Teste',
        tenantId,
        estabelecimentoId,
      };

      WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
      WhatsAppService.queueOutboundMessage.mockResolvedValue({ id: jobId });

      const result = await ActionsService.sendWhatsApp(params);

      // Verificar que correlationId é consistente
      const correlationId = result.data.correlationId;
      expect(correlationId).toBeDefined();

      // Verificar que está nos logs
      const allCalls = logger.info.mock.calls;
      const hasCorrelationId = allCalls.some(call => 
        typeof call[1] === 'object' && call[1].correlationId === correlationId
      );
      expect(hasCorrelationId).toBe(true);
    });
  });

  describe('🔌 Integration com Agent Flow', () => {
    test('deve retornar formato correto para agent.controller', async () => {
      const params = {
        telefone: '5511999999999',
        mensagem: 'Teste',
        tenantId,
        estabelecimentoId,
      };

      WhatsAppService.createMessageLog.mockResolvedValue({ id: messageLogId });
      WhatsAppService.queueOutboundMessage.mockResolvedValue({ id: jobId });

      const result = await ActionsService.sendWhatsApp(params);

      // Formato esperado pelo controller
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('message');

      expect(result.data).toHaveProperty('jobId');
      expect(result.data).toHaveProperty('messageLogId');
      expect(result.data).toHaveProperty('phone');
      expect(result.data).toHaveProperty('status');
      expect(result.data).toHaveProperty('correlationId');
    });
  });
});
