const whatsappService = require('../services/whatsappService');

class EventController {
  // Send event message
  async sendEvent(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { 
        to, 
        name, 
        description, 
        location, 
        startTime, 
        endTime,
        callLink 
      } = req.body;
      
      // Validate required fields
      if (!to) {
        return res.status(400).json({
          success: false,
          error: 'Recipient phone number (to) is required'
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Event name is required'
        });
      }

      if (!startTime) {
        return res.status(400).json({
          success: false,
          error: 'Event start time is required'
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
      
      // Format recipient
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      
      // Parse timestamps
      const startTimestamp = new Date(startTime).getTime() / 1000;
      const endTimestamp = endTime ? new Date(endTime).getTime() / 1000 : startTimestamp + 3600; // Default 1 hour duration
      
      // Create event message
      const eventMessage = {
        eventMessage: {
          name: name,
          description: description || '',
          location: location ? {
            name: location.name || '',
            address: location.address || '',
            latitude: location.latitude || 0,
            longitude: location.longitude || 0
          } : undefined,
          startTime: startTimestamp,
          endTime: endTimestamp,
          callLink: callLink || undefined
        }
      };
      
      // Send event message
      const result = await socket.sendMessage(jid, eventMessage);
      
      res.json({
        success: true,
        message: 'Event message sent successfully',
        data: result
      });
    } catch (error) {
      console.error('Error sending event message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send event message',
        details: error.message
      });
    }
  }
}

module.exports = new EventController();
