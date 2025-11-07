const whatsappService = require('../services/whatsappService');
const database = require('../config/database');

class MessageController {
  async sendText(req, res) {
    try {
      const { instanceId, to, message } = req.body;
      
      if (!instanceId || !to || !message) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, and message are required'
        });
      }
      
      const result = await whatsappService.sendMessage(instanceId, to, message);
      
      res.json({
        success: true,
        data: {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp
        },
        message: 'Message sent successfully'
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send message'
      });
    }
  }

  async sendMedia(req, res) {
    try {
      const { instanceId, to, type, media, caption, fileName, mimetype, ptt } = req.body;
      
      if (!instanceId || !to || !type || !media) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, type, and media are required'
        });
      }
      
      const validTypes = ['image', 'video', 'audio', 'document'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid media type. Must be one of: ${validTypes.join(', ')}`
        });
      }
      
      const result = await whatsappService.sendMessage(instanceId, to, caption || '', {
        type,
        media,
        fileName,
        mimetype,
        ptt
      });
      
      res.json({
        success: true,
        data: {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp
        },
        message: 'Media sent successfully'
      });
    } catch (error) {
      console.error('Error sending media:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send media'
      });
    }
  }

  async sendBulk(req, res) {
    try {
      const { instanceId, recipients, message, delay = 1000 } = req.body;
      
      if (!instanceId || !recipients || !Array.isArray(recipients) || !message) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, recipients (array), and message are required'
        });
      }
      
      const results = [];
      const failed = [];
      
      for (const recipient of recipients) {
        try {
          const result = await whatsappService.sendMessage(instanceId, recipient, message);
          results.push({
            to: recipient,
            success: true,
            messageId: result.key.id
          });
          
          // Add delay between messages to avoid rate limiting
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          failed.push({
            to: recipient,
            success: false,
            error: error.message
          });
        }
      }
      
      res.json({
        success: true,
        data: {
          sent: results,
          failed: failed,
          totalSent: results.length,
          totalFailed: failed.length
        },
        message: `Bulk message sent to ${results.length} recipients`
      });
    } catch (error) {
      console.error('Error sending bulk messages:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send bulk messages'
      });
    }
  }

  async getChats(req, res) {
    try {
      const { instanceId } = req.params;
      const { limit = 50, offset = 0, archived = false } = req.query;
      
      const prisma = database.getInstance();
      
      const chats = await prisma.chat.findMany({
        where: {
          instanceId,
          archived: archived === 'true'
        },
        include: {
          _count: {
            select: {
              messages: true
            }
          }
        },
        orderBy: {
          lastMessageAt: 'desc'
        },
        take: parseInt(limit),
        skip: parseInt(offset)
      });
      
      res.json({
        success: true,
        data: chats,
        count: chats.length,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      console.error('Error getting chats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get chats'
      });
    }
  }

  async getChatMessages(req, res) {
    try {
      const { instanceId, chatId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      
      const prisma = database.getInstance();
      
      // First, find the chat
      const chat = await prisma.chat.findFirst({
        where: {
          instanceId,
          chatId
        }
      });
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          error: 'Chat not found'
        });
      }
      
      const messages = await prisma.message.findMany({
        where: {
          instanceId,
          chatId: chat.id
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: parseInt(limit),
        skip: parseInt(offset)
      });
      
      res.json({
        success: true,
        data: messages,
        count: messages.length,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      console.error('Error getting chat messages:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get messages'
      });
    }
  }

  async getAllMessages(req, res) {
    try {
      const { instanceId } = req.params;
      const { limit = 100, offset = 0, fromMe, type, status } = req.query;
      
      const prisma = database.getInstance();
      
      const where = { instanceId };
      
      if (fromMe !== undefined) {
        where.fromMe = fromMe === 'true';
      }
      
      if (type) {
        where.type = type;
      }
      
      if (status) {
        where.status = status;
      }
      
      const messages = await prisma.message.findMany({
        where,
        include: {
          chat: {
            select: {
              chatId: true,
              name: true,
              isGroup: true
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: parseInt(limit),
        skip: parseInt(offset)
      });
      
      const total = await prisma.message.count({ where });
      
      res.json({
        success: true,
        data: messages,
        count: messages.length,
        total,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + messages.length < total
        }
      });
    } catch (error) {
      console.error('Error getting all messages:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get messages'
      });
    }
  }

  async deleteMessage(req, res) {
    try {
      const { instanceId, messageId } = req.params;
      
      const prisma = database.getInstance();
      
      await prisma.message.delete({
        where: {
          id: messageId,
          instanceId
        }
      });
      
      res.json({
        success: true,
        message: 'Message deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete message'
      });
    }
  }

  async markAsRead(req, res) {
    try {
      const { instanceId, chatId } = req.params;
      
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }
      
      const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
      
      await instance.socket.readMessages([jid]);
      
      // Update unread count in database
      const prisma = database.getInstance();
      await prisma.chat.updateMany({
        where: {
          instanceId,
          chatId
        },
        data: {
          unreadCount: 0
        }
      });
      
      res.json({
        success: true,
        message: 'Messages marked as read'
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to mark messages as read'
      });
    }
  }

  async typing(req, res) {
    try {
      const { instanceId, to, duration = 3000 } = req.body;
      
      if (!instanceId || !to) {
        return res.status(400).json({
          success: false,
          error: 'instanceId and to are required'
        });
      }
      
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }
      
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      
      await instance.socket.sendPresenceUpdate('composing', jid);
      
      // Stop typing after duration
      setTimeout(async () => {
        await instance.socket.sendPresenceUpdate('paused', jid);
      }, duration);
      
      res.json({
        success: true,
        message: 'Typing indicator sent'
      });
    } catch (error) {
      console.error('Error sending typing indicator:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send typing indicator'
      });
    }
  }

  async presence(req, res) {
    try {
      const { instanceId, presence } = req.body;
      
      if (!instanceId || !presence) {
        return res.status(400).json({
          success: false,
          error: 'instanceId and presence are required'
        });
      }
      
      const validPresences = ['available', 'unavailable', 'composing', 'recording', 'paused'];
      if (!validPresences.includes(presence)) {
        return res.status(400).json({
          success: false,
          error: `Invalid presence. Must be one of: ${validPresences.join(', ')}`
        });
      }
      
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }
      
      await instance.socket.sendPresenceUpdate(presence);
      
      res.json({
        success: true,
        message: `Presence updated to ${presence}`
      });
    } catch (error) {
      console.error('Error updating presence:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update presence'
      });
    }
  }
}

module.exports = new MessageController();
