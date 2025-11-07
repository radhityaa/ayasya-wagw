const express = require('express');
const router = express.Router();
const presenceController = require('../controllers/presenceController');
const { apiKeyAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(apiKeyAuth);

// Presence routes
router.post('/:instanceId', presenceController.setPresence);
router.get('/:instanceId', presenceController.getAllPresence);
router.get('/:instanceId/:chatId', presenceController.getPresence);
router.post('/:instanceId/:chatId/subscribe', presenceController.subscribePresence);

module.exports = router;
