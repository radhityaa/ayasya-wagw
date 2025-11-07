const axios = require('axios');
const database = require('../config/database');

class WebhookService {
  constructor() {
    this.webhookQueue = new Map(); // Queue for failed webhooks
    this.retryAttempts = new Map(); // Track retry attempts
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Trigger webhook with retry mechanism
   * @param {string} url - Webhook URL
   * @param {object} payload - Webhook payload
   * @param {string} instanceId - Instance ID
   * @returns {Promise<object>}
   */
  async triggerWebhook(url, payload, instanceId = null) {
    const webhookId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-ID': webhookId,
          'X-Instance-ID': instanceId || 'unknown'
        },
        timeout: 10000 // 10 seconds timeout
      });

      // Log successful webhook
      await this.logWebhook({
        webhookId,
        instanceId,
        url,
        event: payload.event,
        payload: JSON.stringify(payload),
        status: 'success',
        statusCode: response.status,
        response: JSON.stringify(response.data),
        attempts: 1
      });

      return {
        success: true,
        webhookId,
        statusCode: response.status,
        response: response.data
      };
    } catch (error) {
      console.error('Webhook trigger failed:', error.message);

      // Log failed webhook
      await this.logWebhook({
        webhookId,
        instanceId,
        url,
        event: payload.event,
        payload: JSON.stringify(payload),
        status: 'failed',
        statusCode: error.response?.status || 0,
        error: error.message,
        attempts: 1
      });

      // Add to retry queue
      this.addToRetryQueue(webhookId, url, payload, instanceId);

      return {
        success: false,
        webhookId,
        error: error.message
      };
    }
  }

  /**
   * Add webhook to retry queue
   */
  addToRetryQueue(webhookId, url, payload, instanceId) {
    const attempts = this.retryAttempts.get(webhookId) || 0;

    if (attempts < this.maxRetries) {
      this.webhookQueue.set(webhookId, {
        url,
        payload,
        instanceId,
        attempts: attempts + 1,
        nextRetry: Date.now() + this.retryDelay * (attempts + 1)
      });

      this.retryAttempts.set(webhookId, attempts + 1);

      // Schedule retry
      setTimeout(() => {
        this.retryWebhook(webhookId);
      }, this.retryDelay * (attempts + 1));
    }
  }

  /**
   * Retry failed webhook
   */
  async retryWebhook(webhookId) {
    const webhook = this.webhookQueue.get(webhookId);

    if (!webhook) {
      return;
    }

    try {
      const response = await axios.post(webhook.url, webhook.payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-ID': webhookId,
          'X-Instance-ID': webhook.instanceId || 'unknown',
          'X-Retry-Attempt': webhook.attempts
        },
        timeout: 10000
      });

      // Update webhook log
      await this.updateWebhookLog(webhookId, {
        status: 'success',
        statusCode: response.status,
        response: JSON.stringify(response.data),
        attempts: webhook.attempts
      });

      // Remove from queue
      this.webhookQueue.delete(webhookId);
      this.retryAttempts.delete(webhookId);

      console.log(`Webhook ${webhookId} retry successful after ${webhook.attempts} attempts`);
    } catch (error) {
      console.error(`Webhook ${webhookId} retry ${webhook.attempts} failed:`, error.message);

      // Update webhook log
      await this.updateWebhookLog(webhookId, {
        status: 'failed',
        statusCode: error.response?.status || 0,
        error: error.message,
        attempts: webhook.attempts
      });

      // Try again if not exceeded max retries
      if (webhook.attempts < this.maxRetries) {
        this.addToRetryQueue(webhookId, webhook.url, webhook.payload, webhook.instanceId);
      } else {
        // Max retries exceeded
        this.webhookQueue.delete(webhookId);
        this.retryAttempts.delete(webhookId);
        console.error(`Webhook ${webhookId} failed after ${this.maxRetries} attempts`);
      }
    }
  }

  /**
   * Log webhook to database
   */
  async logWebhook(data) {
    const prisma = database.getInstance();

    try {
      await prisma.webhookLog.create({
        data: {
          webhookId: data.webhookId,
          instanceId: data.instanceId,
          url: data.url,
          event: data.event,
          payload: data.payload,
          status: data.status,
          statusCode: data.statusCode,
          response: data.response || null,
          error: data.error || null,
          attempts: data.attempts
        }
      });
    } catch (error) {
      console.error('Error logging webhook:', error);
    }
  }

  /**
   * Update webhook log
   */
  async updateWebhookLog(webhookId, data) {
    const prisma = database.getInstance();

    try {
      await prisma.webhookLog.updateMany({
        where: { webhookId },
        data: {
          status: data.status,
          statusCode: data.statusCode,
          response: data.response || null,
          error: data.error || null,
          attempts: data.attempts
        }
      });
    } catch (error) {
      console.error('Error updating webhook log:', error);
    }
  }

  /**
   * Get webhook logs
   */
  async getWebhookLogs(instanceId = null, limit = 50) {
    const prisma = database.getInstance();

    try {
      const where = instanceId ? { instanceId } : {};

      const logs = await prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return logs;
    } catch (error) {
      console.error('Error getting webhook logs:', error);
      throw error;
    }
  }

  /**
   * Get webhook log by ID
   */
  async getWebhookLogById(webhookId) {
    const prisma = database.getInstance();

    try {
      const log = await prisma.webhookLog.findFirst({
        where: { webhookId }
      });

      return log;
    } catch (error) {
      console.error('Error getting webhook log:', error);
      throw error;
    }
  }

  /**
   * Trigger session.status webhook
   */
  async triggerSessionStatus(instanceId, status, additionalData = {}) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'session.status',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          status,
          ...additionalData
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering session.status webhook:', error);
      return null;
    }
  }

  /**
   * Trigger message.received webhook
   */
  async triggerMessageReceived(instanceId, messageData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'message.received',
        instanceId,
        timestamp: new Date().toISOString(),
        data: messageData
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering message.received webhook:', error);
      return null;
    }
  }

  /**
   * Trigger message.sent webhook
   */
  async triggerMessageSent(instanceId, messageData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'message.sent',
        instanceId,
        timestamp: new Date().toISOString(),
        data: messageData
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering message.sent webhook:', error);
      return null;
    }
  }

  /**
   * Trigger message.updated webhook
   */
  async triggerMessageUpdated(instanceId, messageData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'message.updated',
        instanceId,
        timestamp: new Date().toISOString(),
        data: messageData
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering message.updated webhook:', error);
      return null;
    }
  }

  /**
   * Trigger message.any webhook (for all message events)
   */
  async triggerMessageAny(instanceId, messageData, eventType = 'any') {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'message.any',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          ...messageData,
          eventType // received, sent, updated, ack, revoked, edited
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering message.any webhook:', error);
      return null;
    }
  }

  /**
   * Trigger message.ack webhook (message acknowledgment/read receipt)
   */
  async triggerMessageAck(instanceId, messageData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'message.ack',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          messageId: messageData.messageId,
          chatId: messageData.chatId,
          from: messageData.from,
          ack: messageData.ack, // 0: pending, 1: sent, 2: delivered, 3: read, 4: played
          ackName: this.getAckName(messageData.ack),
          timestamp: messageData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering message.ack webhook:', error);
      return null;
    }
  }

  /**
   * Trigger message.revoked webhook (message deleted)
   */
  async triggerMessageRevoked(instanceId, messageData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'message.revoked',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          messageId: messageData.messageId,
          chatId: messageData.chatId,
          from: messageData.from,
          revokedBy: messageData.revokedBy, // 'me' or 'them'
          originalMessage: messageData.originalMessage || null,
          timestamp: messageData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering message.revoked webhook:', error);
      return null;
    }
  }

  /**
   * Trigger message.edited webhook (message edited)
   */
  async triggerMessageEdited(instanceId, messageData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'message.edited',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          messageId: messageData.messageId,
          chatId: messageData.chatId,
          from: messageData.from,
          pushName: messageData.pushName,
          oldBody: messageData.oldBody,
          newBody: messageData.newBody,
          editedTimestamp: messageData.editedTimestamp || new Date().toISOString(),
          originalTimestamp: messageData.originalTimestamp
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering message.edited webhook:', error);
      return null;
    }
  }

  /**
   * Get acknowledgment name from ack number
   */
  getAckName(ack) {
    const ackNames = {
      0: 'pending',
      1: 'sent',
      2: 'delivered',
      3: 'read',
      4: 'played'
    };
    return ackNames[ack] || 'unknown';
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(instanceId = null, days = 7) {
    const prisma = database.getInstance();

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const where = {
        createdAt: {
          gte: startDate
        }
      };

      if (instanceId) {
        where.instanceId = instanceId;
      }

      const [total, success, failed, byEvent] = await Promise.all([
        prisma.webhookLog.count({ where }),
        prisma.webhookLog.count({ where: { ...where, status: 'success' } }),
        prisma.webhookLog.count({ where: { ...where, status: 'failed' } }),
        prisma.webhookLog.groupBy({
          by: ['event'],
          where,
          _count: true
        })
      ]);

      return {
        total,
        success,
        failed,
        successRate: total > 0 ? ((success / total) * 100).toFixed(2) : 0,
        topEvents: byEvent.map(e => ({
          event: e.event,
          count: e._count
        }))
      };
    } catch (error) {
      console.error('Error getting webhook stats:', error);
      throw error;
    }
  }

  /**
   * Trigger group.v2.join webhook (someone joined group)
   */
  async triggerGroupJoin(instanceId, groupData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'group.v2.join',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          groupId: groupData.groupId,
          groupName: groupData.groupName,
          participants: groupData.participants, // Array of participants who joined
          addedBy: groupData.addedBy,
          timestamp: groupData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering group.v2.join webhook:', error);
      return null;
    }
  }

  /**
   * Trigger group.v2.leave webhook (someone left group)
   */
  async triggerGroupLeave(instanceId, groupData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'group.v2.leave',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          groupId: groupData.groupId,
          groupName: groupData.groupName,
          participants: groupData.participants, // Array of participants who left
          removedBy: groupData.removedBy, // Who removed them (if kicked)
          reason: groupData.reason, // 'left' or 'removed'
          timestamp: groupData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering group.v2.leave webhook:', error);
      return null;
    }
  }

  /**
   * Trigger group.v2.update webhook (group info updated)
   */
  async triggerGroupUpdate(instanceId, groupData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'group.v2.update',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          groupId: groupData.groupId,
          groupName: groupData.groupName,
          updates: groupData.updates, // Object with updated fields
          updatedBy: groupData.updatedBy,
          timestamp: groupData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering group.v2.update webhook:', error);
      return null;
    }
  }

  /**
   * Trigger group.v2.participants webhook (participants changed)
   */
  async triggerGroupParticipants(instanceId, groupData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'group.v2.participants',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          groupId: groupData.groupId,
          groupName: groupData.groupName,
          action: groupData.action, // 'add', 'remove', 'promote', 'demote'
          participants: groupData.participants,
          actor: groupData.actor, // Who performed the action
          timestamp: groupData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering group.v2.participants webhook:', error);
      return null;
    }
  }

  /**
   * Trigger presence.update webhook (user online/offline status)
   */
  async triggerPresenceUpdate(instanceId, presenceData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'presence.update',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          jid: presenceData.jid,
          presence: presenceData.presence, // available, unavailable, composing, recording, paused
          lastSeen: presenceData.lastSeen || null,
          timestamp: presenceData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering presence.update webhook:', error);
      return null;
    }
  }

  /**
   * Trigger poll.vote webhook (someone voted on a poll)
   */
  async triggerPollVote(instanceId, pollData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'poll.vote',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          pollMessageId: pollData.pollMessageId,
          chatId: pollData.chatId,
          voter: pollData.voter,
          selectedOptions: pollData.selectedOptions,
          timestamp: pollData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering poll.vote webhook:', error);
      return null;
    }
  }

  /**
   * Trigger poll.vote.failed webhook (poll vote failed)
   */
  async triggerPollVoteFailed(instanceId, pollData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'poll.vote.failed',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          pollMessageId: pollData.pollMessageId,
          chatId: pollData.chatId,
          voter: pollData.voter,
          error: pollData.error,
          timestamp: pollData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering poll.vote.failed webhook:', error);
      return null;
    }
  }

  /**
   * Trigger chat.archive webhook (chat archived/unarchived)
   */
  async triggerChatArchive(instanceId, chatData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'chat.archive',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          chatId: chatData.chatId,
          chatName: chatData.chatName,
          archived: chatData.archived, // true or false
          timestamp: chatData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering chat.archive webhook:', error);
      return null;
    }
  }

  /**
   * Trigger call.received webhook (incoming call)
   */
  async triggerCallReceived(instanceId, callData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'call.received',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          callId: callData.callId,
          from: callData.from,
          fromName: callData.fromName,
          isVideo: callData.isVideo,
          isGroup: callData.isGroup,
          timestamp: callData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering call.received webhook:', error);
      return null;
    }
  }

  /**
   * Trigger call.accepted webhook (call accepted)
   */
  async triggerCallAccepted(instanceId, callData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'call.accepted',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          callId: callData.callId,
          from: callData.from,
          fromName: callData.fromName,
          isVideo: callData.isVideo,
          timestamp: callData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering call.accepted webhook:', error);
      return null;
    }
  }

  /**
   * Trigger call.rejected webhook (call rejected)
   */
  async triggerCallRejected(instanceId, callData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'call.rejected',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          callId: callData.callId,
          from: callData.from,
          fromName: callData.fromName,
          isVideo: callData.isVideo,
          reason: callData.reason || 'rejected',
          timestamp: callData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering call.rejected webhook:', error);
      return null;
    }
  }

  /**
   * Trigger label.upsert webhook (label created/updated)
   */
  async triggerLabelUpsert(instanceId, labelData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'label.upsert',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          labelId: labelData.labelId,
          labelName: labelData.labelName,
          labelColor: labelData.labelColor,
          action: labelData.action, // 'created' or 'updated'
          timestamp: labelData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering label.upsert webhook:', error);
      return null;
    }
  }

  /**
   * Trigger label.deleted webhook (label deleted)
   */
  async triggerLabelDeleted(instanceId, labelData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'label.deleted',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          labelId: labelData.labelId,
          labelName: labelData.labelName,
          timestamp: labelData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering label.deleted webhook:', error);
      return null;
    }
  }

  /**
   * Trigger label.chat.added webhook (label added to chat)
   */
  async triggerLabelChatAdded(instanceId, labelData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'label.chat.added',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          labelId: labelData.labelId,
          labelName: labelData.labelName,
          chatId: labelData.chatId,
          chatName: labelData.chatName,
          timestamp: labelData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering label.chat.added webhook:', error);
      return null;
    }
  }

  /**
   * Trigger label.chat.deleted webhook (label removed from chat)
   */
  async triggerLabelChatDeleted(instanceId, labelData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'label.chat.deleted',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          labelId: labelData.labelId,
          labelName: labelData.labelName,
          chatId: labelData.chatId,
          chatName: labelData.chatName,
          timestamp: labelData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering label.chat.deleted webhook:', error);
      return null;
    }
  }

  /**
   * Trigger event.response webhook (event RSVP response)
   */
  async triggerEventResponse(instanceId, eventData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'event.response',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          eventId: eventData.eventId,
          eventName: eventData.eventName,
          chatId: eventData.chatId,
          respondent: eventData.respondent,
          response: eventData.response, // 'going', 'not_going', 'maybe'
          timestamp: eventData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering event.response webhook:', error);
      return null;
    }
  }

  /**
   * Trigger event.response.failed webhook (event RSVP response failed)
   */
  async triggerEventResponseFailed(instanceId, eventData) {
    const prisma = database.getInstance();

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId }
      });

      if (!instance?.webhookUrl) {
        return null;
      }

      const payload = {
        event: 'event.response.failed',
        instanceId,
        timestamp: new Date().toISOString(),
        data: {
          eventId: eventData.eventId,
          eventName: eventData.eventName,
          chatId: eventData.chatId,
          respondent: eventData.respondent,
          error: eventData.error,
          timestamp: eventData.timestamp || new Date().toISOString()
        }
      };

      return await this.triggerWebhook(instance.webhookUrl, payload, instanceId);
    } catch (error) {
      console.error('Error triggering event.response.failed webhook:', error);
      return null;
    }
  }

  /**
   * Test webhook URL
   */
  async testWebhook(url) {
    try {
      const payload = {
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from WhatsApp Gateway API'
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        statusCode: response.status,
        response: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        statusCode: error.response?.status || 0
      };
    }
  }
}

module.exports = new WebhookService();
