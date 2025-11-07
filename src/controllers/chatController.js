const whatsappService = require('../services/whatsappService');

class ChatController {
  async getChats(req, res) {
    try {
      const { instanceId } = req.params;

      const chats = await whatsappService.getChats(instanceId);

      res.json({
        success: true,
        data: chats,
        count: chats.length
      });
    } catch (error) {
      console.error('Error getting chats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get chats'
      });
    }
  }

  async getChatsOverview(req, res) {
    try {
      const { instanceId } = req.params;

      const chats = await whatsappService.getChatsOverview(instanceId);

      res.json({
        success: true,
        data: chats,
        count: chats.length
      });
    } catch (error) {
      console.error('Error getting chats overview:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get chats overview'
      });
    }
  }

  async deleteChat(req, res) {
    try {
      const { instanceId, chatId } = req.params;

      const result = await whatsappService.deleteChat(instanceId, chatId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error deleting chat:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete chat'
      });
    }
  }

  async getChatPicture(req, res) {
    try {
      const { instanceId, chatId } = req.params;

      const picture = await whatsappService.getChatPicture(instanceId, chatId);

      res.json({
        success: true,
        data: picture
      });
    } catch (error) {
      console.error('Error getting chat picture:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get chat picture'
      });
    }
  }

  async getMessagesInChat(req, res) {
    try {
      const { instanceId, chatId } = req.params;
      const { limit = 50 } = req.query;

      const messages = await whatsappService.getMessagesInChat(instanceId, chatId, parseInt(limit));

      res.json({
        success: true,
        data: messages,
        count: messages.length
      });
    } catch (error) {
      console.error('Error getting messages in chat:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get messages in chat'
      });
    }
  }

  async clearAllMessages(req, res) {
    try {
      const { instanceId, chatId } = req.params;

      const result = await whatsappService.clearAllMessages(instanceId, chatId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error clearing all messages:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to clear all messages'
      });
    }
  }

  async readUnreadMessages(req, res) {
    try {
      const { instanceId, chatId } = req.params;

      const result = await whatsappService.readUnreadMessages(instanceId, chatId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error reading unread messages:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to read unread messages'
      });
    }
  }

  async getMessageById(req, res) {
    try {
      const { instanceId, chatId, messageId } = req.params;

      const message = await whatsappService.getMessageById(instanceId, chatId, messageId);

      res.json({
        success: true,
        data: message
      });
    } catch (error) {
      console.error('Error getting message by ID:', error);
      res.status(404).json({
        success: false,
        error: error.message || 'Message not found'
      });
    }
  }

  async deleteMessage(req, res) {
    try {
      const { instanceId, chatId, messageId } = req.params;

      const result = await whatsappService.deleteMessage(instanceId, chatId, messageId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete message'
      });
    }
  }

  async editMessage(req, res) {
    try {
      const { instanceId, chatId, messageId } = req.params;
      const { newText } = req.body;

      if (!newText) {
        return res.status(400).json({
          success: false,
          error: 'New text is required'
        });
      }

      const result = await whatsappService.editMessage(instanceId, chatId, messageId, newText);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error editing message:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to edit message'
      });
    }
  }

  async pinMessage(req, res) {
    try {
      const { instanceId, chatId, messageId } = req.params;

      const result = await whatsappService.pinMessage(instanceId, chatId, messageId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error pinning message:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to pin message'
      });
    }
  }

  async unpinMessage(req, res) {
    try {
      const { instanceId, chatId, messageId } = req.params;

      const result = await whatsappService.unpinMessage(instanceId, chatId, messageId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error unpinning message:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to unpin message'
      });
    }
  }

  async archiveChat(req, res) {
    try {
      const { instanceId, chatId } = req.params;

      const result = await whatsappService.archiveChat(instanceId, chatId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error archiving chat:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to archive chat'
      });
    }
  }

  async unarchiveChat(req, res) {
    try {
      const { instanceId, chatId } = req.params;

      const result = await whatsappService.unarchiveChat(instanceId, chatId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error unarchiving chat:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to unarchive chat'
      });
    }
  }

  async unreadChat(req, res) {
    try {
      const { instanceId, chatId } = req.params;

      const result = await whatsappService.unreadChat(instanceId, chatId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error marking chat as unread:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to mark chat as unread'
      });
    }
  }
}

module.exports = new ChatController();
