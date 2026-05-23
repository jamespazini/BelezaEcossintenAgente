/**
 * WhatsApp API Routes (Owner/Admin)
 * Manages WhatsApp conversations and manual messaging
 */

'use strict';

const express = require('express');
const { authorize } = require('../../shared/middleware');
const { ROLES } = require('../../shared/constants');
const WhatsappController = require('../../controllers/whatsapp.controller');

const router = express.Router();

// All routes require OWNER or ADMIN roles
router.use(authorize([ROLES.OWNER, ROLES.ADMIN]));

router.get('/conversations', WhatsappController.getConversations.bind(WhatsappController));
router.get('/conversations/:sessionId/messages', WhatsappController.getMessages.bind(WhatsappController));
router.post('/send', WhatsappController.sendMessage.bind(WhatsappController));
router.get('/stats', WhatsappController.getStats.bind(WhatsappController));

module.exports = router;
