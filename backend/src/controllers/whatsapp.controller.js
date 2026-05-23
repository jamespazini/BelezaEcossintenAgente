/**
 * WhatsApp webhook controller
 */

'use strict';

const { initializeModules } = require('../modules');
const models = require('../models');
const ConversationService = require('../services/conversation.service');
const WhatsAppService = require('../services/whatsapp.service');
const logger = require('../shared/utils/logger');

const modules = initializeModules();
const conversationService = new ConversationService(models, modules.tenants.service);

class WhatsappController {
  async handleInbound(req, res, next) {
    try {
      const tenantSlug = req.query.tenantSlug || req.headers['x-tenant-slug'];
      if (!tenantSlug) {
        return res.status(400).json({
          success: false,
          message: 'Tenant slug is required',
          error: { code: 'TENANT_REQUIRED' },
        });
      }

      const tenant = await modules.tenants.service.getTenantBySlug(tenantSlug);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found',
          error: { code: 'TENANT_NOT_FOUND' },
        });
      }

      const payload = {
        tenant,
        body: req.body.Body || req.body.body || '',
        from: req.body.From || req.body.from || '',
        to: req.body.To || req.body.to || '',
        messageSid: req.body.MessageSid || req.body.messageSid || null,
        smsStatus: req.body.SmsStatus || req.body.smsStatus || null,
      };

      const result = await conversationService.processInbound(payload);

      res.status(200).json({
        success: true,
        data: {
          tenant: tenant.slug,
          intent: result.intent,
          response: result.response,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async handleStatusCallback(req, res, next) {
    try {
      const tenantSlug = req.query.tenantSlug || req.headers['x-tenant-slug'];
      if (!tenantSlug) {
        return res.status(400).json({
          success: false,
          message: 'Tenant slug is required',
          error: { code: 'TENANT_REQUIRED' },
        });
      }

      const tenant = await modules.tenants.service.getTenantBySlug(tenantSlug);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found',
          error: { code: 'TENANT_NOT_FOUND' },
        });
      }

      await WhatsAppService.handleStatusCallback({
        tenantId: tenant.id,
        providerMessageId: req.body.MessageSid || req.body.MessageSid || null,
        status: req.body.MessageStatus || req.body.MessageStatus || null,
        eventType: 'whatsapp_status_callback',
        metadata: { body: req.body },
      });

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
  async getConversations(req, res, next) {
    try {
      const { tenant_id } = req.tenant;
      const { page = 1, limit = 20, status } = req.query;
      const offset = (page - 1) * limit;

      const where = { tenant_id };
      if (status) where.conversation_state = status;

      const { count, rows } = await models.ConversationSession.findAndCountAll({
        where,
        include: [{ model: models.Client, as: 'client', attributes: ['id', 'first_name', 'last_name', 'phone', 'avatar'] }],
        order: [['last_interaction_at', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });

      res.json({
        success: true,
        data: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(count / limit),
          data: rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req, res, next) {
    try {
      const { tenant_id } = req.tenant;
      const { sessionId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const session = await models.ConversationSession.findOne({
        where: { id: sessionId, tenant_id },
      });

      if (!session) {
        return res.status(404).json({ success: false, message: 'Conversa não encontrada' });
      }

      const { count, rows } = await models.MessageLog.findAndCountAll({
        where: { session_id: sessionId, tenant_id },
        order: [['created_at', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });

      res.json({
        success: true,
        data: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(count / limit),
          data: rows.reverse(), // Retornar na ordem cronológica
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req, res, next) {
    try {
      const { tenant_id } = req.tenant;
      const { sessionId, body, to } = req.body;

      if (!body) {
        return res.status(400).json({ success: false, message: 'Corpo da mensagem é obrigatório' });
      }

      let session;
      let targetNumber;
      let customerId = null;

      if (sessionId) {
        session = await models.ConversationSession.findOne({
          where: { id: sessionId, tenant_id },
        });
        if (!session) {
          return res.status(404).json({ success: false, message: 'Conversa não encontrada' });
        }
        targetNumber = session.customer_number;
        customerId = session.customer_id;
      } else if (to) {
        targetNumber = WhatsAppService.normalizePhone(to);
        const client = await conversationService.findClientByPhone(tenant_id, targetNumber);
        customerId = client ? client.id : null;
        session = await conversationService.findOrCreateSession({
          tenantId: tenant_id,
          customerId,
          customerNumber: targetNumber,
          whatsappNumber: WhatsAppService.normalizePhone(process.env.TWILIO_WHATSAPP_NUMBER || ''),
        });
      } else {
        return res.status(400).json({ success: false, message: 'Informe sessionId ou to (número de destino)' });
      }

      const whatsappNumber = WhatsAppService.normalizePhone(process.env.TWILIO_WHATSAPP_NUMBER || '');

      const messageLog = await conversationService.logMessage({
        tenantId: tenant_id,
        customerId,
        sessionId: session.id,
        whatsappNumber,
        direction: 'OUTBOUND',
        body,
        status: 'queued',
        eventType: 'manual_outbound',
        metadata: { source: 'dashboard' },
      });

      await conversationService.updateSession(session, {
        conversation_state: 'ACTIVE',
      });

      await WhatsAppService.queueOutboundMessage({
        tenantId: tenant_id,
        whatsappNumber,
        to: targetNumber,
        body,
        sessionId: session.id,
        messageLogId: messageLog.id,
        eventType: 'manual_outbound',
      });

      res.status(200).json({
        success: true,
        message: 'Mensagem enviada para a fila',
        data: {
          messageId: messageLog.id,
          sessionId: session.id,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const { tenant_id } = req.tenant;

      const activeConversations = await models.ConversationSession.count({
        where: { tenant_id, conversation_state: 'ACTIVE' },
      });

      const totalMessages = await models.MessageLog.count({
        where: { tenant_id },
      });

      res.json({
        success: true,
        data: {
          activeConversations,
          totalMessages,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WhatsappController();
