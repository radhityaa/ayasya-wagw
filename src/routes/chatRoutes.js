const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authController = require('../controllers/authController');

// Apply authentication middleware to all routes
router.use(authController.validateApiKey);

// Chat management routes
router.get('/:instanceId', chatController.getChats);
router.get('/:instanceId/overview', chatController.getChatsOverview);
router.delete('/:instanceId/:chatId', chatController.deleteChat);
router.get('/:instanceId/:chatId/picture', chatController.getChatPicture);
router.get('/:instanceId/:chatId/messages', chatController.getMessagesInChat);
router.delete('/:instanceId/:chatId/messages', chatController.clearAllMessages);
router.post('/:instanceId/:chatId/read', chatController.readUnreadMessages);
router.get('/:instanceId/:chatId/messages/:messageId', chatController.getMessageById);
router.delete('/:instanceId/:chatId/messages/:messageId', chatController.deleteMessage);
router.put('/:instanceId/:chatId/messages/:messageId', chatController.editMessage);
router.post('/:instanceId/:chatId/messages/:messageId/pin', chatController.pinMessage);
router.post('/:instanceId/:chatId/messages/:messageId/unpin', chatController.unpinMessage);
router.post('/:instanceId/:chatId/archive', chatController.archiveChat);
router.post('/:instanceId/:chatId/unarchive', chatController.unarchiveChat);
router.post('/:instanceId/:chatId/unread', chatController.unreadChat);

module.exports = router;
