const whatsappService = require('../services/whatsappService');
const database = require('../config/database');

class AdvancedMessageController {
  // ============= BASIC MESSAGING =============
  
  // Send text message
  async sendText(req, res) {
    try {
      const { instanceId, to, message, quotedMessageId } = req.body;
      
      if (!instanceId || !to || !message) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, and message are required'
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
      const messageOptions = { text: message };
      
      // Add quoted message if provided
      if (quotedMessageId) {
        messageOptions.quoted = { key: { id: quotedMessageId } };
      }
      
      const result = await instance.socket.sendMessage(jid, messageOptions);
      
      res.json({
        success: true,
        data: {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp
        },
        message: 'Text message sent successfully'
      });
    } catch (error) {
      console.error('Error sending text message:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send text message'
      });
    }
  }

  // Send image
  async sendImage(req, res) {
    try {
      const { instanceId, to, imageUrl, imageBase64, caption, viewOnce } = req.body;
      
      if (!instanceId || !to || (!imageUrl && !imageBase64)) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, and either imageUrl or imageBase64 are required'
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
      const messageOptions = {
        caption: caption || '',
        viewOnce: viewOnce || false
      };
      
      if (imageBase64) {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        messageOptions.image = Buffer.from(base64Data, 'base64');
      } else if (imageUrl) {
        messageOptions.image = { url: imageUrl };
      }
      
      const result = await instance.socket.sendMessage(jid, messageOptions);
      
      res.json({
        success: true,
        data: {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp
        },
        message: 'Image sent successfully'
      });
    } catch (error) {
      console.error('Error sending image:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send image'
      });
    }
  }

  // Send file/document
  async sendFile(req, res) {
    try {
      const { instanceId, to, fileUrl, fileBase64, fileName, mimetype, caption } = req.body;
      
      if (!instanceId || !to || (!fileUrl && !fileBase64)) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, and either fileUrl or fileBase64 are required'
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
      const messageOptions = {
        fileName: fileName || 'document',
        mimetype: mimetype || 'application/octet-stream',
        caption: caption || ''
      };
      
      if (fileBase64) {
        const base64Data = fileBase64.replace(/^data:.*;base64,/, '');
        messageOptions.document = Buffer.from(base64Data, 'base64');
      } else if (fileUrl) {
        messageOptions.document = { url: fileUrl };
      }
      
      const result = await instance.socket.sendMessage(jid, messageOptions);
      
      res.json({
        success: true,
        data: {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp
        },
        message: 'File sent successfully'
      });
    } catch (error) {
      console.error('Error sending file:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send file'
      });
    }
  }

  // Send voice/audio
  async sendVoice(req, res) {
    try {
      const { instanceId, to, audioUrl, audioBase64, ptt = true } = req.body;
      
      if (!instanceId || !to || (!audioUrl && !audioBase64)) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, and either audioUrl or audioBase64 are required'
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
      const messageOptions = {
        ptt: ptt, // Push to talk (voice note)
        mimetype: 'audio/ogg; codecs=opus'
      };
      
      if (audioBase64) {
        const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
        messageOptions.audio = Buffer.from(base64Data, 'base64');
      } else if (audioUrl) {
        messageOptions.audio = { url: audioUrl };
      }
      
      const result = await instance.socket.sendMessage(jid, messageOptions);
      
      res.json({
        success: true,
        data: {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp
        },
        message: 'Voice message sent successfully'
      });
    } catch (error) {
      console.error('Error sending voice message:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send voice message'
      });
    }
  }

  // Send video
  async sendVideo(req, res) {
    try {
      const { instanceId, to, videoUrl, videoBase64, caption, gifPlayback = false } = req.body;
      
      if (!instanceId || !to || (!videoUrl && !videoBase64)) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, and either videoUrl or videoBase64 are required'
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
      const messageOptions = {
        caption: caption || '',
        gifPlayback: gifPlayback
      };
      
      if (videoBase64) {
        const base64Data = videoBase64.replace(/^data:video\/\w+;base64,/, '');
        messageOptions.video = Buffer.from(base64Data, 'base64');
      } else if (videoUrl) {
        messageOptions.video = { url: videoUrl };
      }
      
      const result = await instance.socket.sendMessage(jid, messageOptions);
      
      res.json({
        success: true,
        data: {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp
        },
        message: 'Video sent successfully'
      });
    } catch (error) {
      console.error('Error sending video:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send video'
      });
    }
  }

  // Send link with custom preview
  async sendLinkPreview(req, res) {
    try {
      const { instanceId, to, text, url, title, description, thumbnailUrl } = req.body;
      
      if (!instanceId || !to || !text) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, and text are required'
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
      
      // If custom preview data is provided
      if (url && title) {
        const messageOptions = {
          text: text,
          linkPreview: {
            url: url,
            title: title,
            description: description || '',
            thumbnailUrl: thumbnailUrl || null
          }
        };
        
        const result = await instance.socket.sendMessage(jid, messageOptions);
        
        res.json({
          success: true,
          data: {
            messageId: result.key.id,
            status: result.status,
            timestamp: result.messageTimestamp
          },
          message: 'Link with preview sent successfully'
        });
      } else {
        // Auto-generate preview
        const result = await instance.socket.sendMessage(jid, { text: text });
        
        res.json({
          success: true,
          data: {
            messageId: result.key.id,
            status: result.status,
            timestamp: result.messageTimestamp
          },
          message: 'Link sent successfully'
        });
      }
    } catch (error) {
      console.error('Error sending link preview:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send link preview'
      });
    }
  }

  // ============= INTERACTIVE MESSAGES =============

  // Send list message
  async sendListMessage(req, res) {
    try {
      const { instanceId, to, title, text, buttonText, sections } = req.body;
      
      if (!instanceId || !to || !title || !text || !buttonText || !sections) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, title, text, buttonText, and sections are required'
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
      
      const listMessage = {
        text: text,
        footer: 'Select an option',
        title: title,
        buttonText: buttonText,
        sections: sections
      };
      
      const result = await instance.socket.sendMessage(jid, listMessage);
      
      res.json({
        success: true,
        data: {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp
        },
        message: 'List message sent successfully'
      });
    } catch (error) {
      console.error('Error sending list message:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send list message'
      });
    }
  }

  // Send button reply message
  async sendButtonReply(req, res) {
    try {
      const { instanceId, to, text, footer, buttons } = req.body;
      
      if (!instanceId || !to || !text || !buttons || !Array.isArray(buttons)) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, text, and buttons array are required'
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
      
      const buttonMessage = {
        text: text,
        footer: footer || '',
        buttons: buttons.map((btn, index) => ({
          buttonId: btn.id || `btn_${index}`,
          buttonText: { displayText: btn.text },
          type: 1
        })),
        headerType: 1
      };
      
      const result = await instance.socket.sendMessage(jid, buttonMessage);
      
      res.json({
        success: true,
        data: {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp
        },
        message: 'Button message sent successfully'
      });
    } catch (error) {
      console.error('Error sending button message:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send button message'
      });
    }
  }

  // Send poll
  async sendPoll(req, res) {
    try {
      const { instanceId, to, question, options, multipleAnswers = false } = req.body;
      
      if (!instanceId || !to || !question || !options || !Array.isArray(options)) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, question, and options array are required'
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
      
      const pollMessage = {
        poll: {
          name: question,
          values: options,
          selectableCount: multipleAnswers ? options.length : 1
        }
      };
      
      const result = await instance.socket.sendMessage(jid, pollMessage);
      
      res.json({
        success: true,
        data: {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp
        },
        message: 'Poll sent successfully'
      });
    } catch (error) {
      console.error('Error sending poll:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send poll'
      });
    }
  }

  // Send poll vote
  async sendPollVote(req, res) {
    try {
      const { instanceId, pollMessageId, selectedOptions } = req.body;
      
      if (!instanceId || !pollMessageId || !selectedOptions || !Array.isArray(selectedOptions)) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, pollMessageId, and selectedOptions array are required'
        });
      }
      
      const instance = whatsappService.getInstance(instanceId);
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }
      
      // Vote on poll
      await instance.socket.updatePollVote(pollMessageId, selectedOptions);
      
      res.json({
        success: true,
        message: 'Poll vote submitted successfully'
      });
    } catch (error) {
      console.error('Error voting on poll:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to vote on poll'
      });
    }
  }

  // ============= LOCATION & CONTACT =============

  // Send location
  async sendLocation(req, res) {
    try {
      const { instanceId, to, latitude, longitude, name, address } = req.body;
      
      if (!instanceId || !to || latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, latitude, and longitude are required'
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
      
      const locationMessage = {
        location: {
          degreesLatitude: latitude,
          degreesLongitude: longitude,
          name: name || '',
          address: address || ''
        }
      };
      
      const result = await instance.socket.sendMessage(jid, locationMessage);
      
      res.json({
        success: true,
        data: {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp
        },
        message: 'Location sent successfully'
      });
    } catch (error) {
      console.error('Error sending location:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send location'
      });
    }
  }

  // Send contact vCard
  async sendContact(req, res) {
    try {
      const { instanceId, to, contactName, contactNumber, organization } = req.body;
      
      if (!instanceId || !to || !contactName || !contactNumber) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, contactName, and contactNumber are required'
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
      
      const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${contactName}
TEL;type=CELL;type=VOICE;waid=${contactNumber.replace(/[^0-9]/g, '')}:${contactNumber}
${organization ? `ORG:${organization}` : ''}
END:VCARD`;
      
      const contactMessage = {
        contacts: {
          displayName: contactName,
          contacts: [{ vcard }]
        }
      };
      
      const result = await instance.socket.sendMessage(jid, contactMessage);
      
      res.json({
        success: true,
        data: {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp
        },
        message: 'Contact sent successfully'
      });
    } catch (error) {
      console.error('Error sending contact:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send contact'
      });
    }
  }

  // ============= MESSAGE ACTIONS =============

  // Forward message
  async forwardMessage(req, res) {
    try {
      const { instanceId, to, messageId, fromChatId } = req.body;
      
      if (!instanceId || !to || !messageId || !fromChatId) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, to, messageId, and fromChatId are required'
        });
      }
      
      const instance = whatsappService.getInstance(instanceId);
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }
      
      const toJid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      const fromJid = fromChatId.includes('@') ? fromChatId : `${fromChatId}@s.whatsapp.net`;
      
      // Get the message to forward
      const message = {
        key: {
          remoteJid: fromJid,
          id: messageId
        }
      };
      
      const result = await instance.socket.sendMessage(toJid, { forward: message });
      
      res.json({
        success: true,
        data: {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp
        },
        message: 'Message forwarded successfully'
      });
    } catch (error) {
      console.error('Error forwarding message:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to forward message'
      });
    }
  }

  // Send seen/read receipt
  async sendSeen(req, res) {
    try {
      const { instanceId, chatId, messageIds } = req.body;
      
      if (!instanceId || !chatId) {
        return res.status(400).json({
          success: false,
          error: 'instanceId and chatId are required'
        });
      }
      
      const instance = whatsappService.getInstance(instanceId);
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }
      
      const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
      
      if (messageIds && Array.isArray(messageIds)) {
        // Mark specific messages as read
        const keys = messageIds.map(id => ({
          remoteJid: jid,
          id: id
        }));
        await instance.socket.readMessages(keys);
      } else {
        // Mark all messages in chat as read
        await instance.socket.sendReadReceipt(jid, undefined, undefined);
      }
      
      res.json({
        success: true,
        message: 'Messages marked as seen'
      });
    } catch (error) {
      console.error('Error sending seen receipt:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send seen receipt'
      });
    }
  }

  // Start typing indicator
  async startTyping(req, res) {
    try {
      const { instanceId, to } = req.body;
      
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
      
      res.json({
        success: true,
        message: 'Typing indicator started'
      });
    } catch (error) {
      console.error('Error starting typing:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to start typing'
      });
    }
  }

  // Stop typing indicator
  async stopTyping(req, res) {
    try {
      const { instanceId, to } = req.body;
      
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
      await instance.socket.sendPresenceUpdate('paused', jid);
      
      res.json({
        success: true,
        message: 'Typing indicator stopped'
      });
    } catch (error) {
      console.error('Error stopping typing:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to stop typing'
      });
    }
  }

  // Add reaction to message
  async addReaction(req, res) {
    try {
      const { instanceId, chatId, messageId, reaction } = req.body;
      
      if (!instanceId || !chatId || !messageId || !reaction) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, chatId, messageId, and reaction are required'
        });
      }
      
      const instance = whatsappService.getInstance(instanceId);
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }
      
      const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
      
      const reactionMessage = {
        react: {
          text: reaction, // Emoji reaction
          key: {
            remoteJid: jid,
            id: messageId
          }
        }
      };
      
      await instance.socket.sendMessage(jid, reactionMessage);
      
      res.json({
        success: true,
        message: 'Reaction added successfully'
      });
    } catch (error) {
      console.error('Error adding reaction:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to add reaction'
      });
    }
  }

  // Star/unstar message
  async starMessage(req, res) {
    try {
      const { instanceId, chatId, messageId, star = true } = req.body;
      
      if (!instanceId || !chatId || !messageId) {
        return res.status(400).json({
          success: false,
          error: 'instanceId, chatId, and messageId are required'
        });
      }
      
      const instance = whatsappService.getInstance(instanceId);
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }
      
      const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
      
      await instance.socket.chatModify({
        star: star,
        messages: [{
          key: {
            remoteJid: jid,
            id: messageId
          }
        }]
      });
      
      res.json({
        success: true,
        message: star ? 'Message starred successfully' : 'Message unstarred successfully'
      });
    } catch (error) {
      console.error('Error starring message:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to star message'
      });
    }
  }
}

module.exports = new AdvancedMessageController();
