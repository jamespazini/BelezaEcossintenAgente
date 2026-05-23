'use strict';

process.env.NODE_ENV = 'test';

const mockAddAiJob = jest.fn(async () => ({ id: 'ai-job' }));

jest.mock('../../src/queue/queue', () => ({
  queues: {
    aiProcessing: { add: mockAddAiJob },
  },
}));

jest.mock('../../src/services/whatsapp.service', () => ({
  queueOutboundMessage: jest.fn(async () => ({ id: 'outbound-job' })),
}));

const WhatsAppService = require('../../src/services/whatsapp.service');
const ConversationService = require('../../src/services/conversation.service');

function makeModels(overrides = {}) {
  return {
    Client: {
      findOne: jest.fn(async () => overrides.client || null),
      create: jest.fn(async (data) => ({ id: 'client-created', ...data })),
    },
    ConversationSession: {
      findOrCreate: jest.fn(async () => [overrides.session || { id: 'session-created', customer_id: null, update: jest.fn(async function (changes) { Object.assign(this, changes); return this; }) }, false]),
    },
    MessageLog: { create: jest.fn(async (data) => ({ id: 'log-1', ...data })) },
    AiAction: { create: jest.fn(async (data) => ({ id: 'action-1', ...data })) },
    Appointment: { findOne: jest.fn(async () => overrides.appointment || null) },
    Service: { findAll: jest.fn(async () => overrides.services || []) },
  };
}

describe('ConversationService', () => {
  beforeEach(() => {
    mockAddAiJob.mockClear();
    WhatsAppService.queueOutboundMessage.mockClear();
  });

  test('confirma agendamento quando cliente e agendamento existem', async () => {
    const appointment = { id: 'appt-1', start_time: new Date(Date.now() + 3600000), status: 'PENDING', update: jest.fn(async function (changes) { Object.assign(this, changes); return this; }) };
    const client = { id: 'client-1', first_name: 'Ana', last_name: 'Lima' };
    const session = { id: 'session-1', update: jest.fn(async function (changes) { Object.assign(this, changes); return this; }) };

    const models = makeModels({ client, appointment, session });
    const service = new ConversationService(models, null);

    const result = await service.processInbound({ tenant: { id: 'tenant-1' }, body: 'sim', from: '+55 11 99999-9999', to: '+55 15 99887-7766', messageSid: 'sid-1' });

    expect(appointment.update).toHaveBeenCalledWith({ status: 'CONFIRMED' });
    expect(result.response).toContain('confirmado');
    expect(WhatsAppService.queueOutboundMessage).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'CONFIRM_APPOINTMENT', body: expect.any(String) }));
  });

  test('cancela agendamento quando cliente e agendamento ativos existem', async () => {
    const appointment = { id: 'appt-2', start_time: new Date(Date.now() + 3600000), status: 'CONFIRMED', update: jest.fn(async function (changes) { Object.assign(this, changes); return this; }) };
    const client = { id: 'client-2', first_name: 'Bia', last_name: 'Souza' };
    const session = { id: 'session-2', update: jest.fn(async function (changes) { Object.assign(this, changes); return this; }) };

    const models = makeModels({ client, appointment, session });
    const service = new ConversationService(models, null);

    const result = await service.processInbound({ tenant: { id: 'tenant-1' }, body: 'quero cancelar', from: '+55 11 88888-8888', to: '+55 15 99887-7766', messageSid: 'sid-2' });

    expect(appointment.update).toHaveBeenCalledWith({ status: 'CANCELLED' });
    expect(result.response).toContain('cancelado');
    expect(WhatsAppService.queueOutboundMessage).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'CANCEL_APPOINTMENT' }));
  });

  test('reageendamento retorna instruções de nova data', async () => {
    const session = { id: 'session-3', update: jest.fn(async function (changes) { Object.assign(this, changes); return this; }) };
    const client = { id: 'client-3' };
    const models = makeModels({ client, appointment: null, session });
    const service = new ConversationService(models, null);

    const result = await service.processInbound({ tenant: { id: 'tenant-1' }, body: 'remarcar para amanhã', from: '+55 11 77777-7777', to: '+55 15 99887-7766', messageSid: 'sid-3' });

    expect(result.response).toContain('Por favor, envie a nova data e hora desejada');
    expect(WhatsAppService.queueOutboundMessage).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'RESCHEDULE_APPOINTMENT' }));
  });

  test('mensagens duplicadas são aceitas e geram log de sessão idêntico', async () => {
    const session = { id: 'session-4', update: jest.fn(async function (changes) { Object.assign(this, changes); return this; }) };
    const client = { id: 'client-4' };
    const models = makeModels({ client, appointment: null, session });
    const service = new ConversationService(models, null);

    await service.processInbound({ tenant: { id: 'tenant-1' }, body: 'olá', from: '+55 11 66666-6666', to: '+55 15 99887-7766', messageSid: 'sid-4' });
    await service.processInbound({ tenant: { id: 'tenant-1' }, body: 'olá', from: '+55 11 66666-6666', to: '+55 15 99887-7766', messageSid: 'sid-4-dup' });

    expect(models.MessageLog.create).toHaveBeenCalledTimes(4); // 2 inbound + 2 outbound
    expect(WhatsAppService.queueOutboundMessage).toHaveBeenCalledTimes(2);
    expect(models.ConversationSession.findOrCreate).toHaveBeenCalledTimes(2);
    expect(models.ConversationSession.findOrCreate.mock.calls[0][0].where.customer_number).toBe('5511666666666');
  });

  test('fallback unknown intent enfileira processamento de AI', async () => {
    const session = { id: 'session-5', update: jest.fn(async function (changes) { Object.assign(this, changes); return this; }) };
    const client = { id: 'client-5' };
    const models = makeModels({ client, appointment: null, session });
    const service = new ConversationService(models, null);

    const result = await service.processInbound({ tenant: { id: 'tenant-1' }, body: 'texto desconhecido xpto 123', from: '+55 11 55555-5555', to: '+55 15 99887-7766', messageSid: 'sid-5' });

    expect(mockAddAiJob).toHaveBeenCalledWith('generate-ai-reply', expect.objectContaining({ tenantId: 'tenant-1', sessionId: session.id, userMessage: 'texto desconhecido xpto 123' }), expect.any(Object));
    expect(result.response).toContain('Estamos analisando seu pedido');
  });

  test('cria cliente e vincula sessão quando chega mensagem do WhatsApp de contato novo', async () => {
    const session = { id: 'session-6', customer_id: null, update: jest.fn(async function (changes) { Object.assign(this, changes); return this; }) };
    const models = makeModels({ session });
    const service = new ConversationService(models, null);

    await service.processInbound({ tenant: { id: 'tenant-1' }, body: 'Olá, gostaria de agendar', from: '+55 11 99999-9999', to: '+55 15 99887-7766', messageSid: 'sid-6' });

    expect(models.Client.create).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant-1',
      phone: '5511999999999',
      first_name: 'Cliente',
      notes: expect.stringContaining('WhatsApp'),
    }));

    const createdClientId = models.Client.create.mock.calls[0][0].id;
    expect(session.update).toHaveBeenCalledWith(expect.objectContaining({ customer_id: createdClientId }));
    expect(models.MessageLog.create).toHaveBeenCalledWith(expect.objectContaining({ customer_id: createdClientId }));
  });

  test('propaga erros de banco de dados quando a criação de sessão falha', async () => {
    const sessionErrorModels = makeModels();
    sessionErrorModels.ConversationSession.findOrCreate.mockRejectedValueOnce(new Error('Database unavailable'));
    const service = new ConversationService(sessionErrorModels, null);

    await expect(service.processInbound({ tenant: { id: 'tenant-1' }, body: 'test', from: '+55 11 44444-4444', to: '+55 15 99887-7766', messageSid: 'sid-7' })).rejects.toThrow('Database unavailable');
  });
});
