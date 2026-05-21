/**
 * Mock AI Provider for development and fallback flows
 */

'use strict';

const { INTENTS } = require('../services/intentRecognition');

class MockProvider {
  async generateResponse({ intent, clientName, services }) {
    const name = clientName ? `${clientName}` : 'cliente';

    switch (intent) {
      case INTENTS.BUSINESS_HOURS:
        return `Olá ${name}! Nosso salão atende de segunda a sexta das 9h às 19h e aos sábados das 9h às 14h.`;
      case INTENTS.SERVICES:
        return `Temos serviços como corte, manicure, pedicure, limpeza de pele e design de sobrancelhas. Posso te ajudar a escolher o melhor para você.`;
      case INTENTS.PRICES:
        return `Os preços variam conforme o serviço. Informe qual serviço você deseja para eu enviar o valor exato.`;
      case INTENTS.HUMAN_SUPPORT:
        return `Já encaminhei sua solicitação para um atendente humano. Por favor, aguarde um retorno em breve.`;
      default:
        return `Obrigado pela sua mensagem. Nosso time está analisando e responderemos em breve.`;
    }
  }
}

module.exports = MockProvider;
