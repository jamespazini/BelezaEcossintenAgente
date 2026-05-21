/**
 * WhatsApp Webhook Routes
 */

'use strict';

const express = require('express');
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const twilio = require('twilio');
const WhatsappController = require('../controllers/whatsapp.controller');

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const tenant = req.query.tenantSlug || req.headers['x-tenant-slug'] || 'global';
    return `whatsapp-webhook:${tenant}:${req.ip}`;
  },
  message: {
    success: false,
    message: 'Muitas requisições ao webhook WhatsApp. Aguarde um momento.',
    error: { code: 'WHATSAPP_WEBHOOK_RATE_LIMIT', details: null },
  },
});

function createWebhookRoutes() {
  const router = Router();

  router.post(
    '/',
    express.urlencoded({ extended: false }),
    twilio.webhook({ validate: true, protocol: process.env.NODE_ENV === 'production' ? 'https' : 'http' }),
    webhookLimiter,
    WhatsappController.handleInbound.bind(WhatsappController)
  );

  router.post(
    '/status',
    express.urlencoded({ extended: false }),
    twilio.webhook({ validate: true, protocol: process.env.NODE_ENV === 'production' ? 'https' : 'http' }),
    webhookLimiter,
    WhatsappController.handleStatusCallback.bind(WhatsappController)
  );

  return router;
}

module.exports = createWebhookRoutes();
