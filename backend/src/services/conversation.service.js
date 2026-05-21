/**
 * Conversation Service
 * Handles inbound WhatsApp messages, session state, and automation actions
 */

'use strict';

const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const logger = require('../shared/utils/logger');
const intentRecognition = require('./intentRecognition');
const WhatsAppService = require('./whatsapp.service');
const { queues } = require('../queue/queue');
const MockProvider = require('../providers/mockProvider');
const OpenAIProvider = require('../providers/openaiProvider');

class ConversationService {
  constructor(models, tenantService) {
    this.models = models;
    this.tenantService = tenantService;
    this.provider = process.env.OPENAI_API_KEY ? new OpenAIProvider() : new MockProvider();
  }

  _normalizePhone(phone = '') {
    return String(phone || '').replace(/\D/g, '');
  }

  async findClientByPhone(tenantId, phone) {
    const sanitized = this._normalizePhone(phone);
    return this.models.Client.findOne({
      where: {
        tenant_id: tenantId,
        phone: sanitized,
      },
    });
  }

  async findOrCreateSession({ tenantId, customerId, customerNumber, whatsappNumber }) {
    const [session] = await this.models.ConversationSession.findOrCreate({
      where: {
        tenant_id: tenantId,
        whatsapp_number: whatsappNumber,
        customer_number: customerNumber,
      },
      defaults: {
        id: uuidv4(),
        customer_id: customerId,
        tenant_id: tenantId,
        customer_number: customerNumber,
        whatsapp_number: whatsappNumber,
        conversation_state: 'NEW',
        session_context: {},
      },
    });

    return session;
  }

  async logMessage({ tenantId, customerId, sessionId, whatsappNumber, direction, body, status, providerMessageId, eventType, metadata }) {
    return this.models.MessageLog.create({
      id: uuidv4(),
      tenant_id: tenantId,
      customer_id: customerId,
      session_id: sessionId,
      whatsapp_number: whatsappNumber,
      direction,
      body,
      status,
      provider_message_id: providerMessageId,
      event_type: eventType,
      metadata,
    });
  }

  async updateSession(session, changes = {}) {
    if (!session) return null;
    const payload = {
      ...changes,
      last_interaction_at: new Date(),
    };
    return session.update(payload);
  }

  async processInbound({ tenant, body, from, to, messageSid, smsStatus }) {
    const tenantId = tenant.id;
    const whatsappNumber = this._normalizePhone(to);
    const fromNumber = this._normalizePhone(from);
    const client = await this.findClientByPhone(tenantId, fromNumber);
    const session = await this.findOrCreateSession({
      tenantId,
      customerId: client?.id || null,
      customerNumber: fromNumber,
      whatsappNumber,
    });

    await this.logMessage({
      tenantId,
      customerId: client?.id || null,
      sessionId: session.id,
      whatsappNumber,
      direction: 'INBOUND',
      body,
      status: 'received',
      providerMessageId: messageSid,
      eventType: 'whatsapp_inbound',
      metadata: { smsStatus, from, to },
    });

    const intent = intentRecognition.recognize(body);
    const response = await this._routeIntent({ intent, tenant, client, session, body, fromNumber, whatsappNumber });

    return { session, intent, response };
  }

  async _routeIntent({ intent, tenant, client, session, body, fromNumber, whatsappNumber }) {
    const tenantId = tenant.id;
    const name = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : null;
    let text;
    let actionType = null;
    let actionPayload = null;

    switch (intent.intent) {
      case intentRecognition.INTENTS.CONFIRM_APPOINTMENT:
        ({ text, actionType, actionPayload } = await this._handleAppointmentConfirmation(tenantId, client, session));
        break;
      case intentRecognition.INTENTS.CANCEL_APPOINTMENT:
        ({ text, actionType, actionPayload } = await this._handleAppointmentCancellation(tenantId, client, session));
        break;
      case intentRecognition.INTENTS.RESCHEDULE_APPOINTMENT:
        ({ text, actionType, actionPayload } = await this._handleAppointmentReschedule(session));
        break;
      case intentRecognition.INTENTS.BUSINESS_HOURS:
      case intentRecognition.INTENTS.SERVICES:
      case intentRecognition.INTENTS.PRICES:
      case intentRecognition.INTENTS.HUMAN_SUPPORT:
        text = await this.provider.generateResponse({ intent: intent.intent, clientName: name, services: await this._findServices(tenantId) });
        actionType = intent.intent;
        actionPayload = { rawText: body };
        break;
      default:
        await this._queueAiProcessing({ tenant, session, client, intent, body, fromNumber });
        text = 'Obrigado pela mensagem. Estamos analisando seu pedido e retornaremos em breve pelo WhatsApp.';
        actionType = 'ESCALATE_HUMAN';
        actionPayload = { fallback: true, rawText: body };
        break;
    }

    await this.models.AiAction.create({
      id: uuidv4(),
      tenant_id: tenantId,
      session_id: session.id,
      appointment_id: actionPayload?.appointmentId || null,
      action_type: actionType || 'ESCALATE_HUMAN',
      action_payload: actionPayload,
    });

    await this.updateSession(session, {
      conversation_state: intent.intent === intentRecognition.INTENTS.RESCHEDULE_APPOINTMENT ? 'AWAITING_RESCHEDULE' : 'ACTIVE',
      session_context: {
        last_intent: intent.intent,
        last_message: body,
        last_response: text,
      },
    });

    const messageLog = await this.logMessage({
      tenantId,
      customerId: client?.id || null,
      sessionId: session.id,
      whatsappNumber,
      direction: 'OUTBOUND',
      body: text,
      status: 'queued',
      eventType: 'whatsapp_response',
      metadata: { intent: intent.intent },
    });

    await WhatsAppService.queueOutboundMessage({
      tenantId,
      whatsappNumber,
      to: fromNumber,
      body: text,
      sessionId: session.id,
      messageLogId: messageLog.id,
      eventType: intent.intent,
    });

    return text;
  }

  async _handleAppointmentConfirmation(tenantId, client, session) {
    if (!client) {
      return {
        text: 'Não consegui identificar seu cadastro. Envie seu nome completo ou telefone cadastrado para continuarmos.',
        actionType: 'HUMAN_SUPPORT',
        actionPayload: { reason: 'client_not_found' },
      };
    }

    const appointment = await this.models.Appointment.findOne({
      where: {
        tenant_id: tenantId,
        client_id: client.id,
        status: 'PENDING',
        start_time: { [Op.gte]: new Date() },
      },
      order: [['start_time', 'ASC']],
    });

    if (!appointment) {
      return {
        text: 'Não encontrei nenhum agendamento pendente em seu nome. Se desejar, posso encaminhar para um atendente humano.',
        actionType: 'HUMAN_SUPPORT',
        actionPayload: { reason: 'no_pending_appointment' },
      };
    }

    await appointment.update({ status: 'CONFIRMED' });

    return {
      text: `Seu agendamento de ${appointment.start_time.toLocaleString('pt-BR')} foi confirmado. Obrigado!`,
      actionType: 'CONFIRM_APPOINTMENT',
      actionPayload: { appointmentId: appointment.id },
    };
  }

  async _handleAppointmentCancellation(tenantId, client, session) {
    if (!client) {
      return {
        text: 'Preciso do seu cadastro para cancelar o agendamento. Por favor envie seu telefone ou e-mail cadastrado.',
        actionType: 'HUMAN_SUPPORT',
        actionPayload: { reason: 'client_not_found' },
      };
    }

    const appointment = await this.models.Appointment.findOne({
      where: {
        tenant_id: tenantId,
        client_id: client.id,
        status: { [Op.in]: ['PENDING', 'CONFIRMED'] },
        start_time: { [Op.gte]: new Date() },
      },
      order: [['start_time', 'ASC']],
    });

    if (!appointment) {
      return {
        text: 'Não encontrei agendamentos ativos em seu nome para cancelar. Caso queira, posso solicitar ajuda humana.',
        actionType: 'HUMAN_SUPPORT',
        actionPayload: { reason: 'no_active_appointment' },
      };
    }

    await appointment.update({ status: 'CANCELLED' });

    return {
      text: `Seu agendamento de ${appointment.start_time.toLocaleString('pt-BR')} foi cancelado. Se quiser remarcar, é só avisar!`,
      actionType: 'CANCEL_APPOINTMENT',
      actionPayload: { appointmentId: appointment.id },
    };
  }

  async _handleAppointmentReschedule(session) {
    return {
      text: 'Claro! Por favor, envie a nova data e hora desejada para o seu agendamento.',
      actionType: 'RESCHEDULE_APPOINTMENT',
      actionPayload: { state: 'awaiting_reschedule_details' },
    };
  }

  async _findServices(tenantId) {
    return this.models.Service.findAll({
      where: { tenant_id: tenantId },
      limit: 5,
      order: [['created_at', 'DESC']],
    });
  }

  async _queueAiProcessing({ tenant, session, client, intent, body, fromNumber }) {
    const tenantId = tenant.id;
    const payload = {
      tenantId,
      sessionId: session.id,
      userMessage: body,
      fromNumber,
      clientId: client?.id || null,
      intent: intent.intent,
      services: await this._findServices(tenantId),
    };

    const job = await queues.aiProcessing.add('generate-ai-reply', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: true,
      removeOnFail: false,
    });

    logger.info('[ConversationService] AI fallback queued', {
      tenantId,
      sessionId: session.id,
      jobId: job.id,
      intent: intent.intent,
    });
  }
}

module.exports = ConversationService;
