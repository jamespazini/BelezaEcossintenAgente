/**
 * Agent Controller - Controla requisições ao agente IA
 * Rota principal: POST /api/ia
 */

const agentService = require('../agent/agent.service');
const actionsService = require('../services/actions.service');
const { isValidAction, getActionHandler } = require('../agent/actionParser');
const { Sequelize, Establishment, Client, Service, Appointment, FinancialEntry } = require('../models');
const logger = require('../utils/logger');

const { Op } = Sequelize;

class AgentController {
  static async buildEstablishmentContext(establishment) {
    const establishmentId = establishment.id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(now.getDate() - 90);

    const [
      totalClients,
      activeServices,
      appointmentsThisMonth,
      revenueThisMonth,
    ] = await Promise.all([
      Client.count({ where: { establishment_id: establishmentId } }),
      Service.count({ where: { establishment_id: establishmentId, is_active: true } }),
      Appointment.count({
        where: {
          establishment_id: establishmentId,
          start_time: {
            [Op.between]: [monthStart, now],
          },
        },
      }),
      FinancialEntry.sum('amount', {
        where: {
          establishment_id: establishmentId,
          createdAt: {
            [Op.between]: [monthStart, now],
          },
        },
      }),
    ]);

    const activeAppointments = await Appointment.findAll({
      attributes: ['client_id'],
      where: {
        establishment_id: establishmentId,
        start_time: {
          [Op.gte]: ninetyDaysAgo,
        },
      },
      group: ['client_id'],
    });

    const activeClientIds = activeAppointments.map((item) => item.client_id).filter(Boolean);
    const inactiveClients = activeClientIds.length > 0
      ? await Client.count({
        where: {
          establishment_id: establishmentId,
          id: { [Op.notIn]: activeClientIds },
        },
      })
      : totalClients;

    const monthlyRevenue = parseFloat(revenueThisMonth || 0);
    const appointmentsCount = appointmentsThisMonth || 0;

    return {
      name: establishment.name,
      totalClients: totalClients || 0,
      monthlyRevenue,
      appointmentsThisMonth: appointmentsCount,
      averageTicket: appointmentsCount > 0 ? parseFloat((monthlyRevenue / appointmentsCount).toFixed(2)) : 0,
      activeServices: activeServices || 0,
      inactiveClients: inactiveClients || 0,
    };
  }

  /**
   * Processa mensagem e executa ações
   * POST /api/ia
   */
  static async processMessage(req, res) {
    try {
      const { message, establishmentId } = req.body;

      if (!message || !establishmentId) {
        return res.status(400).json({
          success: false,
          error: 'Mensagem e establishmentId são obrigatórios',
        });
      }

      logger.info(`[CONTROLLER] Nova mensagem recebida: "${message.substring(0, 50)}..."`);

      const establishment = await Establishment.findByPk(establishmentId);
      if (!establishment) {
        return res.status(404).json({
          success: false,
          error: 'Estabelecimento não encontrado',
        });
      }

      const establishmentData = await AgentController.buildEstablishmentContext(establishment);

      const agentResult = await agentService.processMessage(
        message,
        establishmentId,
        establishmentData,
      );

      if (!agentResult.success) {
        return res.status(500).json({
          success: false,
          error: 'Erro ao processar mensagem',
        });
      }

      const actions = agentResult.actions;
      const executedActions = [];

      for (const action of actions) {
        try {
          if (!isValidAction(action.name)) {
            logger.warn(`[CONTROLLER] Ação inválida: ${action.name}`);
            continue;
          }

          action.params.estabelecimentoId = establishmentId;
          if (req.user?.tenantId) {
            action.params.tenantId = req.user.tenantId;
          }
          if (req.user?.id) {
            action.params.createdBy = req.user.id;
          }

          const handler = getActionHandler(action.name);
          if (!handler || !actionsService[handler]) {
            logger.warn(`[CONTROLLER] Handler não encontrado: ${handler}`);
            continue;
          }

          logger.info(`[CONTROLLER] Executando ação: ${action.name}`);
          const actionResult = await actionsService[handler](action.params);

          executedActions.push({
            name: action.name,
            status: 'success',
            result: actionResult,
          });
        } catch (error) {
          logger.error(`[CONTROLLER] Erro ao executar ação ${action.name}:`, error);
          executedActions.push({
            name: action.name,
            status: 'error',
            error: error.message,
          });
        }
      }

      return res.status(200).json({
        success: true,
        response: agentResult.response,
        actions: executedActions,
        metadata: agentResult.metadata,
      });
    } catch (error) {
      logger.error('[CONTROLLER] Erro ao processar mensagem:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Testa conexão com OpenAI
   * GET /api/ia/health
   */
  static async health(req, res) {
    try {
      const isConnected = await agentService.testConnection();

      if (isConnected) {
        return res.status(200).json({
          success: true,
          message: 'Agente IA está funcionando',
          model: agentService.model,
        });
      }

      return res.status(503).json({
        success: false,
        error: 'OpenAI não está acessível',
      });
    } catch (error) {
      logger.error('[CONTROLLER] Erro ao verificar saúde:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Retorna instruções de uso
   * GET /api/ia
   */
  static async getInfo(req, res) {
    return res.status(200).json({
      success: true,
      message: 'Agente Inteligente - Beleza Ecosystem',
      endpoints: {
        'POST /api/ia': 'Enviar mensagem para o agente',
        'GET /api/ia/health': 'Verificar status da IA',
      },
      example: {
        method: 'POST',
        url: '/api/ia',
        body: {
          message: 'Quero aumentar meu faturamento',
          establishmentId: 'uuid-do-estabelecimento',
        },
      },
    });
  }
}

module.exports = AgentController;
