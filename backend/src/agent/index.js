/**
 * Agent Module Exports
 * Core exports for the Intelligent Agent
 */

const agentService = require('./agent.service');
const { parseActions, isValidAction, getActionHandler } = require('./actionParser');
const { PROMPT_BASE } = require('./prompt');

module.exports = {
  agentService,
  parseActions,
  isValidAction,
  getActionHandler,
  PROMPT_BASE
};
