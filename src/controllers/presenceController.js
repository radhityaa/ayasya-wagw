const whatsappService = require('../services/whatsappService');

class PresenceController {
  // Set session presence
  async setPresence(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { presence } = req.body;
      
      if (!presence) {
        return res.status(400).json({
          success: false,
          error: 'Presence is required (available, unavailable, composing, recording, paused)'
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

      const { socket } = instance;
      
      // Set presence
      await socket.sendPresenceUpdate(presence);
      
      res.json({
        success: true,
        message: 'Presence updated successfully',
        data: {
          presence: presence
        }
      });
    } catch (error) {
      console.error('Error setting presence:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to set presence',
        details: error.message
      });
    }
  }

  // Get all subscribed presence information
  async getAllPresence(req, res, next) {
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
      
      // Get all presence subscriptions from store
      const presences = socket.store?.presences || {};
      
      res.json({
        success: true,
        data: presences,
        count: Object.keys(presences).length
      });
    } catch (error) {
      console.error('Error getting all presence:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get all presence',
        details: error.message
      });
    }
  }

  // Get presence for specific chat ID
  async getPresence(req, res, next) {
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
      
      // Check if already subscribed
      let presence = socket.store?.presences?.[jid];
      
      // If not subscribed, subscribe to it
      if (!presence) {
        await socket.presenceSubscribe(jid);
        
        // Wait a bit for the presence update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the presence again
        presence = socket.store?.presences?.[jid];
      }
      
      res.json({
        success: true,
        data: {
          chatId: jid,
          presence: presence || null
        }
      });
    } catch (error) {
      console.error('Error getting presence:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get presence',
        details: error.message
      });
    }
  }

  // Subscribe to presence events for chat
  async subscribePresence(req, res, next) {
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
      
      // Subscribe to presence
      await socket.presenceSubscribe(jid);
      
      res.json({
        success: true,
        message: 'Subscribed to presence successfully',
        data: {
          chatId: jid
        }
      });
    } catch (error) {
      console.error('Error subscribing to presence:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to subscribe to presence',
        details: error.message
      });
    }
  }
}

module.exports = new PresenceController();
