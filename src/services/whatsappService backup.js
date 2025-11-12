const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, delay } = require('baileys');

const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const database = require('../config/database');
const config = require('../config/config');
const webhookService = require('./webhookService');

class WhatsAppService {
    constructor() {
        this.instances = new Map();
        this.reconnectAttempts = new Map();
        this.appStateReady = new Map(); // Track app state readiness
    }

    async init(instanceId, forceFresh = false) {
        try {
            const sessionPath = path.join(config.whatsapp.sessionPath, instanceId);

            // Ensure session directory exists
            await fs.mkdir(sessionPath, { recursive: true });

            let state, saveCreds;

            // Check if we should start fresh or try to load existing session
            if (forceFresh) {
                // For fresh start, create empty auth state
                const { state: freshState, saveCreds: freshSaveCreds } = await useMultiFileAuthState(sessionPath);
                state = freshState;
                saveCreds = freshSaveCreds;
            } else {
                try {
                    // Try to load existing auth state
                    const authState = await useMultiFileAuthState(sessionPath);
                    state = authState.state;
                    saveCreds = authState.saveCreds;
                } catch (error) {
                    console.log(`Session files not found or corrupted for ${instanceId}, starting fresh`);
                    // If loading fails, start fresh
                    const { state: freshState, saveCreds: freshSaveCreds } = await useMultiFileAuthState(sessionPath);
                    state = freshState;
                    saveCreds = freshSaveCreds;
                }
            }

            // Create socket connection
            const socket = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                browser: ['WhatsApp Gateway', 'Chrome', '1.0.0'],
                defaultQueryTimeoutMs: undefined,
                keepAliveIntervalMs: 30000,
                connectTimeoutMs: 60000,
                emitOwnEvents: true,
                generateHighQualityLinkPreview: true,
                // Force fresh connection for QR/pairing code generation
                forceFresh: forceFresh,
            });

            // Handle connection updates
            socket.ev.on('connection.update', async (update) => {
                await this.handleConnectionUpdate(instanceId, update, socket, saveCreds);
            });

            // Handle credentials update
            socket.ev.on('creds.update', saveCreds);

            // Handle messages
            socket.ev.on('messages.upsert', async (messageUpdate) => {
                await this.handleIncomingMessages(instanceId, messageUpdate);
            });

            // Handle message status updates (ACK)
            socket.ev.on('messages.update', async (messages) => {
                await this.handleMessageUpdate(instanceId, messages);
            });

            // Handle message revoke (delete)
            socket.ev.on('message.delete', async (messageDelete) => {
                await this.handleMessageRevoke(instanceId, messageDelete);
            });

            // Handle chats update
            socket.ev.on('chats.set', async ({ chats }) => {
                await this.handleChatsUpdate(instanceId, chats);
            });

            // Handle presence update
            socket.ev.on('presence.update', async (presenceUpdate) => {
                await this.handlePresenceUpdate(instanceId, presenceUpdate);
            });

            // Handle call events
            socket.ev.on('call', async (callEvents) => {
                await this.handleCallEvents(instanceId, callEvents);
            });

            // Handle label events
            socket.ev.on('labels.edit', async (labelUpdate) => {
                await this.handleLabelEvents(instanceId, labelUpdate);
            });

            // Handle label association events
            socket.ev.on('labels.association', async (labelAssociation) => {
                await this.handleLabelAssociation(instanceId, labelAssociation);
            });

            // Handle app state sync - this is crucial for profile updates
            socket.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }) => {
                console.log(`App state sync for instance ${instanceId}: chats=${chats?.length || 0}, contacts=${contacts?.length || 0}, messages=${messages?.length || 0}, isLatest=${isLatest}`);
                if (isLatest) {
                    this.appStateReady.set(instanceId, true);
                    console.log(`App state fully synced for instance ${instanceId} - Profile updates now available`);
                }
            });

            // Handle group updates
            socket.ev.on('groups.update', async (updates) => {
                await this.handleGroupUpdate(instanceId, updates);
            });

            // Handle group participant updates
            socket.ev.on('group-participants.update', async (update) => {
                await this.handleGroupParticipantsUpdate(instanceId, update);
            });

            // Store instance
            this.instances.set(instanceId, {
                socket,
                qr: null,
                info: null,
                appStateReady: false,
                pairingCode: null,
            });

            return { success: true, instanceId };
        } catch (error) {
            console.error('Failed to initialize WhatsApp instance:', error);
            throw error;
        }
    }

    async handleConnectionUpdate(instanceId, update, socket, saveCreds) {
        const { connection, lastDisconnect, qr } = update;
        const prisma = database.getInstance();

        try {
            // Always generate QR code when available, regardless of phone number
            if (qr) {
                const qrCode = await qrcode.toDataURL(qr);

                // Update instance in database
                await prisma.instance.update({
                    where: { id: instanceId },
                    data: {
                        status: 'qr',
                        qrCode: qrCode,
                    },
                });

                // Store QR in memory
                if (this.instances.has(instanceId)) {
                    this.instances.get(instanceId).qr = qrCode;
                }

                console.log(`QR Code generated for instance ${instanceId}`);

                // Trigger webhook for session status change using new service
                await webhookService.triggerSessionStatus(instanceId, 'qr', {
                    qrCode: qrCode,
                });
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                const attempts = this.reconnectAttempts.get(instanceId) || 0;

                console.log(`Connection closed for instance ${instanceId}. Should reconnect: ${shouldReconnect}`);

                // Update status in database
                await prisma.instance.update({
                    where: { id: instanceId },
                    data: {
                        status: 'disconnected',
                        qrCode: null,
                        pairingCode: null,
                    },
                });

                // Clear pairing code from memory
                if (this.instances.has(instanceId)) {
                    this.instances.get(instanceId).pairingCode = null;
                }

                // Trigger webhook for session status change using new service
                await webhookService.triggerSessionStatus(instanceId, 'disconnected', {
                    reason: shouldReconnect ? 'connection_lost' : 'logged_out',
                });

                if (shouldReconnect && attempts < config.whatsapp.maxReconnectAttempts) {
                    // Increment reconnect attempts
                    this.reconnectAttempts.set(instanceId, attempts + 1);

                    // Wait before reconnecting
                    await delay(config.whatsapp.reconnectInterval);

                    console.log(`Reconnecting instance ${instanceId}... Attempt ${attempts + 1}`);
                    await this.init(instanceId);
                } else {
                    // Don't remove instance from memory - keep it for potential QR/pairing code generation
                    // Only clear reconnect attempts
                    this.reconnectAttempts.delete(instanceId);

                    if (!shouldReconnect) {
                        console.log(`Instance ${instanceId} logged out`);

                        // Clear session data
                        const sessionPath = path.join(config.whatsapp.sessionPath, instanceId);
                        try {
                            await fs.rmdir(sessionPath, { recursive: true });
                        } catch (err) {
                            console.error('Failed to delete session:', err);
                        }
                    }
                }
            }

            if (connection === 'open') {
                console.log(`WhatsApp connection opened for instance ${instanceId}`);

                // Reset reconnect attempts
                this.reconnectAttempts.set(instanceId, 0);

                // Get user info
                const user = socket.user;

                // Update instance in database
                await prisma.instance.update({
                    where: { id: instanceId },
                    data: {
                        status: 'connected',
                        phoneNumber: user?.id?.split('@')[0] || null,
                        qrCode: null,
                    },
                });

                // Store user info
                if (this.instances.has(instanceId)) {
                    this.instances.get(instanceId).info = user;
                    this.instances.get(instanceId).qr = null;

                    // Wait a bit for app state to sync
                    setTimeout(() => {
                        const instance = this.instances.get(instanceId);
                        if (instance && !this.appStateReady.get(instanceId)) {
                            // If app state hasn't synced after 5 seconds, mark it as ready anyway
                            // Some accounts might not have messaging history
                            this.appStateReady.set(instanceId, true);
                            instance.appStateReady = true;
                            console.log(`App state marked as ready for instance ${instanceId} (timeout)`);
                        }
                    }, 5000);
                }

                // Save session data to database
                await this.saveSessionToDatabase(instanceId);

                // Trigger webhook for session status change using new service
                await webhookService.triggerSessionStatus(instanceId, 'connected', {
                    phoneNumber: user?.id?.split('@')[0] || null,
                });
            }

            if (connection === 'connecting') {
                console.log(`Connecting instance ${instanceId}...`);

                await prisma.instance.update({
                    where: { id: instanceId },
                    data: {
                        status: 'connecting',
                    },
                });

                // Trigger webhook for session status change using new service
                await webhookService.triggerSessionStatus(instanceId, 'connecting');

                // Auto-pairing code generation is disabled - use manual endpoints instead
            }
        } catch (error) {
            console.error('Error handling connection update:', error);
        }
    }

    async handleIncomingMessages(instanceId, messageUpdate) {
        const prisma = database.getInstance();

        try {
            const messages = messageUpdate.messages;

            for (const msg of messages) {
                // Skip status messages
                if (msg.key.remoteJid === 'status@broadcast') continue;

                // Extract message details
                const messageId = msg.key.id;
                const fromMe = msg.key.fromMe || false;
                const chatId = msg.key.remoteJid;
                const from = fromMe ? 'me' : msg.key.participant || chatId;
                const pushName = msg.pushName || '';
                const timestamp = new Date(msg.messageTimestamp * 1000);

                // Get message content
                let body = '';
                let type = 'text';
                let mediaUrl = null;

                if (msg.message?.conversation) {
                    body = msg.message.conversation;
                } else if (msg.message?.extendedTextMessage?.text) {
                    body = msg.message.extendedTextMessage.text;
                } else if (msg.message?.imageMessage) {
                    type = 'image';
                    body = msg.message.imageMessage.caption || '';
                } else if (msg.message?.videoMessage) {
                    type = 'video';
                    body = msg.message.videoMessage.caption || '';
                } else if (msg.message?.documentMessage) {
                    type = 'document';
                    body = msg.message.documentMessage.fileName || '';
                } else if (msg.message?.audioMessage) {
                    type = 'audio';
                } else if (msg.message?.stickerMessage) {
                    type = 'sticker';
                }

                // Check if chat exists, create if not
                let chat = await prisma.chat.findUnique({
                    where: {
                        instanceId_chatId: {
                            instanceId,
                            chatId,
                        },
                    },
                });

                if (!chat) {
                    const isGroup = chatId.endsWith('@g.us');
                    chat = await prisma.chat.create({
                        data: {
                            instanceId,
                            chatId,
                            name: pushName || chatId.split('@')[0],
                            isGroup,
                            lastMessage: body,
                            lastMessageAt: timestamp,
                        },
                    });
                } else {
                    // Update last message
                    await prisma.chat.update({
                        where: { id: chat.id },
                        data: {
                            lastMessage: body,
                            lastMessageAt: timestamp,
                            unreadCount: fromMe ? 0 : { increment: 1 },
                        },
                    });
                }

                // Save message to database
                await prisma.message.upsert({
                    where: { messageId },
                    update: {
                        fromMe,
                        from,
                        to: chatId,
                        body,
                        type,
                        mediaUrl,
                        timestamp,
                        status: fromMe ? 'sent' : 'received',
                    },
                    create: {
                        instanceId,
                        chatId: chat.id,
                        messageId,
                        fromMe,
                        from,
                        to: chatId,
                        body,
                        type,
                        mediaUrl,
                        timestamp,
                        status: fromMe ? 'sent' : 'received',
                    },
                });

                // Trigger webhook for incoming messages (not from me)
                if (!fromMe) {
                    await webhookService.triggerMessageReceived(instanceId, {
                        messageId,
                        from,
                        chatId,
                        pushName,
                        body,
                        type,
                        mediaUrl,
                        timestamp,
                    });
                }

                console.log(`New message received in instance ${instanceId}: ${body.substring(0, 50)}...`);
            }
        } catch (error) {
            console.error('Error handling incoming messages:', error);
        }
    }

    async handleMessageUpdate(instanceId, messages) {
        const prisma = database.getInstance();

        try {
            for (const update of messages) {
                const messageId = update.key.id;
                const chatId = update.key.remoteJid;
                const from = update.key.fromMe ? 'me' : update.key.participant || chatId;

                // Handle message status updates (ACK)
                if (update.update?.status !== undefined) {
                    const ack = update.update.status;
                    let status = 'sent';

                    switch (ack) {
                        case 0:
                            status = 'pending';
                            break;
                        case 1:
                            status = 'sent';
                            break;
                        case 2:
                            status = 'delivered';
                            break;
                        case 3:
                            status = 'read';
                            break;
                        case 4:
                            status = 'played';
                            break;
                    }

                    // Update in database
                    await prisma.message.updateMany({
                        where: { messageId },
                        data: { status },
                    });

                    // Trigger message.ack webhook
                    await webhookService.triggerMessageAck(instanceId, {
                        messageId,
                        chatId,
                        from,
                        ack,
                        timestamp: new Date().toISOString(),
                    });

                    // Also trigger message.any webhook
                    await webhookService.triggerMessageAny(
                        instanceId,
                        {
                            messageId,
                            chatId,
                            from,
                            ack,
                            status,
                            timestamp: new Date().toISOString(),
                        },
                        'ack',
                    );

                    console.log(`Message ${messageId} status updated to ${status} (ack: ${ack})`);
                }

                // Handle message edit
                if (update.update?.message) {
                    const message = await prisma.message.findFirst({
                        where: { messageId },
                    });

                    if (message) {
                        const oldBody = message.body;
                        let newBody = '';

                        // Extract new message content
                        if (update.update.message.conversation) {
                            newBody = update.update.message.conversation;
                        } else if (update.update.message.extendedTextMessage?.text) {
                            newBody = update.update.message.extendedTextMessage.text;
                        }

                        if (newBody && newBody !== oldBody) {
                            // Update in database
                            await prisma.message.updateMany({
                                where: { messageId },
                                data: { body: newBody },
                            });

                            // Trigger message.edited webhook
                            await webhookService.triggerMessageEdited(instanceId, {
                                messageId,
                                chatId,
                                from,
                                pushName: message.from,
                                oldBody,
                                newBody,
                                editedTimestamp: new Date().toISOString(),
                                originalTimestamp: message.timestamp,
                            });

                            // Also trigger message.any webhook
                            await webhookService.triggerMessageAny(
                                instanceId,
                                {
                                    messageId,
                                    chatId,
                                    from,
                                    oldBody,
                                    newBody,
                                    timestamp: new Date().toISOString(),
                                },
                                'edited',
                            );

                            console.log(`Message ${messageId} edited from "${oldBody}" to "${newBody}"`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error handling message update:', error);
        }
    }

    async handleMessageRevoke(instanceId, messageDelete) {
        const prisma = database.getInstance();

        try {
            const messageId = messageDelete.key.id;
            const chatId = messageDelete.key.remoteJid;
            const fromMe = messageDelete.key.fromMe;
            const from = fromMe ? 'me' : messageDelete.key.participant || chatId;

            // Get original message before deleting
            const message = await prisma.message.findFirst({
                where: { messageId },
            });

            if (message) {
                // Delete from database
                await prisma.message.deleteMany({
                    where: { messageId },
                });

                // Trigger message.revoked webhook
                await webhookService.triggerMessageRevoked(instanceId, {
                    messageId,
                    chatId,
                    from,
                    revokedBy: fromMe ? 'me' : 'them',
                    originalMessage: {
                        body: message.body,
                        type: message.type,
                        timestamp: message.timestamp,
                    },
                    timestamp: new Date().toISOString(),
                });

                // Also trigger message.any webhook
                await webhookService.triggerMessageAny(
                    instanceId,
                    {
                        messageId,
                        chatId,
                        from,
                        revokedBy: fromMe ? 'me' : 'them',
                        originalMessage: message.body,
                        timestamp: new Date().toISOString(),
                    },
                    'revoked',
                );

                console.log(`Message ${messageId} revoked by ${fromMe ? 'me' : 'them'}`);
            }
        } catch (error) {
            console.error('Error handling message revoke:', error);
        }
    }

    async handleChatsUpdate(instanceId, chats) {
        const prisma = database.getInstance();

        try {
            for (const chat of chats) {
                const chatId = chat.id;
                const name = chat.name || chat.id.split('@')[0];
                const isGroup = chatId.endsWith('@g.us');
                const archived = chat.archived || false;
                const unreadCount = chat.unreadCount || 0;

                // Upsert chat
                await prisma.chat.upsert({
                    where: {
                        instanceId_chatId: {
                            instanceId,
                            chatId,
                        },
                    },
                    update: {
                        name,
                        archived,
                        unreadCount,
                    },
                    create: {
                        instanceId,
                        chatId,
                        name,
                        isGroup,
                        archived,
                        unreadCount,
                    },
                });
            }
        } catch (error) {
            console.error('Error handling chats update:', error);
        }
    }

    async handlePresenceUpdate(instanceId, presenceUpdate) {
        // Handle presence updates if needed
        console.log(`Presence update for instance ${instanceId}:`, presenceUpdate);
    }

    async saveSessionToDatabase(instanceId) {
        const prisma = database.getInstance();

        try {
            const sessionPath = path.join(config.whatsapp.sessionPath, instanceId);
            const sessionFiles = await fs.readdir(sessionPath);
            const sessionData = {};

            for (const file of sessionFiles) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(sessionPath, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    sessionData[file] = JSON.parse(content);
                }
            }

            await prisma.session.upsert({
                where: { instanceId },
                update: {
                    sessionData: JSON.stringify(sessionData),
                },
                create: {
                    instanceId,
                    sessionData: JSON.stringify(sessionData),
                },
            });
        } catch (error) {
            console.error('Error saving session to database:', error);
        }
    }

    async triggerWebhook(url, data) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error(`Webhook failed: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error triggering webhook:', error);
        }
    }

    async sendMessage(instanceId, to, message, options = {}) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;
        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

        try {
            let sentMessage;

            if (options.type === 'image' && options.media) {
                sentMessage = await socket.sendMessage(jid, {
                    image: { url: options.media },
                    caption: message,
                });
            } else if (options.type === 'document' && options.media) {
                sentMessage = await socket.sendMessage(jid, {
                    document: { url: options.media },
                    fileName: options.fileName || 'document',
                    mimetype: options.mimetype || 'application/octet-stream',
                });
            } else if (options.type === 'video' && options.media) {
                sentMessage = await socket.sendMessage(jid, {
                    video: { url: options.media },
                    caption: message,
                });
            } else if (options.type === 'audio' && options.media) {
                sentMessage = await socket.sendMessage(jid, {
                    audio: { url: options.media },
                    ptt: options.ptt || false,
                });
            } else {
                sentMessage = await socket.sendMessage(jid, {
                    text: message,
                });
            }

            return sentMessage;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    async requestPairingCode(instanceId, phoneNumber) {
        let instance = this.instances.get(instanceId);

        // If instance doesn't exist or socket is not available, reinitialize with forceFresh
        if (!instance || !instance.socket) {
            console.log(`Reinitializing instance ${instanceId} for pairing code request`);
            await this.init(instanceId, true); // Force fresh connection
            instance = this.instances.get(instanceId);

            if (!instance || !instance.socket) {
                throw new Error('Failed to initialize instance for pairing code request');
            }
        }

        const { socket } = instance;

        try {
            // Ensure phone number is in E.164 format without plus sign
            const cleanPhoneNumber = phoneNumber.replace(/^\+/, '');

            // Wait a bit for socket to be ready
            let attempts = 0;
            while (!socket.user && attempts < 10) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                attempts++;
            }

            const pairingCode = await socket.requestPairingCode(cleanPhoneNumber);
            console.log(`Pairing code requested for ${cleanPhoneNumber}: ${pairingCode}`);

            // Store pairing code in memory
            instance.pairingCode = pairingCode;

            // Update instance in database
            const prisma = database.getInstance();
            await prisma.instance.update({
                where: { id: instanceId },
                data: {
                    pairingCode: pairingCode,
                },
            });

            return pairingCode;
        } catch (error) {
            console.error('Error requesting pairing code:', error);
            throw error;
        }
    }

    getPairingCode(instanceId) {
        const instance = this.instances.get(instanceId);
        return instance?.pairingCode || null;
    }

    async deleteInstance(instanceId) {
        const instance = this.instances.get(instanceId);

        if (instance && instance.socket) {
            await instance.socket.logout();
        }

        // Remove from memory
        this.instances.delete(instanceId);
        this.reconnectAttempts.delete(instanceId);

        // Delete session files
        const sessionPath = path.join(config.whatsapp.sessionPath, instanceId);
        try {
            await fs.rmdir(sessionPath, { recursive: true });
        } catch (err) {
            console.error('Failed to delete session files:', err);
        }
    }

    getInstance(instanceId) {
        const instance = this.instances.get(instanceId);
        if (instance) {
            instance.appStateReady = this.appStateReady.get(instanceId) || false;
        }
        return instance;
    }

    isAppStateReady(instanceId) {
        return this.appStateReady.get(instanceId) || false;
    }

    getAllInstances() {
        return Array.from(this.instances.keys());
    }

    getInstanceStatus(instanceId) {
        const instance = this.instances.get(instanceId);

        if (!instance) {
            return 'not_found';
        }

        if (instance.socket?.user) {
            return 'connected';
        } else if (instance.qr) {
            return 'qr';
        } else {
            return 'disconnected';
        }
    }

    getMessageType(message) {
        if (message?.conversation || message?.extendedTextMessage) return 'text';
        if (message?.imageMessage) return 'image';
        if (message?.videoMessage) return 'video';
        if (message?.documentMessage) return 'document';
        if (message?.audioMessage) return 'audio';
        if (message?.stickerMessage) return 'sticker';
        if (message?.contactMessage) return 'contact';
        if (message?.locationMessage) return 'location';
        return 'unknown';
    }

    // Chat Methods
    async getChats(instanceId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;
        const prisma = database.getInstance();

        try {
            // Get chats from database first
            const dbChats = await prisma.chat.findMany({
                where: { instanceId },
                orderBy: { lastMessageAt: 'desc' },
                include: {
                    _count: {
                        select: { messages: true },
                    },
                },
            });

            // If no chats in database, try to get from WhatsApp store
            if (dbChats.length === 0 && socket.store && socket.store.chats) {
                const storeChats = socket.store.chats.all();
                const chatsData = storeChats.map((chat) => ({
                    id: chat.id,
                    name: chat.name || chat.id.split('@')[0],
                    isGroup: chat.id.endsWith('@g.us'),
                    archived: chat.archived || false,
                    unreadCount: chat.unreadCount || 0,
                    lastMessage: chat.lastMessage?.message?.conversation || '',
                    lastMessageAt: chat.lastMessage?.messageTimestamp ? new Date(chat.lastMessage.messageTimestamp * 1000) : null,
                    messageCount: 0,
                }));

                return chatsData;
            }

            // Return database chats with proper formatting
            return dbChats.map((chat) => ({
                id: chat.chatId,
                name: chat.name,
                isGroup: chat.isGroup,
                archived: chat.archived,
                unreadCount: chat.unreadCount,
                lastMessage: chat.lastMessage,
                lastMessageAt: chat.lastMessageAt,
                messageCount: chat._count.messages,
            }));
        } catch (error) {
            console.error('Error getting chats:', error);
            throw error;
        }
    }

    async getChatsOverview(instanceId) {
        const chats = await this.getChats(instanceId);

        return chats.map((chat) => ({
            id: chat.id,
            name: chat.name,
            isGroup: chat.isGroup,
            unreadCount: chat.unreadCount,
            lastMessage: chat.lastMessage,
            lastMessageAt: chat.lastMessageAt,
        }));
    }

    async deleteChat(instanceId, chatId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;
        const prisma = database.getInstance();

        try {
            // Delete from WhatsApp
            await socket.chatModify({
                chatId,
                delete: true,
            });

            // Delete from database
            await prisma.chat.deleteMany({
                where: {
                    instanceId,
                    chatId,
                },
            });

            return { success: true, message: 'Chat deleted successfully' };
        } catch (error) {
            console.error('Error deleting chat:', error);
            throw error;
        }
    }

    async getChatPicture(instanceId, chatId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;

        try {
            const picture = await socket.profilePictureUrl(chatId, 'image');
            return { pictureUrl: picture };
        } catch (error) {
            console.error('Error getting chat picture:', error);
            throw error;
        }
    }

    async getMessagesInChat(instanceId, chatId, limit = 50) {
        const prisma = database.getInstance();

        try {
            const messages = await prisma.message.findMany({
                where: {
                    instanceId,
                    chatId: {
                        contains: chatId,
                    },
                },
                orderBy: { timestamp: 'desc' },
                take: limit,
                include: {
                    chat: true,
                },
            });

            return messages.reverse(); // Return in chronological order
        } catch (error) {
            console.error('Error getting messages in chat:', error);
            throw error;
        }
    }

    async clearAllMessages(instanceId, chatId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;
        const prisma = database.getInstance();

        try {
            // Clear messages from WhatsApp
            await socket.chatModify({
                chatId,
                clear: true,
            });

            // Delete messages from database
            await prisma.message.deleteMany({
                where: {
                    instanceId,
                    chatId: {
                        contains: chatId,
                    },
                },
            });

            return { success: true, message: 'All messages cleared successfully' };
        } catch (error) {
            console.error('Error clearing all messages:', error);
            throw error;
        }
    }

    async readUnreadMessages(instanceId, chatId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;
        const prisma = database.getInstance();

        try {
            // Mark as read in WhatsApp
            await socket.chatModify({
                chatId,
                markRead: true,
            });

            // Update unread count in database
            await prisma.chat.updateMany({
                where: {
                    instanceId,
                    chatId,
                },
                data: {
                    unreadCount: 0,
                },
            });

            return { success: true, message: 'Messages marked as read' };
        } catch (error) {
            console.error('Error reading unread messages:', error);
            throw error;
        }
    }

    async getMessageById(instanceId, chatId, messageId) {
        const prisma = database.getInstance();

        try {
            const message = await prisma.message.findUnique({
                where: { messageId },
                include: {
                    chat: true,
                },
            });

            if (!message) {
                throw new Error('Message not found');
            }

            return message;
        } catch (error) {
            console.error('Error getting message by ID:', error);
            throw error;
        }
    }

    async deleteMessage(instanceId, chatId, messageId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;
        const prisma = database.getInstance();

        try {
            // Delete from WhatsApp
            await socket.sendMessage(chatId, {
                delete: {
                    remoteJid: chatId,
                    fromMe: true,
                    id: messageId,
                },
            });

            // Delete from database
            await prisma.message.deleteMany({
                where: { messageId },
            });

            return { success: true, message: 'Message deleted successfully' };
        } catch (error) {
            console.error('Error deleting message:', error);
            throw error;
        }
    }

    async editMessage(instanceId, chatId, messageId, newText) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;

        try {
            await socket.sendMessage(chatId, {
                text: newText,
                edit: { id: messageId },
            });

            return { success: true, message: 'Message edited successfully' };
        } catch (error) {
            console.error('Error editing message:', error);
            throw error;
        }
    }

    async pinMessage(instanceId, chatId, messageId) {
        // This method is not available in Baileys
        throw new Error('Pin message method is not available');
    }

    async unpinMessage(instanceId, chatId, messageId) {
        // This method is not available in Baileys
        throw new Error('Unpin message method is not available');
    }

    async archiveChat(instanceId, chatId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;

        try {
            await socket.chatModify({
                chatId,
                archive: true,
            });

            return { success: true, message: 'Chat archived successfully' };
        } catch (error) {
            console.error('Error archiving chat:', error);
            throw error;
        }
    }

    async unarchiveChat(instanceId, chatId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;

        try {
            await socket.chatModify({
                chatId,
                archive: false,
            });

            return { success: true, message: 'Chat unarchived successfully' };
        } catch (error) {
            console.error('Error unarchiving chat:', error);
            throw error;
        }
    }

    async unreadChat(instanceId, chatId) {
        // This method is not available in Baileys
        throw new Error('Unread chat method is not available');
    }

    // Additional Webhook Handlers
    async handleCallEvents(instanceId, callEvents) {
        try {
            for (const call of callEvents) {
                const callData = {
                    callId: call.id,
                    from: call.from,
                    fromName: call.pushName || call.from.split('@')[0],
                    isVideo: call.isVideo || false,
                    isGroup: call.isGroup || false,
                    timestamp: new Date().toISOString(),
                };

                if (call.status === 'offer') {
                    // Incoming call
                    await webhookService.triggerCallReceived(instanceId, callData);
                    console.log(`Call received from ${call.from}`);
                } else if (call.status === 'accept') {
                    // Call accepted
                    await webhookService.triggerCallAccepted(instanceId, callData);
                    console.log(`Call accepted from ${call.from}`);
                } else if (call.status === 'reject' || call.status === 'timeout') {
                    // Call rejected or timeout
                    callData.reason = call.status;
                    await webhookService.triggerCallRejected(instanceId, callData);
                    console.log(`Call ${call.status} from ${call.from}`);
                }
            }
        } catch (error) {
            console.error('Error handling call events:', error);
        }
    }

    async handleLabelEvents(instanceId, labelUpdate) {
        try {
            const { id, name, color, deleted } = labelUpdate;

            if (deleted) {
                // Label deleted
                await webhookService.triggerLabelDeleted(instanceId, {
                    labelId: id,
                    labelName: name,
                    timestamp: new Date().toISOString(),
                });
                console.log(`Label deleted: ${name}`);
            } else {
                // Label created or updated
                const action = labelUpdate.new ? 'created' : 'updated';
                await webhookService.triggerLabelUpsert(instanceId, {
                    labelId: id,
                    labelName: name,
                    labelColor: color || '#000000',
                    action,
                    timestamp: new Date().toISOString(),
                });
                console.log(`Label ${action}: ${name}`);
            }
        } catch (error) {
            console.error('Error handling label events:', error);
        }
    }

    async handleLabelAssociation(instanceId, labelAssociation) {
        try {
            const { chatId, labelId, type } = labelAssociation;
            const prisma = database.getInstance();

            // Get chat name
            const chat = await prisma.chat.findUnique({
                where: {
                    instanceId_chatId: {
                        instanceId,
                        chatId,
                    },
                },
            });

            const chatName = chat?.name || chatId.split('@')[0];

            if (type === 'add') {
                // Label added to chat
                await webhookService.triggerLabelChatAdded(instanceId, {
                    labelId,
                    labelName: labelId, // In real scenario, fetch label name
                    chatId,
                    chatName,
                    timestamp: new Date().toISOString(),
                });
                console.log(`Label ${labelId} added to chat ${chatId}`);
            } else if (type === 'remove') {
                // Label removed from chat
                await webhookService.triggerLabelChatDeleted(instanceId, {
                    labelId,
                    labelName: labelId,
                    chatId,
                    chatName,
                    timestamp: new Date().toISOString(),
                });
                console.log(`Label ${labelId} removed from chat ${chatId}`);
            }
        } catch (error) {
            console.error('Error handling label association:', error);
        }
    }

    // Group Webhook Handlers
    async handleGroupUpdate(instanceId, updates) {
        try {
            for (const update of updates) {
                const groupId = update.id;
                const instance = this.instances.get(instanceId);

                if (!instance || !instance.socket) continue;

                // Get group metadata
                try {
                    const groupMetadata = await instance.socket.groupMetadata(groupId);

                    // Trigger group.v2.update webhook
                    await webhookService.triggerGroupUpdate(instanceId, {
                        groupId,
                        groupName: groupMetadata.subject,
                        updates: {
                            subject: update.subject,
                            desc: update.desc,
                            announce: update.announce,
                            restrict: update.restrict,
                        },
                        updatedBy: update.author || 'unknown',
                        timestamp: new Date().toISOString(),
                    });

                    console.log(`Group ${groupId} updated`);
                } catch (error) {
                    console.error(`Error getting group metadata for ${groupId}:`, error);
                }
            }
        } catch (error) {
            console.error('Error handling group update:', error);
        }
    }

    async handleGroupParticipantsUpdate(instanceId, update) {
        try {
            const { id: groupId, participants, action, author } = update;
            const instance = this.instances.get(instanceId);

            if (!instance || !instance.socket) return;

            // Get group metadata
            try {
                const groupMetadata = await instance.socket.groupMetadata(groupId);

                // Determine which webhook to trigger based on action
                switch (action) {
                    case 'add':
                        // Trigger group.v2.join webhook
                        await webhookService.triggerGroupJoin(instanceId, {
                            groupId,
                            groupName: groupMetadata.subject,
                            participants: participants,
                            addedBy: author || 'unknown',
                            timestamp: new Date().toISOString(),
                        });
                        console.log(`Participants added to group ${groupId}:`, participants);
                        break;

                    case 'remove':
                        // Trigger group.v2.leave webhook
                        await webhookService.triggerGroupLeave(instanceId, {
                            groupId,
                            groupName: groupMetadata.subject,
                            participants: participants,
                            removedBy: author || 'unknown',
                            reason: 'removed',
                            timestamp: new Date().toISOString(),
                        });
                        console.log(`Participants removed from group ${groupId}:`, participants);
                        break;

                    case 'promote':
                    case 'demote':
                        // Trigger group.v2.participants webhook
                        await webhookService.triggerGroupParticipants(instanceId, {
                            groupId,
                            groupName: groupMetadata.subject,
                            action: action,
                            participants: participants,
                            actor: author || 'unknown',
                            timestamp: new Date().toISOString(),
                        });
                        console.log(`Participants ${action}d in group ${groupId}:`, participants);
                        break;

                    default:
                        // For any other action, trigger generic participants webhook
                        await webhookService.triggerGroupParticipants(instanceId, {
                            groupId,
                            groupName: groupMetadata.subject,
                            action: action,
                            participants: participants,
                            actor: author || 'unknown',
                            timestamp: new Date().toISOString(),
                        });
                        console.log(`Group ${groupId} participants action ${action}:`, participants);
                }
            } catch (error) {
                console.error(`Error getting group metadata for ${groupId}:`, error);
            }
        } catch (error) {
            console.error('Error handling group participants update:', error);
        }
    }
}

module.exports = new WhatsAppService();
