'use strict';

const request = require('supertest');
const express = require('express');

function buildAppWithMocks({ validSignature = true } = {}) {
  jest.resetModules();

  const controller = {
    handleInbound: jest.fn((req, res) => {
      if (!req.query?.tenantSlug) {
        return res.status(400).json({ success: false, error: { code: 'TENANT_REQUIRED' } });
      }
      return res.json({ success: true, inbound: true });
    }),
    handleStatusCallback: jest.fn((req, res) => res.json({ success: true, statusCallback: true })),
  };

  const twilio = {
    webhook: jest.fn(() => {
      return (req, res, next) => {
        if (!validSignature) {
          return res.status(401).json({ success: false, message: 'Invalid Twilio signature' });
        }
        next();
      };
    }),
  };

  jest.doMock('twilio', () => twilio, { virtual: true });
  jest.doMock('../../src/controllers/whatsapp.controller', () => controller, { virtual: true });

  const route = require('../../src/routes/webhook.whatsapp.routes');
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use('/api/webhooks/whatsapp', route);
  return { app, controller, twilio };
}

describe('WhatsApp webhook routes', () => {
  test('accepts inbound webhook with tenantSlug and valid Twilio auth', async () => {
    const { app, controller } = buildAppWithMocks({ validSignature: true });
    const res = await request(app)
      .post('/api/webhooks/whatsapp')
      .query({ tenantSlug: 'test-salon' })
      .send({ Body: 'Olá', From: '+5511999999999', To: '+5511999999999', MessageSid: 'sid-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(controller.handleInbound).toHaveBeenCalled();
  });

  test('rejects webhook when Twilio authentication fails', async () => {
    const { app } = buildAppWithMocks({ validSignature: false });

    const res = await request(app)
      .post('/api/webhooks/whatsapp')
      .query({ tenantSlug: 'test-salon' })
      .send({ Body: 'Olá' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid Twilio signature');
  });

  test('rejects inbound webhook without tenantSlug', async () => {
    const { app } = buildAppWithMocks({ validSignature: true });
    const res = await request(app)
      .post('/api/webhooks/whatsapp')
      .send({ Body: 'Olá', From: '+5511999999999', To: '+5511999999999' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TENANT_REQUIRED');
  });

  test('aplica rate limit ao webhook de WhatsApp', async () => {
    const { app } = buildAppWithMocks({ validSignature: true });

    for (let index = 0; index < 30; index += 1) {
      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .query({ tenantSlug: 'test-salon' })
        .send({ Body: 'Teste', From: '+5511999999999', To: '+5511999999999' });
      expect(response.status).toBe(200);
    }

    const res = await request(app)
      .post('/api/webhooks/whatsapp')
      .query({ tenantSlug: 'test-salon' })
      .send({ Body: 'Teste', From: '+5511999999999', To: '+5511999999999' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('WHATSAPP_WEBHOOK_RATE_LIMIT');
  });

  test('accepts status callback route', async () => {
    const { app, controller } = buildAppWithMocks({ validSignature: true });
    const res = await request(app)
      .post('/api/webhooks/whatsapp/status')
      .query({ tenantSlug: 'test-salon' })
      .send({ MessageSid: 'sid-status', MessageStatus: 'delivered' });

    expect(res.status).toBe(200);
    expect(controller.handleStatusCallback).toHaveBeenCalled();
  });
});
