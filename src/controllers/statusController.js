const whatsappService = require('../services/whatsappService');
const { generateMessageID } = require('baileys');

class StatusController {
  // Send text status
  async sendTextStatus(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { text, backgroundColor, font } = req.body;
      
      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Text is required'
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
      
      // Send text status to status@broadcast
      const result = await socket.sendMessage('status@broadcast', {
        text: text,
        backgroundColor: backgroundColor || '#000000',
        font: font || 0
      });
      
      res.json({
        success: true,
        message: 'Text status sent successfully',
        data: result
      });
    } catch (error) {
      console.error('Error sending text status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send text status',
        details: error.message
      });
    }
  }

  // Send image status
  async sendImageStatus(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { imageUrl, caption } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          error: 'Image URL is required'
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
      
      // Send image status to status@broadcast
      const result = await socket.sendMessage('status@broadcast', {
        image: { url: imageUrl },
        caption: caption || ''
      });
      
      res.json({
        success: true,
        message: 'Image status sent successfully',
        data: result
      });
    } catch (error) {
      console.error('Error sending image status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send image status',
        details: error.message
      });
    }
  }

  // Send voice status
  async sendVoiceStatus(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { audioUrl } = req.body;
      
      if (!audioUrl) {
        return res.status(400).json({
          success: false,
          error: 'Audio URL is required'
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
      
      // Send voice status to status@broadcast
      const result = await socket.sendMessage('status@broadcast', {
        audio: { url: audioUrl },
        ptt: true,
        mimetype: 'audio/ogg; codecs=opus'
      });
      
      res.json({
        success: true,
        message: 'Voice status sent successfully',
        data: result
      });
    } catch (error) {
      console.error('Error sending voice status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send voice status',
        details: error.message
      });
    }
  }

  // Send video status
  async sendVideoStatus(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { videoUrl, caption } = req.body;
      
      if (!videoUrl) {
        return res.status(400).json({
          success: false,
          error: 'Video URL is required'
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
      
      // Send video status to status@broadcast
      const result = await socket.sendMessage('status@broadcast', {
        video: { url: videoUrl },
        caption: caption || ''
      });
      
      res.json({
        success: true,
        message: 'Video status sent successfully',
        data: result
      });
    } catch (error) {
      console.error('Error sending video status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send video status',
        details: error.message
      });
    }
  }

  // Delete status
  async deleteStatus(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { messageId } = req.body;
      
      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: 'Message ID is required'
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
      
      // Delete status message
      await socket.sendMessage('status@broadcast', {
        delete: {
          remoteJid: 'status@broadcast',
          fromMe: true,
          id: messageId
        }
      });
      
      res.json({
        success: true,
        message: 'Status deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete status',
        details: error.message
      });
    }
  }

  // Generate new message ID
  async generateNewMessageId(req, res, next) {
    try {
      const { instanceId } = req.params;
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      // Generate unique message ID
      const messageId = generateMessageID();
      
      res.json({
        success: true,
        data: {
          messageId: messageId
        }
      });
    } catch (error) {
      console.error('Error generating message ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate message ID',
        details: error.message
      });
    }
  }
}

module.exports = new StatusController();
