/**
 * Action Parser - Detecta e extrai ações do agente
 * Formato: [AÇÃO: nome_acao]\nParâmetros: {...}
 */

const ACTION_REGEX = /\[AÇÃO:\s*([^\]]+?)\]\s*(?:\r?\n)+\s*Parâmetros:\s*({[\s\S]*?})(?=(?:\r?\n\s*\[AÇÃO:|$))/g;

/**
 * Detecta ações na resposta do agente
 * @param {string} text - Texto da resposta
 * @returns {Array} Array de ações encontradas
 */
function parseActions(text) {
  const actions = [];
  let match;

  while ((match = ACTION_REGEX.exec(text)) !== null) {
    const actionName = match[1].trim();
    const paramsStr = match[2].trim();

    try {
      const params = JSON.parse(paramsStr);
      actions.push({
        name: actionName,
        params,
        rawText: match[0]
      });
    } catch (error) {
      console.error(`Erro ao fazer parse dos parâmetros da ação ${actionName}:`, error);
    }
  }

  return actions;
}

/**
 * Valida se ação é permitida
 * @param {string} actionName - Nome da ação
 * @returns {boolean}
 */
function isValidAction(actionName) {
  const validActions = [
    'criar_agendamento',
    'atualizar_agendamento',
    'listar_agendamentos',
    'salvar_anuncio',
    'gerar_relatorio',
    'consultar_clientes',
    'enviar_whatsapp',
    'analisar_desempenho'
  ];

  return validActions.includes(actionName);
}

/**
 * Processa ação e retorna função a executar
 * @param {string} actionName - Nome da ação
 * @returns {string} Nome da função a executar
 */
function getActionHandler(actionName) {
  const handlers = {
    'criar_agendamento': 'createAppointment',
    'atualizar_agendamento': 'updateAppointment',
    'listar_agendamentos': 'listAppointments',
    'salvar_anuncio': 'saveAnnouncement',
    'gerar_relatorio': 'generateReport',
    'consultar_clientes': 'consultClients',
    'enviar_whatsapp': 'sendWhatsApp',
    'analisar_desempenho': 'analyzePerformance'
  };

  return handlers[actionName] || null;
}

module.exports = {
  parseActions,
  isValidAction,
  getActionHandler,
  ACTION_REGEX
};
