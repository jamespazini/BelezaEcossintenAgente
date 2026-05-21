/**
 * WhatsApp integration service using Twilio and queue-based delivery
 */

'use strict';

const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const logger = require('../shared/utils/logger');
const { queues } = require('../queue/queue');
const models = require('../models');
const { initializeModules } = require('../modules');
const { SUBSCRIPTION_STATUS, ERROR_CODES } = require('../shared/constants');

class WhatsAppService {
  constructor() {
    this.client = this._createTwilioClient();
    this.outboundQueue = queues.outboundMessages;
    this.reminderQueue = queues.appointmentReminders;
    this.billingModule = null;
    this.usageService = null;
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

  async _getBillingServices() {
    if (this.billingModule && this.usageService) {
      return { billing: this.billingModule, usageService: this.usageService };
    }

    const modules = initializeModules();
    this.billingModule = modules.billing;
    this.usageService = modules.billing?.services?.usageService;

    return { billing: this.billingModule, usageService: this.usageService };
  }

  async _markBlocked(messageLogId, reason, details) {
    if (!messageLogId) return null;
    return this._updateMessageLogStatus(messageLogId, 'blocked', null, 'whatsapp_blocked', {
      reason,
      details,
    });
  }

  async _getSubscriptionForTenant(tenantId) {
    const { billing } = await this._getBillingServices();
    if (!billing?.models?.Subscription) {
      return null;
    }

    return billing.models.Subscription.findOne({
      where: { tenant_id: tenantId },
      order: [['created_at', 'DESC']],
    });
  }

  async _ensureSubscriptionAllowed(tenantId, messageLogId = null) {
    const subscription = await this._getSubscriptionForTenant(tenantId);
    if (!subscription) {
      await this._markBlocked(messageLogId, 'subscription_missing', 'Tenant has no active subscription');
      throw new Error('Subscription required to send WhatsApp messages');
    }

    const status = subscription.status?.toLowerCase();
    if (![SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIAL].includes(status)) {
      await this._markBlocked(messageLogId, `subscription_${status}`, `Subscription status is ${status}`);
      throw new Error(`WhatsApp outbound blocked: subscription ${status}`);
    }

    return subscription;
  }

  async _checkWhatsAppQuota(tenantId, quantity = 1, messageLogId = null) {
    const { usageService } = await this._getBillingServices();
    if (!usageService) {
      return { allowed: true };
    }

    const quota = await usageService.checkLimit(tenantId, usageService.METRICS.WHATSAPP_MESSAGES);
    if (!quota.allowed || (quota.limit !== null && quota.current + quantity > quota.limit)) {
      await this._markBlocked(messageLogId, 'whatsapp_quota_exceeded', `Hit WhatsApp quota of ${quota.limit} messages`);
      throw new Error('WhatsApp monthly message quota exceeded');
    }

    return quota;
  }

  async _recordOutboundMessageUsage(tenantId, quantity = 1, metadata = {}) {
    const { usageService } = await this._getBillingServices();
    if (!usageService) {
      return null;
    }

    return usageService.incrementUsage(tenantId, usageService.METRICS.WHATSAPP_MESSAGES, quantity, metadata);
  }

  async queueOutboundMessage(payload) {
    if (payload.tenantId) {
      await this._ensureSubscriptionAllowed(payload.tenantId, payload.messageLogId);
      await this._checkWhatsAppQuota(payload.tenantId, 1, payload.messageLogId);
    }

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

    if (tenantId && messageLogId) {
      await this._ensureSubscriptionAllowed(tenantId, messageLogId);
    }

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
      await this._recordOutboundMessageUsage(tenantId, 1, { eventType, to, sessionId, whatsappNumber });

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

  async queueUpcomingAppointmentReminders() {
    const startOfTomorrow = new Date();
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    startOfTomorrow.setHours(0, 0, 0, 0);

    const endOfTomorrow = new Date(startOfTomorrow);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

    const appointments = await models.Appointment.findAll({
      where: {
        status: { [Op.in]: ['PENDING', 'CONFIRMED'] },
        start_time: {
          [Op.gte]: startOfTomorrow,
          [Op.lt]: endOfTomorrow,
        },
        reminder_sent_at: null,
      },
      include: [
        { model: models.Client, as: 'client' },
        { model: models.Service, as: 'service' },
        { model: models.Professional, as: 'professional' },
      ],
    });

    const jobs = [];
    for (const appointment of appointments) {
      const client = appointment.client;
      if (!client || !client.phone) {
        logger.warn('[WhatsAppService] Skipping appointment reminder due to missing client phone', {
          appointmentId: appointment.id,
          tenantId: appointment.tenant_id,
        });
        continue;
      }

      const to = this.normalizePhone(client.phone);
      if (!to) {
        logger.warn('[WhatsAppService] Skipping appointment reminder due to invalid phone', {
          appointmentId: appointment.id,
          tenantId: appointment.tenant_id,
          phone: client.phone,
        });
        continue;
      }

      const [session] = await models.ConversationSession.findOrCreate({
        where: {
          tenant_id: appointment.tenant_id,
          whatsapp_number: this.normalizePhone(process.env.TWILIO_WHATSAPP_NUMBER),
          customer_number: to,
        },
        defaults: {
          id: uuidv4(),
          tenant_id: appointment.tenant_id,
          customer_id: appointment.client_id,
          customer_number: to,
          whatsapp_number: this.normalizePhone(process.env.TWILIO_WHATSAPP_NUMBER),
          conversation_state: 'ACTIVE',
          session_context: {},
        },
      });

      const serviceName = appointment.service?.name || 'seu serviço';
      const professionalName = appointment.professional?.first_name
        ? ` com ${appointment.professional.first_name}`
        : '';
      const startDate = appointment.start_time.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      const body = `Lembrete de agendamento: ${serviceName}${professionalName} está marcado para ${startDate}. Responda "CONFIRMAR" para confirmar ou "CANCELAR" para cancelar.`;

      try {
        const job = await this.queueAppointmentReminder({
          tenantId: appointment.tenant_id,
          appointmentId: appointment.id,
          to,
          whatsappNumber: this.normalizePhone(process.env.TWILIO_WHATSAPP_NUMBER),
          body,
          sessionId: session.id,
        });

        appointment.reminder_sent_at = new Date();
        await appointment.save();

        jobs.push({ appointmentId: appointment.id, jobId: job.id });
      } catch (error) {
        logger.error('[WhatsAppService] Failed to queue appointment reminder', {
          appointmentId: appointment.id,
          tenantId: appointment.tenant_id,
          error: error.message,
        });
      }
    }

    return jobs;
  }
}

module.exports = new WhatsAppService();
