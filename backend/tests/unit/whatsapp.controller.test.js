'use strict';

process.env.NODE_ENV = 'test';

const mockProcessInbound = jest.fn(async () => ({ intent: 'UNKNOWN', response: 'Resposta de teste' }));
const mockHandleStatusCallback = jest.fn(async () => null);

jest.mock('../../src/services/whatsapp.service', () => ({
  handleStatusCallback: mockHandleStatusCallback,
}));

jest.mock('../../src/modules', () => ({
  initializeModules: jest.fn(() => ({
    tenants: { service: { getTenantBySlug: jest.fn(async (slug) => slug === 'test-salon' ? { id: 'tenant-1', slug } : null) } },
  })),
}));

jest.mock('../../src/services/conversation.service', () => {
  return jest.fn().mockImplementation(() => ({ processInbound: mockProcessInbound }));
});

const controller = require('../../src/controllers/whatsapp.controller');

function makeResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('WhatsappController.handleInbound', () => {
  beforeEach(() => {
    mockProcessInbound.mockClear();
  });

  test('retorna 400 se tenantSlug não for enviado', async () => {
    const res = makeResponse();
    await controller.handleInbound({ query: {}, headers: {}, body: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: { code: 'TENANT_REQUIRED' } }));
  });

  test('retorna 404 se tenant não existir', async () => {
    const res = makeResponse();
    await controller.handleInbound({ query: { tenantSlug: 'unknown-salon' }, headers: {}, body: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: { code: 'TENANT_NOT_FOUND' } }));
  });

  test('processa inbound quando tenant está presente', async () => {
    const res = makeResponse();
    const req = {
      query: { tenantSlug: 'test-salon' },
      headers: {},
      body: { Body: 'Olá', From: '+5511999999999', To: '+55115551234', MessageSid: 'sid-123', SmsStatus: 'received' },
    };

    await controller.handleInbound(req, res, jest.fn());

    expect(mockProcessInbound).toHaveBeenCalledWith(expect.objectContaining({ tenant: expect.objectContaining({ slug: 'test-salon' }), body: 'Olá', from: '+5511999999999', to: '+55115551234' }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ intent: 'UNKNOWN', response: 'Resposta de teste' }) }));
  });
});

describe('WhatsappController.handleStatusCallback', () => {
  test('retorna 400 se tenantSlug não for enviado', async () => {
    const res = makeResponse();
    await controller.handleStatusCallback({ query: {}, headers: {}, body: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: { code: 'TENANT_REQUIRED' } }));
  });

  test('retorna 404 se tenant não existir', async () => {
    const res = makeResponse();
    await controller.handleStatusCallback({ query: { tenantSlug: 'unknown-salon' }, headers: {}, body: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('chama handleStatusCallback do serviço WhatsApp quando tenant existe', async () => {
    const res = makeResponse();
    const req = {
      query: { tenantSlug: 'test-salon' },
      headers: {},
      body: { MessageSid: 'sid-123', MessageStatus: 'delivered' },
    };

    await controller.handleStatusCallback(req, res, jest.fn());

    expect(mockHandleStatusCallback).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', providerMessageId: 'sid-123', status: 'delivered' }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});
