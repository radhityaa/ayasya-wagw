const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authController = require('../controllers/authController');

// Apply authentication middleware to all routes
router.use(authController.validateApiKey);

// Message sending routes
router.post('/send/text', messageController.sendText);
router.post('/send/media', messageController.sendMedia);
router.post('/send/bulk', messageController.sendBulk);

// Message management routes
router.get('/chats/:instanceId', messageController.getChats);
router.get('/chat/:instanceId/:chatId', messageController.getChatMessages);
router.get('/all/:instanceId', messageController.getAllMessages);
router.delete('/:instanceId/:messageId', messageController.deleteMessage);

// Chat actions
router.post('/read/:instanceId/:chatId', messageController.markAsRead);
router.post('/typing', messageController.typing);
router.post('/presence', messageController.presence);

module.exports = router;
