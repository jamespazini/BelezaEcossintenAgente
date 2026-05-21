/**
 * WhatsApp integration service using Twilio and queue-based delivery
 */

'use strict';

const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');
const logger = require('../shared/utils/logger');
const { queues } = require('../queue/queue');
const models = require('../models');
const env = require('../config/env');

class WhatsAppService {
  constructor() {
    this.client = this._createTwilioClient();
    this.outboundQueue = queues.outboundMessages;
    this.reminderQueue = queues.appointmentReminders;
  }

  _createTwilioClient() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      logger.warn('[WhatsAppService] Twilio credentials not configured');
      return null;
    }

    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  normalizePhone(phone = '') {
    return String(phone || '').replace(/\D/g, '');
  }

  async createMessageLog(data) {
    return models.MessageLog.create({
      id: uuidv4(),
      ...data,
    });
  }

  async queueOutboundMessage(payload) {
    const job = await this.outboundQueue.add('send-whatsapp', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    });

    logger.info('[WhatsAppService] Outbound message queued', {
      tenantId: payload.tenantId,
      jobId: job.id,
      whatsappNumber: payload.whatsappNumber,
      to: payload.to,
    });

    return job;
  }

  async dispatchOutboundMessage(jobData) {
    const { tenantId, to, whatsappNumber, body, sessionId, messageLogId, eventType } = jobData;

    if (!this.client) {
      logger.warn('[WhatsAppService] Twilio client unavailable. Outbound will remain queued.', { tenantId });
      await this._updateMessageLogStatus(messageLogId, 'queued');
      return { success: false, reason: 'twilio_not_configured' };
    }

    try {
      const result = await this.client.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${to}`,
        body,
      });

      await this._updateMessageLogStatus(messageLogId, 'sent', result.sid, eventType, result);

      logger.info('[WhatsAppService] Message sent via Twilio', {
        tenantId,
        providerMessageId: result.sid,
        to,
        sessionId,
      });

      return {
        success: true,
        providerMessageId: result.sid,
        status: result.status,
      };
    } catch (error) {
      logger.error('[WhatsAppService] Error sending Twilio WhatsApp message', {
        tenantId,
        error: error.message,
        to,
        body,
      });
      await this._updateMessageLogStatus(messageLogId, 'failed', null, eventType, { error: error.message });
      throw error;
    }
  }

  async _updateMessageLogStatus(id, status, providerMessageId = null, eventType = null, metadata = null) {
    if (!id) return null;
    const payload = { status };
    if (providerMessageId) payload.provider_message_id = providerMessageId;
    if (eventType) payload.event_type = eventType;
    if (metadata) payload.metadata = metadata;

    return models.MessageLog.update(payload, { where: { id } });
  }

  async handleStatusCallback({ tenantId, providerMessageId, status, eventType, metadata }) {
    const result = await models.MessageLog.findOne({
      where: { tenant_id: tenantId, provider_message_id: providerMessageId },
    });
    if (!result) {
      logger.warn('[WhatsAppService] Status callback received for unknown message', {
        tenantId,
        providerMessageId,
      });
      return null;
    }

    return this._updateMessageLogStatus(result.id, status, providerMessageId, eventType, metadata || {});
  }

  async queueAppointmentReminder(payload) {
    const job = await this.reminderQueue.add('reminder', payload, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
    logger.info('[WhatsAppService] Appointment reminder queued', { tenantId: payload.tenantId, jobId: job.id });
    return job;
  }
}

module.exports = new WhatsAppService();
