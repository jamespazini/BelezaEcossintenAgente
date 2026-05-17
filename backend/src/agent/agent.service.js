/**
 * Agent Service - Núcleo da IA
 * Integra OpenAI com lógica do Beleza Ecosystem
 */

const OpenAI = require('openai');
const { PROMPT_BASE } = require('./prompt');
const { parseActions } = require('./actionParser');
const logger = require('../utils/logger');
const env = require('../config/env');

class AgentService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: env.openai.apiKey
    });
    this.model = env.openai.model;
  }

  /**
   * Gera contexto dinâmico do negócio
   * @param {Object} establishmentData - Dados do estabelecimento
   * @returns {string} Contexto formatado
   */
  async generateContext(establishmentData = {}) {
    const {
      name = 'Estabelecimento',
      totalClients = 0,
      monthlyRevenue = 0,
      appointmentsThisMonth = 0,
      averageTicket = 0,
      activeServices = 0,
      inactiveClients = 0
    } = establishmentData;

    return `
**Estabelecimento:** ${name}
**Clientes ativos:** ${totalClients}
**Receita este mês:** R$ ${monthlyRevenue.toFixed(2)}
**Agendamentos este mês:** ${appointmentsThisMonth}
**Ticket médio:** R$ ${averageTicket.toFixed(2)}
**Serviços oferecidos:** ${activeServices}
**Clientes inativos:** ${inactiveClients}
    `.trim();
  }

  /**
   * Processa mensagem e retorna resposta com ações
   * @param {string} message - Mensagem do usuário
   * @param {string} establishmentId - ID do estabelecimento
   * @param {Object} establishmentData - Dados do estabelecimento
   * @returns {Object} { response, actions, data }
   */
  async processMessage(message, establishmentId, establishmentData = {}) {
    try {
      // Gerar contexto dinâmico
      const dynamicContext = await this.generateContext(establishmentData);

      // Montar prompt final
      const systemPrompt = PROMPT_BASE.replace(
        '{CONTEXTO_DINAMICO}',
        dynamicContext
      );

      logger.info(`[AGENT] Processando mensagem do estabelecimento ${establishmentId}`);

      // Chamar OpenAI
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const aiResponse = response.choices[0].message.content;

      // Extrair ações da resposta
      const actions = parseActions(aiResponse);

      logger.info(`[AGENT] Resposta gerada com ${actions.length} ação(ões)`);

      return {
        success: true,
        response: aiResponse,
        actions,
        metadata: {
          model: this.model,
          tokensUsed: response.usage.total_tokens,
          timestamp: new Date(),
          establishmentId
        }
      };
    } catch (error) {
      logger.error('[AGENT] Erro ao processar mensagem:', error);
      throw new Error(`Erro ao processar mensagem: ${error.message}`);
    }
  }

  /**
   * Testa conexão com OpenAI
   * @returns {boolean}
   */
  async testConnection() {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'teste' }],
        max_tokens: 5
      });
      return !!response.choices[0].message.content;
    } catch (error) {
      logger.error('[AGENT] Erro ao testar conexão com OpenAI:', error);
      return false;
    }
  }
}

module.exports = new AgentService();
