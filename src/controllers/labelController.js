const whatsappService = require('../services/whatsappService');

/**
 * Label Controller
 * 
 * IMPORTANT: Labels are only available for WhatsApp Business accounts.
 * Regular WhatsApp accounts do not support label functionality.
 * 
 * Labels allow you to organize and categorize chats for better management.
 */
class LabelController {
  // Get all labels
  async getAllLabels(req, res, next) {
    try {
      const { instanceId } = req.params;
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      
      // Get all labels
      const labels = await socket.getLabels();
      
      res.json({
        success: true,
        data: labels || [],
        count: labels?.length || 0,
        note: 'Labels are only available for WhatsApp Business accounts'
      });
    } catch (error) {
      console.error('Error getting labels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get labels. Note: Labels are only available for WhatsApp Business accounts',
        details: error.message
      });
    }
  }

  // Create a new label
  async createLabel(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { name, color } = req.body;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Label name is required'
        });
      }

      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      
      // Create label
      const labelId = await socket.addLabel(name, color || 0);
      
      res.json({
        success: true,
        message: 'Label created successfully',
        data: {
          labelId: labelId,
          name: name,
          color: color || 0
        },
        note: 'Labels are only available for WhatsApp Business accounts'
      });
    } catch (error) {
      console.error('Error creating label:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create label. Note: Labels are only available for WhatsApp Business accounts',
        details: error.message
      });
    }
  }

  // Update a label
  async updateLabel(req, res, next) {
    try {
      const { instanceId, labelId } = req.params;
      const { name, color } = req.body;
      
      if (!name && color === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Label name or color is required'
        });
      }

      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      
      // Update label
      await socket.updateLabel(labelId, name, color);
      
      res.json({
        success: true,
        message: 'Label updated successfully',
        data: {
          labelId: labelId,
          name: name,
          color: color
        },
        note: 'Labels are only available for WhatsApp Business accounts'
      });
    } catch (error) {
      console.error('Error updating label:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update label. Note: Labels are only available for WhatsApp Business accounts',
        details: error.message
      });
    }
  }

  // Delete a label
  async deleteLabel(req, res, next) {
    try {
      const { instanceId, labelId } = req.params;
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      
      // Delete label
      await socket.removeLabel(labelId);
      
      res.json({
        success: true,
        message: 'Label deleted successfully',
        note: 'Labels are only available for WhatsApp Business accounts'
      });
    } catch (error) {
      console.error('Error deleting label:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete label. Note: Labels are only available for WhatsApp Business accounts',
        details: error.message
      });
    }
  }

  // Get labels for a chat
  async getChatLabels(req, res, next) {
    try {
      const { instanceId, chatId } = req.params;
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      
      // Format chat ID
      const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
      
      // Get chat labels
      const labels = await socket.getChatLabels(jid);
      
      res.json({
        success: true,
        data: {
          chatId: jid,
          labels: labels || []
        },
        note: 'Labels are only available for WhatsApp Business accounts'
      });
    } catch (error) {
      console.error('Error getting chat labels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get chat labels. Note: Labels are only available for WhatsApp Business accounts',
        details: error.message
      });
    }
  }

  // Save labels for a chat
  async saveChatLabels(req, res, next) {
    try {
      const { instanceId, chatId } = req.params;
      const { labelIds } = req.body;
      
      if (!Array.isArray(labelIds)) {
        return res.status(400).json({
          success: false,
          error: 'labelIds must be an array'
        });
      }

      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      
      // Format chat ID
      const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
      
      // Save chat labels
      await socket.setChatLabels(jid, labelIds);
      
      res.json({
        success: true,
        message: 'Chat labels saved successfully',
        data: {
          chatId: jid,
          labelIds: labelIds
        },
        note: 'Labels are only available for WhatsApp Business accounts'
      });
    } catch (error) {
      console.error('Error saving chat labels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save chat labels. Note: Labels are only available for WhatsApp Business accounts',
        details: error.message
      });
    }
  }

  // Get chats by label
  async getChatsByLabel(req, res, next) {
    try {
      const { instanceId, labelId } = req.params;
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      
      // Get chats by label
      const chats = await socket.getChatsByLabelId(labelId);
      
      res.json({
        success: true,
        data: {
          labelId: labelId,
          chats: chats || [],
          count: chats?.length || 0
        },
        note: 'Labels are only available for WhatsApp Business accounts'
      });
    } catch (error) {
      console.error('Error getting chats by label:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get chats by label. Note: Labels are only available for WhatsApp Business accounts',
        details: error.message
      });
    }
  }
}

module.exports = new LabelController();
