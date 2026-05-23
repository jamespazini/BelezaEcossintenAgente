/**
 * Actions Service - Executa ações reais do sistema
 * Integra com modelos do Sequelize
 */

const { Appointment, Client, Service, MarketingCampaign, FinancialEntry } = require('../models');
const { Op, fn, col, where: seqWhere } = require('sequelize');
const logger = require('../utils/logger');
const WhatsAppService = require('./whatsapp.service');
const { v4: uuidv4 } = require('uuid');

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
   * Enviar WhatsApp - Integração REAL com Twilio via WhatsAppService
   * @param {Object} params - { telefone, mensagem, tenantId, estabelecimentoId }
   * @returns {Object} Resultado com job ID real
   * 
   * Fluxo:
   * 1. Validar parâmetros obrigatórios
   * 2. Validar tenantId (multi-tenant)
   * 3. Normalizar e validar E.164 do telefone
   * 4. Criar MessageLog para auditoria
   * 5. Enfileirar via BullMQ + WhatsAppService
   * 6. Retornar job ID real para rastreamento
   */
  async sendWhatsApp(params) {
    const correlationId = uuidv4();
    // traceId mantido como alias futuro (para tracing distribuído)
    const traceId = correlationId;

    


    
    try {
      const { telefone, mensagem, tenantId, estabelecimentoId } = params;

      // Validação de parâmetros obrigatórios
      if (!telefone || !mensagem || !tenantId) {
        throw new Error('Parâmetros obrigatórios faltando: telefone, mensagem, tenantId');
      }

      // Normalizar telefone: remover tudo que não é dígito e garantir E.164 para Brasil
      const phoneCleaned = String(telefone).replace(/\D/g, '');
      const normalizedPhone = this._normalizeWhatsappPhone(phoneCleaned);

      // Validar E.164: deve começar com código de país (2-3 dígitos) + código de área (2-3 dígitos) + número (7-8 dígitos)
      // Para Brasil: 55 + 11-99 + 99999-9999 = 10-13 dígitos totais
      if (!/^\d{10,13}$/.test(normalizedPhone)) {
        throw new Error(`Telefone inválido: ${this._maskPhone(telefone)}. Formato esperado: E.164 (ex: 5511999999999)`);
      }

      logger.info('[ACTIONS] Processando envio de WhatsApp', {

        correlationId,
        tenantId,
        phone: this._maskPhone(telefone),
        messageLength: String(mensagem).length,
        timestamp: new Date().toISOString(),
      });


      // Sanitização/Limites (LGPD + prevenção de prompt injection via payload malicioso)
      const sanitizedBody = String(mensagem)
        .replace(/[\u0000-\u001F\u007F]/g, '') // remove controles
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2000);


      // Sanitização de mensagem não deve alterar a validação do fluxo
      if (!sanitizedBody) {
        throw new Error('Mensagem inválida');
      }

      // Criar log de mensagem para auditoria
      const messageLog = await WhatsAppService.createMessageLog({
        tenant_id: tenantId,

        customer_id: null, // Agente não tem cliente específico
        session_id: null,  // Agente não tem sessão
        whatsapp_number: normalizedPhone,
        direction: 'OUTBOUND',
      body: sanitizedBody,
        status: 'queued',


        provider_message_id: null,
        event_type: 'agent_outbound',
        metadata: {
          source: 'agent',
          correlationId,
          mensagemTruncada: mensagem.substring(0, 100),
        },
      });

      // Enfileirar mensagem real via WhatsAppService
      // Isso valida subscription, quota, cria o job, etc.
      const job = await WhatsAppService.queueOutboundMessage({
        tenantId,
        to: normalizedPhone,
        whatsappNumber: normalizedPhone,
        body: sanitizedBody,

        sessionId: null,
        messageLogId: messageLog.id,
        eventType: 'agent_outbound',
        correlationId,
        metadata: {
          estabelecimentoId,
          source: 'agent',
        },
      });

      logger.info('[ACTIONS] WhatsApp enfileirado com sucesso', {
        correlationId,
        jobId: job.id,
        messageLogId: messageLog.id,
        phone: this._maskPhone(telefone),
        tenantId,
      });

      return {
        success: true,
        data: {
          jobId: job.id,
          messageLogId: messageLog.id,
          phone: this._maskPhone(telefone),
          status: 'queued',
          correlationId,
          message: `Mensagem enfileirada com sucesso. Job ID: ${job.id}`,
        },
        message: `Mensagem será enviada para ${this._maskPhone(telefone)} em breve`,
      };
    } catch (error) {
      logger.error('[ACTIONS] Erro ao enviar WhatsApp', {
        correlationId,
        phone: this._maskPhone(params?.telefone),
        tenantId: params?.tenantId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Mascarar telefone para logs (LGPD: nunca logar número completo)
   * Ex: 5511999999999 → 55119****9999
   * @param {string} phone - Telefone
   * @returns {string} Telefone mascarado
   */
  _maskPhone(phone) {
    if (!phone) return 'unknown';
    const cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length < 8) return '****';
    return `${cleaned.substring(0, 4)}****${cleaned.substring(cleaned.length - 4)}`;
  }

  _normalizeWhatsappPhone(phone) {
    if (!phone) return '';

    if (phone.startsWith('55')) {
      return phone;
    }

    if (/^\d{10,11}$/.test(phone)) {
      return `55${phone}`;
    }

    return phone;
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
