/**
 * Intent Recognition for WhatsApp conversational flows
 */

'use strict';

const INTENTS = {
  CONFIRM_APPOINTMENT: 'CONFIRM_APPOINTMENT',
  CANCEL_APPOINTMENT: 'CANCEL_APPOINTMENT',
  RESCHEDULE_APPOINTMENT: 'RESCHEDULE_APPOINTMENT',
  BUSINESS_HOURS: 'BUSINESS_HOURS',
  SERVICES: 'SERVICES',
  PRICES: 'PRICES',
  HUMAN_SUPPORT: 'HUMAN_SUPPORT',
  UNKNOWN: 'UNKNOWN',
};

const intentMatchers = [
  {
    intent: INTENTS.CONFIRM_APPOINTMENT,
    patterns: [/\b(sim|confirmo|confirmar|ok|certo|de acordo)\b/i],
  },
  {
    intent: INTENTS.CANCEL_APPOINTMENT,
    patterns: [/\b(cancel(ar|ado)?|desmarcar|não vou|nao vou|vou faltar)\b/i],
  },
  {
    intent: INTENTS.RESCHEDULE_APPOINTMENT,
    patterns: [/\b(remarcar|reagendar|reagenda|trocar horário|mudar horário|novo horário)\b/i],
  },
  {
    intent: INTENTS.BUSINESS_HOURS,
    patterns: [/\b(horário|horarios|funcionamento|atendimento|abertura|fechamento)\b/i],
  },
  {
    intent: INTENTS.SERVICES,
    patterns: [/\b(serviço|serviços|corte|manicure|pedicure|limpeza|design|alongamento|sobrancelha)\b/i],
  },
  {
    intent: INTENTS.PRICES,
    patterns: [/\b(valor|preço|precos|preços|quanto custa|quanto fica|quanto custa)\b/i],
  },
  {
    intent: INTENTS.HUMAN_SUPPORT,
    patterns: [/\b(humano|atendente|pessoa|ajuda|suporte|atendimento humano|falar com)\b/i],
  },
];

class IntentRecognitionService {
  recognize(text = '') {
    const normalized = String(text || '').trim();
    if (!normalized) {
      return { intent: INTENTS.UNKNOWN, confidence: 0.3, reason: 'empty_text' };
    }

    for (const matcher of intentMatchers) {
      const found = matcher.patterns.some((pattern) => pattern.test(normalized));
      if (found) {
        return {
          intent: matcher.intent,
          confidence: 0.9,
          reason: matcher.intent.toLowerCase(),
        };
      }
    }

    return {
      intent: INTENTS.UNKNOWN,
      confidence: 0.4,
      reason: 'default_fallback',
    };
  }
}

module.exports = new IntentRecognitionService();
module.exports.INTENTS = INTENTS;
