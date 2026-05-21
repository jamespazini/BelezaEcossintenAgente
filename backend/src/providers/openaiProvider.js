/**
 * OpenAI Provider
 * Prepared for future integration with OpenAI / Gemini / Anthropic
 */

'use strict';

const env = require('../config/env');

class OpenAIProvider {
  constructor(config = {}) {
    this.apiKey = process.env.OPENAI_API_KEY || config.apiKey;
    this.model = process.env.OPENAI_MODEL || config.model || 'gpt-4o-mini';
    this.endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
  }

  async generateResponse({ userPrompt, context = [] }) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured.');
    }

    const systemMessage = {
      role: 'system',
      content: 'Você é um assistente de agendamento para salões de beleza. Responda de forma objetiva e em português.',
    };

    const body = {
      model: this.model,
      messages: [systemMessage, ...context, { role: 'user', content: userPrompt }],
      max_tokens: 250,
      temperature: 0.7,
      top_p: 0.95,
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const message = payload?.choices?.[0]?.message?.content;
    if (!message) {
      throw new Error('OpenAI returned an empty response.');
    }

    return message.trim();
  }
}

module.exports = OpenAIProvider;
