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
}

module.exports = new WhatsappController();
