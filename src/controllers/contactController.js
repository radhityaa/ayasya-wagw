const whatsappService = require('../services/whatsappService');

class ContactController {
  // Get all contacts
  async getAllContacts(req, res, next) {
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
      
      // Get all contacts from store
      const contacts = socket.store?.contacts || {};
      
      res.json({
        success: true,
        data: contacts,
        count: Object.keys(contacts).length
      });
    } catch (error) {
      console.error('Error getting all contacts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get all contacts',
        details: error.message
      });
    }
  }

  // Get contact basic info
  async getContactInfo(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { phoneNumber } = req.query;
      
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
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
      
      // Format phone number
      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      
      // Get contact info
      const contact = socket.store?.contacts?.[jid];
      
      if (!contact) {
        return res.status(404).json({
          success: false,
          error: 'Contact not found'
        });
      }
      
      res.json({
        success: true,
        data: contact
      });
    } catch (error) {
      console.error('Error getting contact info:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get contact info',
        details: error.message
      });
    }
  }

  // Check if phone number exists on WhatsApp
  async checkExists(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { phoneNumber } = req.query;
      
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
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
      
      // Format phone number
      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      
      // Check if number exists on WhatsApp
      const [result] = await socket.onWhatsApp(jid);
      
      res.json({
        success: true,
        data: {
          exists: result?.exists || false,
          jid: result?.jid || null
        }
      });
    } catch (error) {
      console.error('Error checking if contact exists:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check if contact exists',
        details: error.message
      });
    }
  }

  // Get contact profile picture
  async getProfilePicture(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { phoneNumber } = req.query;
      
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
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
      
      // Format phone number
      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      
      // Get profile picture URL
      const pictureUrl = await socket.profilePictureUrl(jid, 'image');
      
      res.json({
        success: true,
        data: {
          pictureUrl: pictureUrl || null
        }
      });
    } catch (error) {
      console.error('Error getting profile picture:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile picture',
        details: error.message
      });
    }
  }

  // Block contact
  async blockContact(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
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
      
      // Format phone number
      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      
      // Block contact
      await socket.updateBlockStatus(jid, 'block');
      
      res.json({
        success: true,
        message: 'Contact blocked successfully'
      });
    } catch (error) {
      console.error('Error blocking contact:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to block contact',
        details: error.message
      });
    }
  }

  // Unblock contact
  async unblockContact(req, res, next) {
    try {
      const { instanceId } = req.params;
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
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
      
      // Format phone number
      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      
      // Unblock contact
      await socket.updateBlockStatus(jid, 'unblock');
      
      res.json({
        success: true,
        message: 'Contact unblocked successfully'
      });
    } catch (error) {
      console.error('Error unblocking contact:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unblock contact',
        details: error.message
      });
    }
  }

  // Create or update contact
  async updateContact(req, res, next) {
    try {
      const { instanceId, chatId } = req.params;
      const { name, notify } = req.body;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Contact name is required'
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
      
      // Update contact in store
      if (!socket.store.contacts) {
        socket.store.contacts = {};
      }
      
      socket.store.contacts[jid] = {
        id: jid,
        name: name,
        notify: notify || name,
        verifiedName: undefined,
        imgUrl: undefined,
        status: undefined
      };
      
      res.json({
        success: true,
        message: 'Contact updated successfully',
        data: socket.store.contacts[jid]
      });
    } catch (error) {
      console.error('Error updating contact:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update contact',
        details: error.message
      });
    }
  }

  // Get all known LIDs
  async getAllLids(req, res, next) {
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
      
      // Get all LIDs from store
      const lids = socket.store?.lids || {};
      
      res.json({
        success: true,
        data: lids,
        count: Object.keys(lids).length
      });
    } catch (error) {
      console.error('Error getting all LIDs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get all LIDs',
        details: error.message
      });
    }
  }

  // Get LIDs count
  async getLidsCount(req, res, next) {
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
      
      // Get LIDs count
      const lids = socket.store?.lids || {};
      
      res.json({
        success: true,
        count: Object.keys(lids).length
      });
    } catch (error) {
      console.error('Error getting LIDs count:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get LIDs count',
        details: error.message
      });
    }
  }

  // Get phone number by LID
  async getPhoneNumberByLid(req, res, next) {
    try {
      const { instanceId, lid } = req.params;
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      
      // Get phone number from LID
      const phoneNumber = socket.store?.lids?.[lid];
      
      if (!phoneNumber) {
        return res.status(404).json({
          success: false,
          error: 'LID not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          lid: lid,
          phoneNumber: phoneNumber
        }
      });
    } catch (error) {
      console.error('Error getting phone number by LID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get phone number by LID',
        details: error.message
      });
    }
  }

  // Get LID by phone number
  async getLidByPhoneNumber(req, res, next) {
    try {
      const { instanceId, phoneNumber } = req.params;
      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      const { socket } = instance;
      
      // Format phone number
      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      
      // Find LID by phone number
      const lids = socket.store?.lids || {};
      let foundLid = null;
      
      for (const [lid, pn] of Object.entries(lids)) {
        if (pn === jid) {
          foundLid = lid;
          break;
        }
      }
      
      if (!foundLid) {
        return res.status(404).json({
          success: false,
          error: 'LID not found for this phone number'
        });
      }
      
      res.json({
        success: true,
        data: {
          phoneNumber: jid,
          lid: foundLid
        }
      });
    } catch (error) {
      console.error('Error getting LID by phone number:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get LID by phone number',
        details: error.message
      });
    }
  }
}

module.exports = new ContactController();
