'use strict';

process.env.NODE_ENV = 'test';
process.env.TWILIO_ACCOUNT_SID = 'test-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-token';
process.env.TWILIO_WHATSAPP_NUMBER = '+15551234567';

const mockAddJob = jest.fn(async (name, payload, options) => ({ id: `job-${name}`, name, payload, options }));
const mockUpdateLog = jest.fn(async () => [1]);
const mockFindOne = jest.fn(async () => ({ id: 'message-log-1' }));
const mockCreateMessageLog = jest.fn(async (data) => ({ id: 'message-log-created', ...data }));
const mockSubscriptionFindOne = jest.fn(async () => ({ status: 'active' }));
const mockCheckLimit = jest.fn(async () => ({ allowed: true, limit: null, current: 0 }));
const mockIncrementUsage = jest.fn(async () => ({ ok: true }));

jest.mock('../../src/queue/queue', () => ({
  queues: {
    outboundMessages: { add: mockAddJob },
    appointmentReminders: { add: mockAddJob },
  },
  redisConnection: {},
}));

jest.mock('../../src/modules', () => ({
  initializeModules: jest.fn(() => ({
    billing: {
      models: {
        Subscription: {
          findOne: mockSubscriptionFindOne,
        },
      },
      services: {
        usageService: {
          checkLimit: mockCheckLimit,
          METRICS: {
            WHATSAPP_MESSAGES: 'whatsapp_messages',
          },
          incrementUsage: mockIncrementUsage,
        },
      },
    },
  })),
}));

jest.mock('../../src/models', () => ({
  MessageLog: {
    create: mockCreateMessageLog,
    update: mockUpdateLog,
    findOne: mockFindOne,
  },
}));

const mockCreate = jest.fn();
const mockMessagesCreate = jest.fn(async () => ({ sid: 'twilio-sid', status: 'sent' }));
mockCreate.mockImplementation(mockMessagesCreate);
const mockTwilio = jest.fn(() => ({ messages: { create: mockCreate } }));
jest.mock('twilio', () => mockTwilio, { virtual: true });

const WhatsAppService = require('../../src/services/whatsapp.service');

describe('WhatsAppService', () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockAddJob.mockClear();
    mockUpdateLog.mockClear();
    mockCreateMessageLog.mockClear();
    mockFindOne.mockClear();
    mockSubscriptionFindOne.mockClear();
    mockCheckLimit.mockClear();
    mockIncrementUsage.mockClear();
  });

  test('queueOutboundMessage enqueues a Twilio send job with retry settings', async () => {
    const job = await WhatsAppService.queueOutboundMessage({
      tenantId: 'tenant-1',
      whatsappNumber: '+5511999999999',
      to: '+5511999999999',
      body: 'Olá',
      sessionId: 'session-1',
      messageLogId: 'log-1',
      eventType: 'WHATSAPP_RESPONSE',
    });

    expect(mockAddJob).toHaveBeenCalledWith(
      'send-whatsapp',
      expect.objectContaining({ tenantId: 'tenant-1', body: 'Olá', to: '+5511999999999' }),
      expect.objectContaining({ attempts: 3, backoff: { type: 'exponential', delay: 2000 } })
    );
    expect(job).toHaveProperty('id');
  });

  test('dispatchOutboundMessage sends via Twilio and updates message log status', async () => {
    const result = await WhatsAppService.dispatchOutboundMessage({
      tenantId: 'tenant-1',
      to: '+5511999999999',
      whatsappNumber: '+15551234567',
      body: 'Olá',
      sessionId: 'session-1',
      messageLogId: 'log-1',
      eventType: 'whatsapp_response',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      from: 'whatsapp:+15551234567',
      to: 'whatsapp:+5511999999999',
      body: 'Olá',
    });
    expect(mockUpdateLog).toHaveBeenCalledWith({
      status: 'sent',
      provider_message_id: 'twilio-sid',
      event_type: 'whatsapp_response',
      metadata: expect.any(Object),
    }, { where: { id: 'log-1' } });
    expect(result).toEqual(expect.objectContaining({ success: true, providerMessageId: 'twilio-sid', status: 'sent' }));
  });

  test('dispatchOutboundMessage propagates Twilio failures and logs failure status', async () => {
    const error = new Error('Twilio failure');
    mockCreate.mockRejectedValueOnce(error);

    await expect(WhatsAppService.dispatchOutboundMessage({
      tenantId: 'tenant-1',
      to: '+5511999999999',
      whatsappNumber: '+15551234567',
      body: 'Olá',
      sessionId: 'session-1',
      messageLogId: 'log-1',
      eventType: 'whatsapp_response',
    })).rejects.toThrow('Twilio failure');

    expect(mockUpdateLog).toHaveBeenCalledWith({
      status: 'failed',
      event_type: 'whatsapp_response',
      metadata: expect.objectContaining({ error: 'Twilio failure' }),
    }, { where: { id: 'log-1' } });
  });

  test('handleStatusCallback updates status when the message log is found', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 'log-1' });

    await WhatsAppService.handleStatusCallback({
      tenantId: 'tenant-1',
      providerMessageId: 'twilio-sid',
      status: 'delivered',
      eventType: 'whatsapp_status_callback',
      metadata: { foo: 'bar' },
    });

    expect(mockFindOne).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-1', provider_message_id: 'twilio-sid' } });
    expect(mockUpdateLog).toHaveBeenCalledWith({
      status: 'delivered',
      provider_message_id: 'twilio-sid',
      event_type: 'whatsapp_status_callback',
      metadata: { foo: 'bar' },
    }, { where: { id: 'log-1' } });
  });

  test('handleStatusCallback returns null when unknown provider message id is received', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    const result = await WhatsAppService.handleStatusCallback({
      tenantId: 'tenant-1',
      providerMessageId: 'unknown-sid',
      status: 'failed',
      eventType: 'whatsapp_status_callback',
      metadata: {},
    });

    expect(result).toBeNull();
  });

  test('queueAppointmentReminder enqueues reminder job', async () => {
    const payload = {
      tenantId: 'tenant-1',
      appointmentId: 'appt-1',
      to: '+5511999999999',
      whatsappNumber: '+15551234567',
      body: 'Lembrete de agendamento',
      sessionId: 'session-1',
    };

    const job = await WhatsAppService.queueAppointmentReminder(payload);
    expect(mockAddJob).toHaveBeenCalledWith('reminder', payload, expect.objectContaining({ attempts: 2, backoff: { type: 'exponential', delay: 5000 } }));
    expect(job).toHaveProperty('id');
  });
});
