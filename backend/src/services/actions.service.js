/**
 * Actions Service - Executa ações reais do sistema
 * Integra com modelos do Sequelize
 */

const { Appointment, Client, Service, MarketingCampaign, FinancialEntry } = require('../models');
const { Op, fn, col, where: seqWhere } = require('sequelize');
const logger = require('../utils/logger');

class ActionsService {
  /**
   * Criar agendamento
   * @param {Object} params - { clientId, dataHora, servicoId, profissionalId, estabelecimentoId, tenantId }
   * @returns {Object} Agendamento criado
   */
  async createAppointment(params) {
    try {
      const {
        clientId,
        dataHora,
        servicoId,
        profissionalId,
        estabelecimentoId,
        tenantId,
      } = params;

      if (!clientId || !dataHora || !servicoId || !profissionalId || !estabelecimentoId) {
        throw new Error('Parâmetros obrigatórios faltando: clientId, dataHora, servicoId, profissionalId, estabelecimentoId');
      }

      const client = await Client.findByPk(clientId);
      if (!client) {
        throw new Error('Cliente não encontrado');
      }

      const service = await Service.findByPk(servicoId);
      if (!service) {
        throw new Error('Serviço não encontrado');
      }

      const startTime = new Date(dataHora);
      if (Number.isNaN(startTime.getTime())) {
        throw new Error('Formato de dataHora inválido');
      }

      const durationMinutes = parseInt(service.duration_minutes, 10) || 60;
      const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

      const appointment = await Appointment.create({
        establishment_id: estabelecimentoId,
        tenant_id: tenantId || null,
        client_id: clientId,
        professional_id: profissionalId,
        service_id: servicoId,
        start_time: startTime,
        end_time: endTime,
        status: 'CONFIRMED',
        notes: 'Criado pelo agente IA',
        price_charged: service.price || 0,
      });

      logger.info(`[ACTIONS] Agendamento criado: ${appointment.id}`);

      const fullAppointment = await Appointment.findByPk(appointment.id, {
        include: ['client', 'service', 'professional']
      });

      return {
        success: true,
        data: fullAppointment,
        message: `Agendamento criado com sucesso para ${client.first_name} ${client.last_name || ''}`.trim(),
      };
    } catch (error) {
      logger.error('[ACTIONS] Erro ao criar agendamento:', error);
      throw error;
    }
  }

  /**
   * Atualizar agendamento
   * @param {Object} params - { agendamentoId, dataHora, status }
   * @returns {Object} Agendamento atualizado
   */
  async updateAppointment(params) {
    try {
      const { agendamentoId, dataHora, status } = params;

      if (!agendamentoId) {
        throw new Error('ID do agendamento é obrigatório');
      }

      const appointment = await Appointment.findByPk(agendamentoId, {
        include: ['service'],
      });
      if (!appointment) {
        throw new Error('Agendamento não encontrado');
      }

      if (dataHora) {
        const startTime = new Date(dataHora);
        if (Number.isNaN(startTime.getTime())) {
          throw new Error('Formato de dataHora inválido');
        }
        appointment.start_time = startTime;

        const durationMinutes = parseInt(appointment.service?.duration_minutes, 10) || 60;
        appointment.end_time = new Date(startTime.getTime() + durationMinutes * 60000);
      }

      if (status) {
        appointment.status = status;
      }

      await appointment.save();

      logger.info(`[ACTIONS] Agendamento atualizado: ${agendamentoId}`);

      return {
        success: true,
        data: appointment,
        message: 'Agendamento atualizado com sucesso',
      };
    } catch (error) {
      logger.error('[ACTIONS] Erro ao atualizar agendamento:', error);
      throw error;
    }
  }

  /**
   * Listar agendamentos
   * @param {Object} params - { dataInicio, dataFim, status, estabelecimentoId }
   * @returns {Array} Agendamentos encontrados
   */
  async listAppointments(params) {
    try {
      const { dataInicio, dataFim, status, estabelecimentoId } = params;

      const where = {};
      if (status) where.status = status;
      if (estabelecimentoId) where.establishment_id = estabelecimentoId;

      if (dataInicio && dataFim) {
        where.start_time = {
          [Op.between]: [new Date(dataInicio), new Date(dataFim)],
        };
      }

      const appointments = await Appointment.findAll({
        where,
        include: ['client', 'service'],
        order: [['start_time', 'DESC']],
      });

      logger.info(`[ACTIONS] ${appointments.length} agendamentos encontrados`);

      return {
        success: true,
        data: appointments,
        count: appointments.length,
      };
    } catch (error) {
      logger.error('[ACTIONS] Erro ao listar agendamentos:', error);
      throw error;
    }
  }

  /**
   * Salvar anúncio/campanha
   * @param {Object} params - { titulo, descricao, cta, tipo, estabelecimentoId, tenantId, createdBy }
   * @returns {Object} Anúncio criado
   */
  async saveAnnouncement(params) {
    try {
      const { titulo, descricao, cta, tipo, estabelecimentoId, tenantId, createdBy } = params;

      if (!titulo || !descricao || !tenantId) {
        throw new Error('Parâmetros obrigatórios faltando: titulo, descricao, tenantId');
      }

      const campaign = await MarketingCampaign.create({
        tenant_id: tenantId,
        name: titulo,
        channel: 'whatsapp',
        status: 'draft',
        message_template: `${descricao}${cta ? `\nCTA: ${cta}` : ''}`,
        audience_segment: 'all',
        created_by: createdBy || null,
      });

      logger.info(`[ACTIONS] Anúncio criado: ${campaign.id}`);

      return {
        success: true,
        data: campaign,
        message: `Anúncio "${titulo}" criado com sucesso`,
      };
    } catch (error) {
      logger.error('[ACTIONS] Erro ao salvar anúncio:', error);
      throw error;
    }
  }

  /**
   * Gerar relatório
   * @param {Object} params - { tipo, periodo, estabelecimentoId }
   * @returns {Object} Relatório gerado
   */
  async generateReport(params) {
    try {
      const { tipo, periodo = '30', estabelecimentoId } = params;

      if (!estabelecimentoId) {
        throw new Error('ID do estabelecimento é obrigatório');
      }

      const diasAtras = parseInt(periodo, 10);
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - diasAtras);

      const appointments = await Appointment.count({
        where: {
          establishment_id: estabelecimentoId,
          createdAt: {
            [Op.gte]: dataInicio,
          },
        },
      });

      const revenue = (await FinancialEntry.sum('amount', {
        where: {
          establishment_id: estabelecimentoId,
          createdAt: {
            [Op.gte]: dataInicio,
          },
        },
      })) || 0;

      const clients = await Client.count({
        where: {
          establishment_id: estabelecimentoId,
          createdAt: {
            [Op.gte]: dataInicio,
          },
        },
      });

      const report = {
        tipo,
        periodo: `${diasAtras} dias`,
        dataInicio,
        dataFim: new Date(),
        agendamentos: appointments,
        receita: parseFloat(revenue),
        clientesNovos: clients,
        ticketMedio: appointments > 0 ? parseFloat((revenue / appointments).toFixed(2)) : 0,
      };

      logger.info(`[ACTIONS] Relatório gerado: ${tipo}`);

      return {
        success: true,
        data: report,
        message: `Relatório de ${tipo} gerado com sucesso`,
      };
    } catch (error) {
      logger.error('[ACTIONS] Erro ao gerar relatório:', error);
      throw error;
    }
  }

  /**
   * Consultar clientes
   * @param {Object} params - { filtro, limite, estabelecimentoId }
   * @returns {Array} Clientes encontrados
   */
  async consultClients(params) {
    try {
      const { filtro, limite = 10, estabelecimentoId } = params;

      const where = {
        establishment_id: estabelecimentoId,
      };

      if (filtro) {
        const normalizedFilter = `%${filtro.toLowerCase()}%`;
        where[Op.or] = [
          seqWhere(fn('LOWER', col('first_name')), 'LIKE', normalizedFilter),
          seqWhere(fn('LOWER', col('last_name')), 'LIKE', normalizedFilter),
          seqWhere(fn('LOWER', col('email')), 'LIKE', normalizedFilter),
          { phone: { [Op.iLike]: `%${filtro}%` } },
        ];
      }

      const clients = await Client.findAll({
        where,
        limit: parseInt(limite, 10),
        order: [['created_at', 'DESC']],
      });

      logger.info(`[ACTIONS] ${clients.length} clientes encontrados`);

      return {
        success: true,
        data: clients,
        count: clients.length,
      };
    } catch (error) {
      logger.error('[ACTIONS] Erro ao consultar clientes:', error);
      throw error;
    }
  }

  /**
   * Enviar WhatsApp (mock por enquanto)
   * @param {Object} params - { telefone, mensagem }
   * @returns {Object} Resultado
   */
  async sendWhatsApp(params) {
    try {
      const { telefone, mensagem } = params;

      if (!telefone || !mensagem) {
        throw new Error('Telefone e mensagem são obrigatórios');
      }

      logger.info(`[ACTIONS] WhatsApp seria enviado para ${telefone}`);

      return {
        success: true,
        data: {
          telefone,
          mensagem,
          status: 'pending',
          id: `wa_${Date.now()}`,
        },
        message: `Mensagem agendada para ser enviada para ${telefone}`,
      };
    } catch (error) {
      logger.error('[ACTIONS] Erro ao enviar WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Analisar desempenho
   * @param {Object} params - { dataInicio, dataFim, estabelecimentoId }
   * @returns {Object} Análise de desempenho
   */
  async analyzePerformance(params) {
    try {
      const { dataInicio, dataFim, estabelecimentoId } = params;

      const where = {
        establishment_id: estabelecimentoId,
      };

      if (dataInicio && dataFim) {
        where.start_time = {
          [Op.between]: [new Date(dataInicio), new Date(dataFim)],
        };
      }

      const appointments = await Appointment.findAll({
        where,
        include: ['service'],
      });

      const totalAppointments = appointments.length;
      const totalRevenue = appointments.reduce((acc, apt) => acc + parseFloat(apt.service?.price || 0), 0);

      const servicePerformance = {};
      appointments.forEach((apt) => {
        const serviceName = apt.service?.name || 'Desconhecido';
        if (!servicePerformance[serviceName]) {
          servicePerformance[serviceName] = { count: 0, revenue: 0 };
        }
        servicePerformance[serviceName].count += 1;
        servicePerformance[serviceName].revenue += parseFloat(apt.service?.price || 0);
      });

      const analysis = {
        periodo: `${dataInicio || 'início'} a ${dataFim || 'agora'}`,
        totalAgendamentos: totalAppointments,
        receita: totalRevenue,
        ticketMedio: totalAppointments > 0 ? parseFloat((totalRevenue / totalAppointments).toFixed(2)) : 0,
        servicosMaisVendidos: Object.entries(servicePerformance)
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .slice(0, 5)
          .map(([nome, dados]) => ({
            servico: nome,
            agendamentos: dados.count,
            receita: dados.revenue,
          })),
      };

      logger.info('[ACTIONS] Análise de desempenho gerada');

      return {
        success: true,
        data: analysis,
        message: 'Análise de desempenho gerada com sucesso',
      };
    } catch (error) {
      logger.error('[ACTIONS] Erro ao analisar desempenho:', error);
      throw error;
    }
  }
}

module.exports = new ActionsService();
