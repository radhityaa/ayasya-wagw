const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');
const { apiKeyAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(apiKeyAuth);

// Status routes
router.post('/:instanceId/text', statusController.sendTextStatus);
router.post('/:instanceId/image', statusController.sendImageStatus);
router.post('/:instanceId/voice', statusController.sendVoiceStatus);
router.post('/:instanceId/video', statusController.sendVideoStatus);
router.post('/:instanceId/delete', statusController.deleteStatus);
router.get('/:instanceId/new-message-id', statusController.generateNewMessageId);

module.exports = router;
