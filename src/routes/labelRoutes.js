const express = require('express');
const router = express.Router();
const labelController = require('../controllers/labelController');
const { apiKeyAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(apiKeyAuth);

// Label routes (WhatsApp Business only)
router.get('/:instanceId', labelController.getAllLabels);
router.post('/:instanceId', labelController.createLabel);
router.put('/:instanceId/:labelId', labelController.updateLabel);
router.delete('/:instanceId/:labelId', labelController.deleteLabel);

// Chat label routes
router.get('/:instanceId/chats/:chatId', labelController.getChatLabels);
router.put('/:instanceId/chats/:chatId', labelController.saveChatLabels);

// Get chats by label
router.get('/:instanceId/:labelId/chats', labelController.getChatsByLabel);

module.exports = router;
