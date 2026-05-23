/**
 * Agent Routes - Rotas da API do Agente IA
 * Base: /api/ia
 */

const express = require('express');
const AgentController = require('../controllers/agent.controller');
const { authenticate, ensureTenantMember } = require('../shared/middleware/auth');

const router = express.Router();

/**
 * GET /api/ia
 * Informações sobre o agente
 */
router.get('/', AgentController.getInfo);

/**
 * POST /api/ia
 * Enviar mensagem para o agente
 * Body: { message, establishmentId }
 */
router.post('/', authenticate, ensureTenantMember, AgentController.processMessage);

/**
 * GET /api/ia/health
 * Verificar status da IA
 */
router.get('/health', AgentController.health);

module.exports = router;
