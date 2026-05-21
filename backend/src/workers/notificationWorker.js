/**
 * Notification Worker
 * Processes outbound WhatsApp and appointment reminder jobs.
 */

'use strict';

const { Worker } = require('bullmq');
const { queues, redisConnection } = require('../queue/queue');
const WhatsAppService = require('../services/whatsapp.service');
const logger = require('../shared/utils/logger');

const connection = redisConnection;

const outboundWorker = new Worker('outbound-messages', async (job) => {
  logger.info('[NotificationWorker] Processing outbound message job', { jobId: job.id, data: job.data });
  return WhatsAppService.dispatchOutboundMessage(job.data);
}, { connection });

const reminderWorker = new Worker('appointment-reminders', async (job) => {
  logger.info('[NotificationWorker] Processing appointment reminder job', { jobId: job.id });

  const { tenantId, appointmentId, to, body, whatsappNumber, sessionId } = job.data;
  if (!to || !body) {
    throw new Error('Invalid appointment reminder payload');
  }

  const messageLog = await WhatsAppService.createMessageLog({
    tenantId,
    customerId: null,
    sessionId: sessionId || null,
    whatsappNumber,
    direction: 'OUTBOUND',
    body,
    status: 'queued',
    eventType: 'appointment_reminder',
    metadata: { appointmentId },
  });

  return WhatsAppService.queueOutboundMessage({
    tenantId,
    whatsappNumber,
    to,
    body,
    sessionId,
    messageLogId: messageLog.id,
    eventType: 'appointment_reminder',
  });
}, { connection });

outboundWorker.on('completed', (job) => {
  logger.info('[NotificationWorker] Outbound job completed', { jobId: job.id });
});

outboundWorker.on('failed', (job, err) => {
  logger.error('[NotificationWorker] Outbound job failed', { jobId: job.id, error: err.message });
});

reminderWorker.on('completed', (job) => {
  logger.info('[NotificationWorker] Reminder job completed', { jobId: job.id });
});

reminderWorker.on('failed', (job, err) => {
  logger.error('[NotificationWorker] Reminder job failed', { jobId: job.id, error: err.message });
});

process.on('SIGINT', async () => {
  await Promise.all([outboundWorker.close(), reminderWorker.close()]);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await Promise.all([outboundWorker.close(), reminderWorker.close()]);
  process.exit(0);
});
