const whatsappService = require('../services/whatsappService');
const database = require('../config/database');

class ChannelController {
  // Get list of known channels/newsletters
  async getChannels(req, res, next) {
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
      
      // Get newsletter/channel subscriptions
      // Note: Baileys supports newsletter functionality
      const newsletters = await socket.getSubscribedNewsletters();
      
      res.json({
        success: true,
        data: newsletters || [],
        count: newsletters?.length || 0
      });
    } catch (error) {
      console.error('Error getting channels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get channels',
        details: error.message
      });
    }
  }

  // Get channel info
  async getChannelInfo(req, res, next) {
    try {
      const { instanceId, channelId } = req.params;
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      
      // Get newsletter metadata
      const channelJid = channelId.includes('@') ? channelId : `${channelId}@newsletter`;
      const metadata = await socket.getNewsletterInfo(channelJid);
      
      res.json({
        success: true,
        data: metadata
      });
    } catch (error) {
      console.error('Error getting channel info:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get channel info',
        details: error.message
      });
    }
  }

  // Follow a channel
  async followChannel(req, res, next) {
    try {
      const { instanceId, channelId } = req.params;
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      const channelJid = channelId.includes('@') ? channelId : `${channelId}@newsletter`;
      
      // Follow newsletter
      await socket.subscribeNewsletters([channelJid]);
      
      res.json({
        success: true,
        message: 'Successfully followed channel',
        channelId: channelJid
      });
    } catch (error) {
      console.error('Error following channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to follow channel',
        details: error.message
      });
    }
  }

  // Unfollow a channel
  async unfollowChannel(req, res, next) {
    try {
      const { instanceId, channelId } = req.params;
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      const channelJid = channelId.includes('@') ? channelId : `${channelId}@newsletter`;
      
      // Unfollow newsletter
      await socket.unsubscribeNewsletters([channelJid]);
      
      res.json({
        success: true,
        message: 'Successfully unfollowed channel',
        channelId: channelJid
      });
    } catch (error) {
      console.error('Error unfollowing channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unfollow channel',
        details: error.message
      });
    }
  }

  // Mute a channel
  async muteChannel(req, res, next) {
    try {
      const { instanceId, channelId } = req.params;
      const { duration = 8 * 60 * 60 } = req.body; // Default 8 hours in seconds
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      const channelJid = channelId.includes('@') ? channelId : `${channelId}@newsletter`;
      
      // Mute newsletter
      await socket.muteNewsletter(channelJid, duration);
      
      res.json({
        success: true,
        message: 'Successfully muted channel',
        channelId: channelJid,
        duration: duration
      });
    } catch (error) {
      console.error('Error muting channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mute channel',
        details: error.message
      });
    }
  }

  // Unmute a channel
  async unmuteChannel(req, res, next) {
    try {
      const { instanceId, channelId } = req.params;
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      const channelJid = channelId.includes('@') ? channelId : `${channelId}@newsletter`;
      
      // Unmute newsletter (set duration to null or 0)
      await socket.muteNewsletter(channelJid, null);
      
      res.json({
        success: true,
        message: 'Successfully unmuted channel',
        channelId: channelJid
      });
    } catch (error) {
      console.error('Error unmuting channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unmute channel',
        details: error.message
      });
    }
  }

  // Create a new channel (Newsletter)
  async createChannel(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { name, description, picture } = req.body;
      
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Channel name is required'
        });
      }

      const { socket } = instance;
      
      // Create newsletter channel
      const newsletterData = {
        name,
        description: description || '',
      };

      if (picture) {
        newsletterData.picture = picture;
      }

      const result = await socket.createNewsletter(newsletterData);
      
      res.json({
        success: true,
        message: 'Channel created successfully',
        data: result
      });
    } catch (error) {
      console.error('Error creating channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create channel',
        details: error.message
      });
    }
  }

  // Delete a channel
  async deleteChannel(req, res, next) {
    try {
      const { instanceId, channelId } = req.params;
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      // Note: Baileys doesn't have a direct method to delete newsletters
      // This would typically require admin privileges
      res.status(501).json({
        success: false,
        error: 'Channel deletion is not supported',
        details: 'WhatsApp Web API does not support deleting channels/newsletters'
      });
    } catch (error) {
      console.error('Error deleting channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete channel',
        details: error.message
      });
    }
  }

  // Get channel messages preview
  async getChannelMessagesPreview(req, res, next) {
    try {
      const { instanceId, channelId } = req.params;
      const { limit = 20 } = req.query;
      
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      const channelJid = channelId.includes('@') ? channelId : `${channelId}@newsletter`;
      
      // Get newsletter messages
      const messages = await socket.getNewsletterMessages(channelJid, limit);
      
      res.json({
        success: true,
        data: messages || [],
        count: messages?.length || 0
      });
    } catch (error) {
      console.error('Error getting channel messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get channel messages',
        details: error.message
      });
    }
  }

  // Search channels by text
  async searchChannelsByText(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { query, limit = 20 } = req.body;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      // Note: Baileys doesn't have built-in channel search
      // This would require WhatsApp Business API or custom implementation
      res.status(501).json({
        success: false,
        error: 'Channel search is not supported',
        details: 'WhatsApp Web API does not support searching for channels'
      });
    } catch (error) {
      console.error('Error searching channels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search channels',
        details: error.message
      });
    }
  }

  // Search channels by view count
  async searchChannelsByView(req, res, next) {
    try {
      // Note: This feature is not available in WhatsApp Web API
      res.status(501).json({
        success: false,
        error: 'Search by view count is not supported',
        details: 'WhatsApp Web API does not support searching channels by view count'
      });
    } catch (error) {
      console.error('Error searching channels by view:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search channels',
        details: error.message
      });
    }
  }

  // Get search views list
  async getSearchViews(req, res, next) {
    try {
      // Note: This feature is not available in WhatsApp Web API
      res.status(501).json({
        success: false,
        error: 'Search views list is not supported',
        details: 'WhatsApp Web API does not support getting search view categories'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get search views',
        details: error.message
      });
    }
  }

  // Get search countries list
  async getSearchCountries(req, res, next) {
    try {
      // Note: This feature is not available in WhatsApp Web API
      res.status(501).json({
        success: false,
        error: 'Search countries list is not supported',
        details: 'WhatsApp Web API does not support getting search countries'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get search countries',
        details: error.message
      });
    }
  }

  // Get search categories list
  async getSearchCategories(req, res, next) {
    try {
      // Note: This feature is not available in WhatsApp Web API
      res.status(501).json({
        success: false,
        error: 'Search categories list is not supported',
        details: 'WhatsApp Web API does not support getting search categories'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get search categories',
        details: error.message
      });
    }
  }
}

module.exports = new ChannelController();
