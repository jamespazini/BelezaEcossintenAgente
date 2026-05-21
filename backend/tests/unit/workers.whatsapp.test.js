'use strict';

process.env.NODE_ENV = 'test';

const workerConstructs = [];

jest.mock('bullmq', () => ({
  Worker: jest.fn((queueName, processor, options) => {
    workerConstructs.push({ queueName, processor, options });
    return { on: jest.fn(), close: jest.fn(async () => true) };
  }),
  QueueScheduler: jest.fn(() => ({ on: jest.fn() })),
  Queue: jest.fn(() => ({ add: jest.fn() })),
}), { virtual: true });

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn(async () => true),
    on: jest.fn(),
    quit: jest.fn(async () => true),
  }));
}, { virtual: true });

const mockDispatchOutboundMessage = jest.fn(async () => ({ success: true, providerMessageId: 'twilio-sid' }));
const mockCreateMessageLog = jest.fn(async (data) => ({ id: 'log-1', ...data }));
const mockQueueOutboundMessage = jest.fn(async () => ({ id: 'outbound-job-1' }));

jest.mock('../../src/services/whatsapp.service', () => ({
  dispatchOutboundMessage: mockDispatchOutboundMessage,
  createMessageLog: mockCreateMessageLog,
  queueOutboundMessage: mockQueueOutboundMessage,
}));

const mockConversationService = jest.fn().mockImplementation(() => ({
  provider: { generateResponse: jest.fn(async () => 'Hello from AI') },
  _findServices: jest.fn(async () => []),
}));

jest.mock('../../src/services/conversation.service', () => mockConversationService);

jest.mock('../../src/modules', () => ({
  initializeModules: jest.fn(() => ({
    tenants: { service: { getTenantById: jest.fn(async (id) => id === 'tenant-1' ? { id, slug: 'test-salon' } : null) } },
  })),
}));

jest.mock('../../src/models', () => ({
  ConversationSession: { findByPk: jest.fn(async (id) => id === 'session-1' ? { id: 'session-1', customer_id: 'client-1', whatsapp_number: '+5511999999999' } : null) },
}));

const notificationWorker = require('../../src/workers/notificationWorker');
const aiWorker = require('../../src/workers/aiWorker');

describe('Worker wiring', () => {
  test('creates an AI worker for ai-processing and a notification worker for outbound jobs', () => {
    expect(workerConstructs.some((w) => w.queueName === 'ai-processing')).toBe(true);
    expect(workerConstructs.some((w) => w.queueName === 'outbound-messages')).toBe(true);
    expect(workerConstructs.some((w) => w.queueName === 'appointment-reminders')).toBe(true);
  });
});

describe('AI worker processor', () => {
  test('processes AI job and forwards reply to WhatsApp service', async () => {
    const aiWorkerConstruct = workerConstructs.find((w) => w.queueName === 'ai-processing');
    expect(aiWorkerConstruct).toBeDefined();

    const job = {
      id: 'job-1',
      data: {
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        userMessage: 'Oi, preciso de ajuda',
        fromNumber: '+5511999999999',
      },
    };

    await aiWorkerConstruct.processor(job);

    expect(mockCreateMessageLog).toHaveBeenCalledWith(expect.objectContaining({ body: 'Hello from AI', direction: 'OUTBOUND', eventType: 'ai_reply' }));
    expect(mockQueueOutboundMessage).toHaveBeenCalledWith(expect.objectContaining({ to: '+5511999999999', body: 'Hello from AI' }));
  });

  test('fails when tenant or session is invalid', async () => {
    const aiWorkerConstruct = workerConstructs.find((w) => w.queueName === 'ai-processing');
    await expect(aiWorkerConstruct.processor({ id: 'job-2', data: { tenantId: 'bad-tenant', sessionId: 'bad-session', userMessage: 'teste', fromNumber: '+5511999999999' } })).rejects.toThrow('Invalid AI processing job payload');
  });
});
