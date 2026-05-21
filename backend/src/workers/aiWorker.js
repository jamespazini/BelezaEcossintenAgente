/**
 * AI Worker
 * Processes AI jobs from the queue and sends WhatsApp replies.
 */

'use strict';

const { Worker } = require('bullmq');
const { redisConnection } = require('../queue/queue');
const models = require('../models');
const ConversationService = require('../services/conversation.service');
const WhatsAppService = require('../services/whatsapp.service');
const logger = require('../shared/utils/logger');

const conversationService = new ConversationService(models, require('../modules').initializeModules().tenants.service);

const worker = new Worker('ai-processing', async (job) => {
  logger.info('[AIWorker] Processing AI job', { jobId: job.id, data: job.data });

  const { tenantId, sessionId, userMessage, fromNumber } = job.data;
  const session = await models.ConversationSession.findByPk(sessionId);
  const tenant = await require('../modules').initializeModules().tenants.service.getTenantById(tenantId);
  if (!tenant || !session) {
    throw new Error('Invalid AI processing job payload');
  }

  const reply = await conversationService.provider.generateResponse({
    intent: 'UNKNOWN',
    clientName: null,
    services: await conversationService._findServices(tenantId),
    userPrompt: userMessage,
  });

  const log = await WhatsAppService.createMessageLog({
    tenantId,
    customerId: session.customer_id,
    sessionId: session.id,
    whatsappNumber: session.whatsapp_number,
    direction: 'OUTBOUND',
    body: reply,
    status: 'queued',
    eventType: 'ai_reply',
    metadata: { userMessage, to: fromNumber },
  });

  return WhatsAppService.queueOutboundMessage({
    tenantId,
    whatsappNumber: session.whatsapp_number,
    to: fromNumber,
    body: reply,
    sessionId: session.id,
    messageLogId: log.id,
    eventType: 'ai_reply',
  });
}, { connection: redisConnection });

worker.on('completed', (job) => {
  logger.info('[AIWorker] AI job completed', { jobId: job.id });
});

worker.on('failed', (job, err) => {
  logger.error('[AIWorker] AI job failed', { jobId: job.id, error: err.message });
});

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
