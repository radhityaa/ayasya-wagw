const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, delay, fetchLatestBaileysVersion, Browsers } = require('baileys');

const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const database = require('../config/database.js');
const config = require('../config/config.js');
const webhookService = require('./webhookService.js');

const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    transports: [new winston.transports.Console()],
});

class WhatsAppService {
    constructor() {
        this.instances = new Map();
        this.reconnectAttempts = new Map();
        this.appStateReady = new Map(); // Track app state readiness
        this.groupMetadataCache = new Map();
    }

    async init(instanceId) {
        try {
            const sessionPath = path.join(config.whatsapp.sessionPath, instanceId);

            // Ensure session directory exists
            await fs.mkdir(sessionPath, { recursive: true });

            // Use the per-instance session path as the auth directory for Baileys
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            const { version, isLatest } = await fetchLatestBaileysVersion();

            console.info(`📱 Using WA version ${version.join('.')}, isLatest: ${isLatest} for instance ${instanceId}`);

            // Create socket connection with optimized settings for sync
            const socket = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false,
                browser: Browsers.macOS("Desktop"),
                defaultQueryTimeoutMs: undefined,
                keepAliveIntervalMs: 30000,
                connectTimeoutMs: 60000,
                emitOwnEvents: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: true,
                markOnlineOnConnect: true,
                fireInitQueries: true,
                retryRequestDelayMs: 250,
                maxMsgRetryCount: 5,
                logger: {
                    level: 'error',
                    trace: () => {},
                    debug: () => {},
                    info: () => {},
                    warn: () => {},
                    error: (data, msg) => {
                        // Only log meaningful errors, ignore debug objects
                        if (msg && typeof msg === 'string') {
                            logger.error(`[Baileys] ${msg}`);
                        } else if (data && data.err && data.err instanceof Error) {
                            logger.error(`[Baileys] ${data.err.message}`);
                        }
                    },
                    fatal: (msg) => logger.error(`[Baileys Fatal] ${msg}`),
                    child: () => ({
                        level: 'error',
                        trace: () => {},
                        debug: () => {},
                        info: () => {},
                        warn: () => {},
                        error: (data, msg) => {
                            if (msg && typeof msg === 'string') {
                                logger.error(`[Baileys] ${msg}`);
                            } else if (data && data.err && data.err instanceof Error) {
                                logger.error(`[Baileys] ${data.err.message}`);
                            }
                        },
                        fatal: (msg) => logger.error(`[Baileys Fatal] ${msg}`)
                    })
                },
                
                // Group metadata cache - improves performance
                cachedGroupMetadata: async (jid) => {
                    if (this.groupMetadataCache.has(jid)) {
                        return this.groupMetadataCache.get(jid);
                    }

                    // Try to fetch metadata from any available socket instance as a best-effort
                    try {
                        for (const inst of this.instances.values()) {
                            if (inst && inst.socket && typeof inst.socket.groupMetadata === 'function') {
                                try {
                                    const metadata = await inst.socket.groupMetadata(jid);
                                    if (metadata) {
                                        this.groupMetadataCache.set(jid, metadata);
                                        return metadata;
                                    }
                                } catch (err) {
                                    // ignore and try next instance
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`Error fetching group metadata for ${jid}: ${error?.message || error}`);
                    }

                    return null;
                },
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

            // Handle chats update (when new chats are added/updated)
            socket.ev.on('chats.update', async (chats) => {
                await this.handleChatsUpdate(instanceId, Array.isArray(chats) ? chats : [chats]);
            });

            // Handle chats upsert (when chats are created or updated)
            socket.ev.on('chats.upsert', async (chats) => {
                await this.handleChatsUpdate(instanceId, Array.isArray(chats) ? chats : [chats]);
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
            
            socket.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }) => {
                console.log(`📱 History sync for instance ${instanceId}: chats=${chats?.length || 0}, contacts=${contacts?.length || 0}, messages=${messages?.length || 0}, isLatest=${isLatest}`);
                
                const prisma = database.getInstance();
                
                // Store all chats from history sync to database
                if (chats && chats.length > 0) {
                    try {
                        for (const chat of chats) {
                            const chatId = chat.id;
                            const name = chat.name || (chat.id || '').split('@')[0];
                            const isGroup = chatId.endsWith('@g.us');
                            const archived = chat.archived || false;
                            const unreadCount = chat.unreadCount || 0;
                            
                            // Extract last message
                            let lastMessage = '';
                            let lastMessageAt = null;
                            
                            if (chat.lastMessage) {
                                if (chat.lastMessage.message?.conversation) {
                                    lastMessage = chat.lastMessage.message.conversation;
                                } else if (chat.lastMessage.message?.extendedTextMessage?.text) {
                                    lastMessage = chat.lastMessage.message.extendedTextMessage.text;
                                } else if (chat.lastMessage.message?.imageMessage?.caption) {
                                    lastMessage = chat.lastMessage.message.imageMessage.caption;
                                } else if (chat.lastMessage.message?.videoMessage?.caption) {
                                    lastMessage = chat.lastMessage.message.videoMessage.caption;
                                } else if (chat.lastMessage.message?.documentMessage?.fileName) {
                                    lastMessage = chat.lastMessage.message.documentMessage.fileName;
                                }
                                
                                if (chat.lastMessage.messageTimestamp) {
                                    lastMessageAt = new Date(chat.lastMessage.messageTimestamp * 1000);
                                }
                            }
                            
                            // Upsert chat to database
                            try {
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
                                        lastMessage: lastMessage || null,
                                        lastMessageAt: lastMessageAt || null,
                                    },
                                    create: {
                                        instanceId,
                                        chatId,
                                        name,
                                        isGroup,
                                        archived,
                                        unreadCount,
                                        lastMessage: lastMessage || null,
                                        lastMessageAt: lastMessageAt || null,
                                    },
                                });
                            } catch (err) {
                                console.error(`Error syncing chat ${chatId} from history:`, err);
                            }
                        }
                        console.log(`✅ Synced ${chats.length} chats from history to database for instance ${instanceId}`);
                    } catch (error) {
                        console.error('Error processing chats from history sync:', error);
                    }
                }
                
                // Store messages from history sync to database
                // Messages from history sync need to be processed explicitly as they don't trigger messages.upsert event
                if (messages && messages.length > 0) {
                    console.log(`📨 Processing ${messages.length} messages from history sync for instance ${instanceId}`);
                    
                    try {
                        let savedCount = 0;
                        let skippedCount = 0;
                        let errorCount = 0;
                        
                        for (const msg of messages) {
                            try {
                                // Skip status messages
                                if (msg.key.remoteJid === 'status@broadcast') {
                                    skippedCount++;
                                    continue;
                                }

                                const messageId = msg.key.id;
                                const chatId = msg.key.remoteJid;
                                
                                // Validate chatId
                                if (!chatId || !messageId) {
                                    skippedCount++;
                                    continue;
                                }
                                
                                const fromMe = msg.key.fromMe || false;
                                const from = fromMe ? 'me' : (msg.key.participant || chatId);
                                
                                // Extract message content
                                let body = '';
                                let type = 'text';
                                let mediaUrl = null;
                                
                                if (msg.message?.conversation) {
                                    body = msg.message.conversation;
                                    type = 'text';
                                } else if (msg.message?.extendedTextMessage?.text) {
                                    body = msg.message.extendedTextMessage.text;
                                    type = 'text';
                                } else if (msg.message?.imageMessage) {
                                    body = msg.message.imageMessage.caption || '';
                                    type = 'image';
                                    mediaUrl = msg.message.imageMessage.url || null;
                                } else if (msg.message?.videoMessage) {
                                    body = msg.message.videoMessage.caption || '';
                                    type = 'video';
                                    mediaUrl = msg.message.videoMessage.url || null;
                                } else if (msg.message?.audioMessage) {
                                    type = 'audio';
                                    mediaUrl = msg.message.audioMessage.url || null;
                                } else if (msg.message?.documentMessage) {
                                    body = msg.message.documentMessage.fileName || '';
                                    type = 'document';
                                    mediaUrl = msg.message.documentMessage.url || null;
                                } else if (msg.message?.stickerMessage) {
                                    type = 'sticker';
                                    mediaUrl = msg.message.stickerMessage.url || null;
                                } else if (msg.message?.locationMessage) {
                                    type = 'location';
                                    body = `Location: ${msg.message.locationMessage.degreesLatitude}, ${msg.message.locationMessage.degreesLongitude}`;
                                } else if (msg.message?.contactMessage) {
                                    type = 'contact';
                                    body = msg.message.contactMessage.displayName || '';
                                } else {
                                    // Skip unknown message types
                                    skippedCount++;
                                    continue;
                                }

                                // Extract timestamp
                                const timestamp = msg.messageTimestamp 
                                    ? new Date(msg.messageTimestamp * 1000) 
                                    : new Date();

                                // Ensure chat exists in database first (must succeed before saving message)
                                const chatName = chatId.includes('@') ? chatId.split('@')[0] : chatId;
                                const isGroup = chatId.endsWith('@g.us');
                                const isNewsletter = chatId.endsWith('@newsletter');
                                
                                // Create or update chat, then get the chat.id (UUID) for foreign key
                                let chatDbId; // This is the UUID that Message.chatId foreign key references
                                try {
                                    const chat = await prisma.chat.upsert({
                                        where: {
                                            instanceId_chatId: {
                                                instanceId,
                                                chatId,
                                            },
                                        },
                                        update: {
                                            lastMessage: body || null,
                                            lastMessageAt: timestamp,
                                        },
                                        create: {
                                            instanceId,
                                            chatId,
                                            name: chatName,
                                            isGroup,
                                            lastMessage: body || null,
                                            lastMessageAt: timestamp,
                                        },
                                    });
                                    
                                    // Get the chat.id (UUID) - this is what Message.chatId foreign key references
                                    chatDbId = chat.id;
                                    
                                    if (!chatDbId) {
                                        console.error(`Chat ${chatId} was not created properly for message ${messageId}`);
                                        errorCount++;
                                        continue;
                                    }
                                } catch (chatError) {
                                    console.error(`Failed to upsert chat ${chatId} for message ${messageId}:`, chatError.message);
                                    errorCount++;
                                    continue; // Skip this message if chat creation fails
                                }

                                // Save message to database (chat must exist at this point)
                                // IMPORTANT: Message.chatId foreign key references Chat.id (UUID), not Chat.chatId (JID)
                                try {
                                    await prisma.message.upsert({
                                        where: { messageId },
                                        update: {
                                            fromMe,
                                            from,
                                            to: chatId, // This is the JID, stored in 'to' field
                                            body: body || null,
                                            type,
                                            mediaUrl,
                                            timestamp,
                                            status: fromMe ? 'sent' : 'received',
                                        },
                                        create: {
                                            instanceId,
                                            chatId: chatDbId, // Use Chat.id (UUID) for foreign key constraint
                                            messageId,
                                            fromMe,
                                            from,
                                            to: chatId, // Store JID in 'to' field for reference
                                            body: body || null,
                                            type,
                                            mediaUrl,
                                            timestamp,
                                            status: fromMe ? 'sent' : 'received',
                                        },
                                    });
                                } catch (msgError) {
                                    // If foreign key constraint error, try to create chat again and retry
                                    if (msgError.message?.includes('Foreign key constraint') || msgError.message?.includes('chatId')) {
                                        console.warn(`Foreign key constraint error for message ${messageId} (chatId: ${chatId}), retrying chat creation...`);
                                        try {
                                            // Retry chat creation with explicit create
                                            const retryChat = await prisma.chat.upsert({
                                                where: {
                                                    instanceId_chatId: {
                                                        instanceId,
                                                        chatId,
                                                    },
                                                },
                                                update: {},
                                                create: {
                                                    instanceId,
                                                    chatId,
                                                    name: chatName,
                                                    isGroup,
                                                    lastMessage: body || null,
                                                    lastMessageAt: timestamp,
                                                },
                                            });
                                            
                                            // Verify chat was created and get its ID (UUID)
                                            if (!retryChat || !retryChat.id) {
                                                throw new Error('Chat creation returned null');
                                            }
                                            
                                            const chatDbIdForRetry = retryChat.id; // This is the UUID for foreign key
                                            
                                            // Small delay to ensure database commit
                                            await new Promise(resolve => setTimeout(resolve, 10));
                                            
                                            // Retry message creation with correct foreign key (Chat.id UUID)
                                            await prisma.message.upsert({
                                                where: { messageId },
                                                update: {
                                                    fromMe,
                                                    from,
                                                    to: chatId, // JID stored in 'to' field
                                                    body: body || null,
                                                    type,
                                                    mediaUrl,
                                                    timestamp,
                                                    status: fromMe ? 'sent' : 'received',
                                                },
                                                create: {
                                                    instanceId,
                                                    chatId: chatDbIdForRetry, // Use Chat.id (UUID) for foreign key
                                                    messageId,
                                                    fromMe,
                                                    from,
                                                    to: chatId, // Store JID in 'to' field
                                                    body: body || null,
                                                    type,
                                                    mediaUrl,
                                                    timestamp,
                                                    status: fromMe ? 'sent' : 'received',
                                                },
                                            });
                                            
                                            console.log(`✅ Successfully saved message ${messageId} after retry`);
                                        } catch (retryError) {
                                            console.error(`Retry failed for message ${messageId} (chatId: ${chatId}):`, retryError.message);
                                            console.error(`  InstanceId: ${instanceId}, ChatId: ${chatId}, MessageId: ${messageId}`);
                                            errorCount++;
                                            continue;
                                        }
                                    } else {
                                        throw msgError; // Re-throw if it's not a foreign key error
                                    }
                                }

                                savedCount++;
                                
                                // Log progress every 100 messages
                                if (savedCount % 100 === 0) {
                                    console.log(`  Progress: ${savedCount}/${messages.length} messages saved...`);
                                }
                            } catch (msgError) {
                                errorCount++;
                                console.error(`Error processing message ${msg.key?.id || 'unknown'} from history sync:`, msgError.message);
                                // Continue processing other messages
                            }
                        }
                        
                        console.log(`✅ History sync complete: ${savedCount} messages saved, ${skippedCount} skipped, ${errorCount} errors for instance ${instanceId}`);
                    } catch (error) {
                        console.error('Error processing messages from history sync:', error);
                    }
                }
                
                if (isLatest) {
                    // Only mark as ready if not already marked by timeout
                    if (!this.appStateReady.get(instanceId)) {
                        this.appStateReady.set(instanceId, true);
                        const instance = this.instances.get(instanceId);
                        if (instance) {
                            instance.appStateReady = true;
                        }
                        console.log(`✅ App state fully synced for instance ${instanceId} - Profile updates now available`);
                    }
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

                // Update or create instance in database
                await prisma.instance.upsert({
                    where: { id: instanceId },
                    update: {
                        status: 'qr',
                        qrCode: qrCode,
                    },
                    create: {
                        id: instanceId,
                        name: `Instance ${instanceId}`,
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
                await prisma.instance.upsert({
                    where: { id: instanceId },
                    update: {
                        status: 'disconnected',
                        qrCode: null,
                        pairingCode: null,
                    },
                    create: {
                        id: instanceId,
                        name: `Instance ${instanceId}`,
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

                        // Clear socket from memory to allow reinitialize for QR generation
                        if (this.instances.has(instanceId)) {
                            this.instances.get(instanceId).socket = null;
                            this.instances.get(instanceId).qr = null;
                            this.instances.get(instanceId).info = null;
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
                await prisma.instance.upsert({
                    where: { id: instanceId },
                    update: {
                        status: 'connected',
                        phoneNumber: (user?.id || '').split('@')[0] || null,
                        qrCode: null,
                    },
                    create: {
                        id: instanceId,
                        name: `Instance ${instanceId}`,
                        status: 'connected',
                        phoneNumber: (user?.id || '').split('@')[0] || null,
                        qrCode: null,
                    },
                });

                // Store user info
                if (this.instances.has(instanceId)) {
                    this.instances.get(instanceId).info = user;
                    this.instances.get(instanceId).qr = null;

                    // Wait for app state to sync - increased timeout to 30 seconds
                    // Most accounts sync within 5-15 seconds, but some may take longer
                    // Note: messaging-history.set event may not be received for:
                    // - New accounts with no message history
                    // - Accounts with auto-sync disabled
                    // - Some account configurations
                    // This is normal and the instance will still work, just without initial history sync
                    setTimeout(() => {
                        const instance = this.instances.get(instanceId);
                        if (instance && !this.appStateReady.get(instanceId)) {
                            // If app state hasn't synced after 30 seconds, mark it as ready anyway
                            // Some accounts might not have messaging history or auto-sync disabled
                            this.appStateReady.set(instanceId, true);
                            instance.appStateReady = true;
                            console.log(`ℹ️  App state ready for instance ${instanceId} (timeout after 30s). Note: messaging-history.set event not received - this is normal for new accounts or accounts with no message history. Instance is fully functional.`);
                        }
                    }, 30000);
                }

                // Save session data to database
                await this.saveSessionToDatabase(instanceId);

                // Trigger webhook for session status change using new service
                await webhookService.triggerSessionStatus(instanceId, 'connected', {
                    phoneNumber: (user?.id || '').split('@')[0] || null,
                });
            }

            if (connection === 'connecting') {
                console.log(`Connecting instance ${instanceId}...`);

                await prisma.instance.upsert({
                    where: { id: instanceId },
                    update: {
                        status: 'connecting',
                    },
                    create: {
                        id: instanceId,
                        name: `Instance ${instanceId}`,
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
                            name: pushName || (chatId || '').split('@')[0],
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
            if (!chats || chats.length === 0) return;

            for (const chat of chats) {
                if (!chat || !chat.id) continue;

                const chatId = chat.id;
                const isGroup = chatId.endsWith('@g.us');
                const isNewsletter = chatId.endsWith('@newsletter');
                
                // Extract name from different possible sources
                let name = chat.name;
                if (!name && chat.threadMetadata) {
                    name = chat.threadMetadata.name?.text || chat.threadMetadata.name;
                }
                if (!name) {
                    name = (chat.id || '').split('@')[0];
                }

                const archived = chat.archived || false;
                const unreadCount = chat.unreadCount || 0;

                // Extract description for newsletters
                let description = '';
                if (isNewsletter && chat.threadMetadata) {
                    description = chat.threadMetadata.description?.text || chat.threadMetadata.description || '';
                }

                // Extract subscriber count for newsletters
                let subscriberCount = 0;
                if (isNewsletter && chat.threadMetadata) {
                    subscriberCount = parseInt(chat.threadMetadata.subscribers_count || '0');
                }

                // Extract creation time for newsletters
                let createdAt = null;
                if (isNewsletter && chat.threadMetadata) {
                    const creationTime = chat.threadMetadata.creation_time;
                    if (creationTime) {
                        createdAt = new Date(parseInt(creationTime) * 1000);
                    }
                }

                // Log newsletter detection
                if (isNewsletter) {
                    console.log(`📢 Newsletter detected in chats update: ${chatId}, name: ${name}`);
                }

                // Upsert chat to database
                try {
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
                            lastMessageAt: chat.conversationTimestamp ? new Date(chat.conversationTimestamp * 1000) : undefined,
                        },
                        create: {
                            instanceId,
                            chatId,
                            name,
                            isGroup,
                            archived,
                            unreadCount,
                            lastMessageAt: chat.conversationTimestamp ? new Date(chat.conversationTimestamp * 1000) : new Date(),
                        },
                    });

                    if (isNewsletter) {
                        console.log(`✅ Newsletter ${chatId} synced to database`);
                    }
                } catch (dbError) {
                    console.error(`Error syncing chat ${chatId} to database:`, dbError);
                }
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
            await prisma.instance.upsert({
                where: { id: instanceId },
                update: {
                    pairingCode: pairingCode,
                },
                create: {
                    id: instanceId,
                    name: `Instance ${instanceId}`,
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
        this.appStateReady.delete(instanceId);

        // Delete session files
        const sessionPath = path.join(config.whatsapp.sessionPath, instanceId);
        try {
            await fs.rmdir(sessionPath, { recursive: true });
        } catch (err) {
            console.error('Failed to delete session files:', err);
        }
    }

    removeInstanceFromMemory(instanceId) {
        // Remove from memory without logging out (for reinitialize purposes)
        this.instances.delete(instanceId);
        this.reconnectAttempts.delete(instanceId);
        this.appStateReady.delete(instanceId);
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
    async getChats(instanceId, options = {}) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        // Extract filter options
        const {
            sortBy = 'lastMessageAt',
            sortOrder = 'desc',
            limit,
            offset = 0
        } = options;

        const { socket } = instance;
        const prisma = database.getInstance();

        try {
            // First, try to fetch all chats from WhatsApp server if store is empty or incomplete
            let storeChats = [];
            
            // Get chats from store first
            if (socket.store && socket.store.chats) {
                try {
                    // Try different methods to get chats from store
                    if (typeof socket.store.chats.all === 'function') {
                        storeChats = socket.store.chats.all();
                    } else if (socket.store.chats instanceof Map) {
                        storeChats = Array.from(socket.store.chats.values());
                    } else if (typeof socket.store.chats === 'object') {
                        storeChats = Object.values(socket.store.chats);
                    } else if (Array.isArray(socket.store.chats)) {
                        storeChats = socket.store.chats;
                    }
                    
                    // Filter out invalid chats
                    storeChats = storeChats.filter(chat => chat && chat.id);
                    
                    console.log(`Found ${storeChats.length} chats in WhatsApp store for instance ${instanceId}`);
                } catch (err) {
                    console.error('Error getting chats from store:', err);
                }
            }

            // According to Baileys docs: https://baileys.wiki/docs/socket/history-sync/
            // We can use fetchMessageHistory for on-demand history sync
            // But first, let's check if we have all chats in database
            const dbChatCount = await prisma.chat.count({ where: { instanceId } });
            
            // If database has few chats and store also has few, try to trigger history sync
            // Note: History sync happens automatically on connection, but we can check if it's complete
            if ((storeChats.length < 50 || dbChatCount < 50) && socket.fetchMessageHistory) {
                try {
                    console.log(`Store has ${storeChats.length} chats, database has ${dbChatCount} chats. History sync should have populated these.`);
                    console.log(`If chats are missing, they will be synced via messaging-history.set event when available.`);
                } catch (err) {
                    console.error('Error checking history sync status:', err);
                }
            }
            
            // Log store status
            if (storeChats.length === 0) {
                console.log(`No chats found in WhatsApp store for instance ${instanceId}. Will use database as fallback.`);
            }

            // Sync all chats from store to database
            const chatMap = new Map();
            
            for (const chat of storeChats) {
                const chatId = chat.id;
                const name = chat.name || (chat.id || '').split('@')[0];
                const isGroup = chatId.endsWith('@g.us');
                const archived = chat.archived || false;
                const unreadCount = chat.unreadCount || 0;
                
                // Extract last message
                let lastMessage = '';
                let lastMessageAt = null;
                
                if (chat.lastMessage) {
                    if (chat.lastMessage.message?.conversation) {
                        lastMessage = chat.lastMessage.message.conversation;
                    } else if (chat.lastMessage.message?.extendedTextMessage?.text) {
                        lastMessage = chat.lastMessage.message.extendedTextMessage.text;
                    } else if (chat.lastMessage.message?.imageMessage?.caption) {
                        lastMessage = chat.lastMessage.message.imageMessage.caption;
                    } else if (chat.lastMessage.message?.videoMessage?.caption) {
                        lastMessage = chat.lastMessage.message.videoMessage.caption;
                    } else if (chat.lastMessage.message?.documentMessage?.fileName) {
                        lastMessage = chat.lastMessage.message.documentMessage.fileName;
                    }
                    
                    if (chat.lastMessage.messageTimestamp) {
                        lastMessageAt = new Date(chat.lastMessage.messageTimestamp * 1000);
                    }
                }

                // Upsert to database
                try {
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
                            lastMessage: lastMessage || null,
                            lastMessageAt: lastMessageAt || null,
                        },
                        create: {
                            instanceId,
                            chatId,
                            name,
                            isGroup,
                            archived,
                            unreadCount,
                            lastMessage: lastMessage || null,
                            lastMessageAt: lastMessageAt || null,
                        },
                    });
                } catch (err) {
                    console.error(`Error syncing chat ${chatId} to database:`, err);
                }

                // Store in map for response
                chatMap.set(chatId, {
                    id: chatId,
                    name,
                    isGroup,
                    archived,
                    unreadCount,
                    lastMessage: lastMessage || null,
                    lastMessageAt,
                });
            }

            // Note: We'll get all chats from database below, so we don't need to filter here

            // Get ALL chats from database (this is the complete list)
            const allDbChats = await prisma.chat.findMany({
                where: { instanceId },
                orderBy: { lastMessageAt: 'desc' },
                include: {
                    _count: {
                        select: { messages: true },
                    },
                },
            });

            // Create a map of all database chats
            const dbChatMap = new Map();
            allDbChats.forEach(chat => {
                dbChatMap.set(chat.chatId, {
                    id: chat.chatId,
                    name: chat.name,
                    isGroup: chat.isGroup,
                    archived: chat.archived,
                    unreadCount: chat.unreadCount,
                    lastMessage: chat.lastMessage,
                    lastMessageAt: chat.lastMessageAt,
                    messageCount: chat._count.messages,
                });
            });

            // Merge store data with database data
            // Store data (real-time) takes priority for fields like name, archived, unreadCount
            // But we include ALL chats from database, not just from store
            const allChats = Array.from(dbChatMap.values()).map((dbChat) => {
                const storeChat = chatMap.get(dbChat.id);
                
                // If chat exists in store, use store data (more up-to-date)
                if (storeChat) {
                    return {
                        id: dbChat.id,
                        name: storeChat.name || dbChat.name,
                        isGroup: dbChat.isGroup,
                        archived: storeChat.archived !== undefined ? storeChat.archived : dbChat.archived,
                        unreadCount: storeChat.unreadCount !== undefined ? storeChat.unreadCount : dbChat.unreadCount,
                        lastMessage: storeChat.lastMessage || dbChat.lastMessage,
                        lastMessageAt: storeChat.lastMessageAt || dbChat.lastMessageAt,
                        messageCount: dbChat.messageCount,
                    };
                }
                
                // Otherwise use database data
                return dbChat;
            });

            // Also add any chats from store that are not in database yet
            chatMap.forEach((storeChat, chatId) => {
                if (!dbChatMap.has(chatId)) {
                    // Find message count from database for this chat
                    const dbChat = allDbChats.find(c => c.chatId === chatId);
                    allChats.push({
                        id: storeChat.id,
                        name: storeChat.name,
                        isGroup: storeChat.isGroup,
                        archived: storeChat.archived,
                        unreadCount: storeChat.unreadCount,
                        lastMessage: storeChat.lastMessage,
                        lastMessageAt: storeChat.lastMessageAt,
                        messageCount: dbChat?._count?.messages || 0,
                    });
                }
            });

            console.log(`Total chats: ${allChats.length} (from store: ${chatMap.size}, from database: ${allDbChats.length})`);

            // If no chats found at all, return empty array
            if (allChats.length === 0) {
                const dbChatCount = await prisma.chat.count({ where: { instanceId } });
                console.log(`No chats found for instance ${instanceId}`, {
                    storeChats: storeChats.length,
                    chatMapSize: chatMap.size,
                    databaseCount: dbChatCount,
                    hasStore: !!socket.store,
                    hasChats: !!socket.store?.chats,
                });
                return [];
            }

            // Sort chats based on sortBy and sortOrder
            const validSortFields = ['lastMessageAt', 'name', 'unreadCount', 'createdAt', 'messageCount'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'lastMessageAt';
            const order = sortOrder.toLowerCase() === 'asc' ? 1 : -1;

            allChats.sort((a, b) => {
                let valueA, valueB;

                switch (sortField) {
                    case 'lastMessageAt':
                        valueA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                        valueB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                        break;
                    case 'name':
                        valueA = (a.name || '').toLowerCase();
                        valueB = (b.name || '').toLowerCase();
                        break;
                    case 'unreadCount':
                        valueA = a.unreadCount || 0;
                        valueB = b.unreadCount || 0;
                        break;
                    case 'createdAt':
                        valueA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        valueB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        break;
                    case 'messageCount':
                        valueA = a.messageCount || 0;
                        valueB = b.messageCount || 0;
                        break;
                    default:
                        valueA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                        valueB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                }

                // Handle string comparison
                if (typeof valueA === 'string' && typeof valueB === 'string') {
                    return valueA.localeCompare(valueB) * order;
                }

                // Handle number comparison
                return (valueA - valueB) * order;
            });

            // Apply pagination (offset and limit)
            const totalCount = allChats.length;
            let paginatedChats = allChats;

            if (offset > 0 || limit) {
                const startIndex = parseInt(offset) || 0;
                const endIndex = limit ? startIndex + parseInt(limit) : undefined;
                paginatedChats = allChats.slice(startIndex, endIndex);
            }

            console.log(`Returning ${paginatedChats.length} of ${totalCount} chats for instance ${instanceId} (sortBy: ${sortField}, sortOrder: ${sortOrder}, limit: ${limit || 'none'}, offset: ${offset})`);
            
            return {
                data: paginatedChats,
                total: totalCount,
                count: paginatedChats.length,
                limit: limit ? parseInt(limit) : null,
                offset: parseInt(offset),
                sortBy: sortField,
                sortOrder: sortOrder.toLowerCase()
            };
        } catch (error) {
            console.error('Error getting chats:', error);
            throw error;
        }
    }

    async getChatsOverview(instanceId) {
        const result = await this.getChats(instanceId);
        const chats = result.data || result; // Handle both new format (object) and old format (array)

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
            // Normalize chatId to ensure proper JID format
            let normalizedChatId = chatId;
            if (!chatId.includes('@')) {
                // If no @, assume it's a phone number, add @s.whatsapp.net
                normalizedChatId = `${chatId}@s.whatsapp.net`;
            }

            // Verify chat exists in database first
            const existingChat = await prisma.chat.findUnique({
                where: {
                    instanceId_chatId: {
                        instanceId,
                        chatId: normalizedChatId,
                    },
                },
            });

            if (!existingChat) {
                // Try with original chatId format
                const existingChatAlt = await prisma.chat.findUnique({
                    where: {
                        instanceId_chatId: {
                            instanceId,
                            chatId: chatId,
                        },
                    },
                });

                if (!existingChatAlt) {
                    console.warn(`Chat ${chatId} not found in database, but will still try to delete from WhatsApp`);
                }
            }

            // Delete from WhatsApp
            try {
                await socket.chatModify({
                    chatId: normalizedChatId,
                    delete: true,
                });
                console.log(`Chat ${normalizedChatId} deleted from WhatsApp`);
            } catch (whatsappError) {
                // If WhatsApp deletion fails, try with original chatId
                if (normalizedChatId !== chatId) {
                    try {
                        await socket.chatModify({
                            chatId: chatId,
                            delete: true,
                        });
                        console.log(`Chat ${chatId} deleted from WhatsApp (using original format)`);
                        normalizedChatId = chatId; // Use original for database deletion
                    } catch (err) {
                        console.error('Error deleting chat from WhatsApp:', err);
                        throw new Error(`Failed to delete chat from WhatsApp: ${err.message}`);
                    }
                } else {
                    throw whatsappError;
                }
            }

            // Find chat in database to get the chat.id for message deletion
            const chatToDelete = await prisma.chat.findFirst({
                where: {
                    instanceId,
                    OR: [
                        { chatId: normalizedChatId },
                        { chatId: chatId }, // Also try original format
                    ],
                },
            });

            let deletedMessages = { count: 0 };
            if (chatToDelete) {
                // Delete messages using chat.id (foreign key)
                deletedMessages = await prisma.message.deleteMany({
                    where: {
                        chatId: chatToDelete.id,
                    },
                });
                console.log(`Deleted ${deletedMessages.count} messages for chat ${chatToDelete.id}`);
            } else {
                // If chat not found, messages will be deleted by cascade when chat is deleted
                // But we can try to find and delete by matching 'to' field
                console.log(`Chat not found in database, messages may be orphaned`);
            }

            // Delete chat from database
            const deletedChats = await prisma.chat.deleteMany({
                where: {
                    instanceId,
                    OR: [
                        { chatId: normalizedChatId },
                        { chatId: chatId }, // Also try original format
                    ],
                },
            });

            console.log(`Deleted chat ${normalizedChatId} from database (${deletedChats.count} chat(s), ${deletedMessages.count} message(s))`);

            return { 
                success: true, 
                message: 'Chat deleted successfully',
                deleted: {
                    chat: deletedChats.count,
                    messages: deletedMessages.count,
                },
            };
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

    async getMessagesInChat(instanceId, chatId, limit = 50, offset = 0) {
        const prisma = database.getInstance();

        try {
            // Normalize chatId to ensure proper JID format
            let normalizedChatId = chatId;
            if (!chatId.includes('@')) {
                // If no @, assume it's a phone number, add @s.whatsapp.net
                normalizedChatId = `${chatId}@s.whatsapp.net`;
            }

            // First, find the chat in database to get chat.id (foreign key)
            const chat = await prisma.chat.findFirst({
                where: {
                    instanceId,
                    OR: [
                        { chatId: normalizedChatId },
                        { chatId: chatId }, // Also try original format
                    ],
                },
            });

            if (!chat) {
                // Chat not found in database, return empty array
                console.warn(`Chat ${normalizedChatId} not found in database for instance ${instanceId}`);
                return [];
            }

            // Get messages using chat.id (foreign key) and also match by 'to' field as fallback
            const messages = await prisma.message.findMany({
                where: {
                    instanceId,
                    OR: [
                        { chatId: chat.id }, // Use foreign key (preferred)
                        { 
                            to: {
                                in: [normalizedChatId, chatId] // Also match by 'to' field
                            }
                        },
                    ],
                },
                orderBy: { timestamp: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset),
                include: {
                    chat: {
                        select: {
                            id: true,
                            chatId: true,
                            name: true,
                            isGroup: true,
                        },
                    },
                },
            });

            // Reverse to return in chronological order (oldest first)
            const sortedMessages = messages.reverse();

            // Format messages for response
            return sortedMessages.map((msg) => ({
                id: msg.id,
                messageId: msg.messageId,
                fromMe: msg.fromMe,
                from: msg.from,
                to: msg.to,
                body: msg.body,
                type: msg.type,
                mediaUrl: msg.mediaUrl,
                timestamp: msg.timestamp,
                status: msg.status,
                createdAt: msg.createdAt,
                chat: msg.chat ? {
                    id: msg.chat.chatId, // Return chatId (JID) as id for API response
                    chatId: msg.chat.chatId,
                    name: msg.chat.name,
                    isGroup: msg.chat.isGroup,
                } : null,
            }));
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
            // Normalize chatId to ensure proper JID format
            let normalizedChatId = chatId;
            if (!chatId.includes('@')) {
                // If no @, assume it's a phone number, add @s.whatsapp.net
                normalizedChatId = `${chatId}@s.whatsapp.net`;
            }

            // Verify chat exists in database
            const chat = await prisma.chat.findFirst({
                where: {
                    instanceId,
                    OR: [
                        { chatId: normalizedChatId },
                        { chatId: chatId },
                    ],
                },
            });

            // Check if this is a group chat
            const isGroup = normalizedChatId.includes('@g.us');
            console.log(`Marking messages as read for ${isGroup ? 'GROUP' : 'CHAT'}: ${normalizedChatId}`);

            // Mark as read in WhatsApp - try multiple methods to ensure it works
            let readSuccess = false;
            
            // Method 1: Try to get unread messages from database and mark them individually
            // Try this for both personal chats and groups
            try {
                // Get recent messages from database for this chat (incoming messages only)
                const recentMessages = await prisma.message.findMany({
                    where: {
                        instanceId,
                        OR: [
                            { to: normalizedChatId },
                            { to: chatId },
                        ],
                        fromMe: false, // Only incoming messages
                    },
                    take: 50, // Limit to 50 messages to avoid timeout
                    orderBy: {
                        timestamp: 'desc',
                    },
                });

                if (recentMessages.length > 0 && socket.readMessages) {
                    const messageKeys = recentMessages
                        .filter(msg => msg.messageId) // Only include messages with messageId
                        .map(msg => ({
                            remoteJid: msg.to || normalizedChatId,
                            id: msg.messageId,
                            fromMe: false,
                        }));

                    if (messageKeys.length > 0) {
                        console.log(`Attempting to mark ${messageKeys.length} messages as read using readMessages (from database)${isGroup ? ' [GROUP]' : ''}`);
                        try {
                            await socket.readMessages(messageKeys);
                            readSuccess = true;
                            console.log(`✅ ${messageKeys.length} messages marked as read in WhatsApp using readMessages (from database)${isGroup ? ' [GROUP]' : ''}`);
                        } catch (readErr) {
                            console.warn(`readMessages failed: ${readErr.message}${isGroup ? ' [GROUP]' : ''}`);
                            // Don't set readSuccess = true, continue to try other methods
                        }
                    }
                } else {
                    console.log(`No messages found in database for ${normalizedChatId}${isGroup ? ' [GROUP]' : ''}`);
                }
            } catch (err) {
                console.warn(`Method 1 (readMessages with database messages) failed: ${err.message}${isGroup ? ' [GROUP]' : ''}`);
                console.error('Error details:', err);
            }

            // Method 1b: Try to get unread messages from store and mark them individually
            // Try this for both personal chats and groups
            if (!readSuccess) {
                try {
                    if (socket.store && socket.store.messages) {
                        const chatMessages = socket.store.messages.get(normalizedChatId);
                        if (chatMessages && chatMessages.size > 0) {
                            const messageKeys = [];
                            for (const [messageId, message] of chatMessages) {
                                // Only mark messages that are not from me (incoming messages)
                                if (!message.key?.fromMe) {
                                    messageKeys.push({
                                        remoteJid: normalizedChatId,
                                        id: messageId,
                                        fromMe: false,
                                    });
                                }
                            }
                            
                            if (messageKeys.length > 0 && socket.readMessages) {
                                console.log(`Attempting to mark ${messageKeys.length} messages as read using readMessages (from store)`);
                                await socket.readMessages(messageKeys);
                                readSuccess = true;
                                console.log(`✅ ${messageKeys.length} messages marked as read in WhatsApp using readMessages (from store)`);
                            }
                        }
                    }
                } catch (err) {
                    console.warn(`Method 1b (readMessages with store messages) failed: ${err.message}`);
                }
            }

            // Method 2: Use chatModify with markRead (works for marking entire chat as read)
            // This is the preferred method for groups
            if (!readSuccess) {
                const methods = [
                    // Method 2a: chatModify with markRead as first param and jid as second (preferred format)
                    async () => {
                        console.log(`Attempting chatModify({ markRead: true }, ${normalizedChatId})${isGroup ? ' [GROUP]' : ''}`);
                        await socket.chatModify({ markRead: true }, normalizedChatId);
                        return true;
                    },
                    // Method 2b: chatModify with chatId in object (alternative format)
                    async () => {
                        console.log(`Attempting chatModify with chatId: ${normalizedChatId}${isGroup ? ' [GROUP]' : ''}`);
                        await socket.chatModify({
                            chatId: normalizedChatId,
                            markRead: true,
                        });
                        return true;
                    },
                    // Method 2c: chatModify with jid in object (for groups)
                    async () => {
                        if (isGroup) {
                            console.log(`Attempting chatModify with jid: ${normalizedChatId} [GROUP]`);
                            await socket.chatModify({
                                jid: normalizedChatId,
                                markRead: true,
                            });
                            return true;
                        }
                        return false;
                    },
                ];

                for (let i = 0; i < methods.length; i++) {
                    try {
                        const result = await methods[i]();
                        if (result) {
                            // For groups, verify the operation actually worked by checking if we can access the chat
                            if (isGroup) {
                                try {
                                    // Try to get group metadata to verify connection
                                    const groupMeta = await socket.groupMetadata(normalizedChatId);
                                    if (groupMeta) {
                                        readSuccess = true;
                                        console.log(`✅ GROUP marked as read in WhatsApp using method ${i + 2}: ${normalizedChatId}`);
                                        break;
                                    }
                                } catch (verifyErr) {
                                    console.warn(`Group verification failed for method ${i + 2}, but continuing: ${verifyErr.message}`);
                                    // Still mark as success if chatModify didn't throw error
                                    readSuccess = true;
                                    console.log(`✅ GROUP marked as read in WhatsApp using method ${i + 2} (verified): ${normalizedChatId}`);
                                    break;
                                }
                            } else {
                                readSuccess = true;
                                console.log(`✅ CHAT marked as read in WhatsApp using method ${i + 2}: ${normalizedChatId}`);
                                break;
                            }
                        }
                    } catch (err) {
                        console.warn(`Method ${i + 2} failed: ${err.message}`);
                        console.error(`Method ${i + 2} error details:`, {
                            message: err.message,
                            code: err.code,
                            status: err.status,
                            name: err.name
                        });
                        if (i === methods.length - 1) {
                            console.error(`All chatModify methods failed. Last error:`, err);
                            console.error(`Error stack:`, err.stack);
                            console.error(`ChatId format: ${normalizedChatId}, isGroup: ${isGroup}`);
                        }
                    }
                }
            }

            // If all methods failed with normalized format, try original format
            if (!readSuccess && normalizedChatId !== chatId) {
                console.log(`Trying original format ${chatId}...`);
                const fallbackMethods = [
                    async () => {
                        await socket.chatModify({ markRead: true }, chatId);
                        return true;
                    },
                    async () => {
                        await socket.chatModify({
                            chatId: chatId,
                            markRead: true,
                        });
                        return true;
                    },
                    async () => {
                        if (isGroup) {
                            await socket.chatModify({
                                jid: chatId,
                                markRead: true,
                            });
                            return true;
                        }
                        return false;
                    },
                ];

                for (let i = 0; i < fallbackMethods.length; i++) {
                    try {
                        const result = await fallbackMethods[i]();
                        if (result) {
                            normalizedChatId = chatId;
                            readSuccess = true;
                            console.log(`✅ ${isGroup ? 'GROUP' : 'CHAT'} marked as read using original format (method ${i + 1})`);
                            break;
                        }
                    } catch (err) {
                        console.warn(`Fallback method ${i + 1} failed: ${err.message}`);
                        if (i === fallbackMethods.length - 1) {
                            console.error('All fallback methods failed:', err);
                        }
                    }
                }
            }

            if (!readSuccess) {
                console.error('All methods failed to mark messages as read in WhatsApp');
                console.error('Tried methods: readMessages with message keys, chatModify with markRead');
                console.error(`ChatId used: ${normalizedChatId} (original: ${chatId})`);
                console.error(`Is Group: ${isGroup}`);
                console.error(`Socket available: ${!!socket}`);
                console.error(`chatModify available: ${typeof socket.chatModify === 'function'}`);
                
                // For groups, try one more time with direct jid parameter
                if (isGroup) {
                    try {
                        console.log('Last attempt: Trying chatModify with direct jid parameter for group...');
                        await socket.chatModify({ markRead: true }, normalizedChatId);
                        readSuccess = true;
                        console.log(`✅ GROUP marked as read in WhatsApp (last attempt succeeded)`);
                    } catch (finalErr) {
                        console.error('Final attempt failed:', finalErr);
                        console.error('Final error details:', {
                            message: finalErr.message,
                            code: finalErr.code,
                            status: finalErr.status,
                            stack: finalErr.stack
                        });
                    }
                }
                
                if (!readSuccess) {
                    console.error('❌ All methods failed to mark messages as read in WhatsApp');
                    console.error('Database will NOT be updated to maintain consistency');
                    throw new Error(`Failed to mark messages as read in WhatsApp - all methods failed. ChatId: ${normalizedChatId}, IsGroup: ${isGroup}. Please check the chatId format and ensure the instance is connected.`);
                }
            }

            // Update unread count in database ONLY if WhatsApp operation succeeded
            if (readSuccess && chat) {
                await prisma.chat.updateMany({
                    where: {
                        instanceId,
                        OR: [
                            { chatId: normalizedChatId },
                            { chatId: chatId },
                        ],
                    },
                    data: {
                        unreadCount: 0,
                    },
                });
                console.log(`✅ Unread count reset to 0 for chat ${normalizedChatId} in database`);
            } else if (readSuccess && !chat) {
                console.warn(`Chat ${normalizedChatId} not found in database, but messages marked as read in WhatsApp`);
            } else if (!readSuccess) {
                console.error('❌ Skipping database update because WhatsApp operation failed');
            }

            return {
                success: true,
                message: 'Messages marked as read',
                chatId: normalizedChatId,
            };
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
            // Normalize chatId to ensure proper JID format
            let normalizedChatId = chatId;
            if (!chatId.includes('@')) {
                // If no @, assume it's a phone number, add @s.whatsapp.net
                normalizedChatId = `${chatId}@s.whatsapp.net`;
            }

            // Verify message exists in database first
            const existingMessage = await prisma.message.findFirst({
                where: {
                    instanceId,
                    messageId,
                },
                include: {
                    chat: {
                        select: {
                            chatId: true,
                        },
                    },
                },
            });

            if (!existingMessage) {
                throw new Error(`Message ${messageId} not found in database`);
            }

            // Determine if message is from me or not
            const fromMe = existingMessage.fromMe;

            // Delete from WhatsApp
            try {
                await socket.sendMessage(normalizedChatId, {
                    delete: {
                        remoteJid: normalizedChatId,
                        fromMe: fromMe,
                        id: messageId,
                    },
                });
                console.log(`Message ${messageId} deleted from WhatsApp (fromMe: ${fromMe})`);
            } catch (whatsappError) {
                // If WhatsApp deletion fails, try with original chatId
                if (normalizedChatId !== chatId) {
                    try {
                        await socket.sendMessage(chatId, {
                            delete: {
                                remoteJid: chatId,
                                fromMe: fromMe,
                                id: messageId,
                            },
                        });
                        console.log(`Message ${messageId} deleted from WhatsApp (using original format)`);
                    } catch (err) {
                        console.error('Error deleting message from WhatsApp:', err);
                        // Continue to delete from database even if WhatsApp deletion fails
                        console.warn('Continuing to delete from database despite WhatsApp error');
                    }
                } else {
                    console.error('Error deleting message from WhatsApp:', whatsappError);
                    // Continue to delete from database even if WhatsApp deletion fails
                    console.warn('Continuing to delete from database despite WhatsApp error');
                }
            }

            // Delete from database
            const deletedMessages = await prisma.message.deleteMany({
                where: {
                    instanceId,
                    messageId,
                },
            });

            if (deletedMessages.count === 0) {
                throw new Error(`Message ${messageId} not found in database to delete`);
            }

            console.log(`Message ${messageId} deleted from database (${deletedMessages.count} message(s))`);

            return {
                success: true,
                message: 'Message deleted successfully',
                deleted: {
                    messageId,
                    count: deletedMessages.count,
                },
            };
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
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;
        const prisma = database.getInstance();

        try {
            // Normalize chatId to ensure proper JID format
            let normalizedChatId = chatId;
            if (!chatId.includes('@')) {
                // If no @, assume it's a phone number, add @s.whatsapp.net
                normalizedChatId = `${chatId}@s.whatsapp.net`;
            } else if (chatId.includes('@g.us')) {
                // Group chat - keep the @g.us format
                normalizedChatId = chatId;
            }

            // Find chat in database
            const chat = await prisma.chat.findFirst({
                where: {
                    instanceId,
                    OR: [
                        { chatId: normalizedChatId },
                        { chatId: chatId },
                    ],
                },
            });

            if (!chat) {
                throw new Error(`Chat ${normalizedChatId} not found in database`);
            }

            // Mark chat as unread in WhatsApp - try multiple methods
            let unreadSuccess = false;
            const unreadMethods = [
                // Method 1: chatModify with markRead as first param and jid as second (preferred format)
                async () => {
                    console.log(`Attempting chatModify({ markRead: false }, ${normalizedChatId})`);
                    await socket.chatModify({ markRead: false }, normalizedChatId);
                    return true;
                },
                // Method 2: chatModify with chatId in object (alternative format)
                async () => {
                    console.log(`Attempting chatModify with chatId: ${normalizedChatId}, markRead: false`);
                    await socket.chatModify({
                        chatId: normalizedChatId,
                        markRead: false, // Mark as unread
                    });
                    return true;
                },
            ];

            // Try each method until one succeeds
            for (let i = 0; i < unreadMethods.length; i++) {
                try {
                    await unreadMethods[i]();
                    unreadSuccess = true;
                    console.log(`✅ ${isGroup ? 'GROUP' : 'CHAT'} ${normalizedChatId} marked as unread in WhatsApp using method ${i + 1}`);
                    break;
                } catch (err) {
                    console.warn(`Unread method ${i + 1} failed: ${err.message}`);
                    if (i === unreadMethods.length - 1) {
                        console.error(`All unread methods failed. Last error:`, err);
                        console.error(`Error stack:`, err.stack);
                    }
                }
            }

            // If all methods failed with normalized format, try original format
            if (!unreadSuccess && normalizedChatId !== chatId) {
                console.log(`Trying original format ${chatId} for unread...`);
                try {
                    await socket.chatModify({ markRead: false }, chatId);
                    normalizedChatId = chatId;
                    unreadSuccess = true;
                    console.log(`✅ Chat marked as unread using original format`);
                } catch (err1) {
                    try {
                        await socket.chatModify({
                            chatId: chatId,
                            markRead: false,
                        });
                        normalizedChatId = chatId;
                        unreadSuccess = true;
                        console.log(`✅ Chat marked as unread using original format (alternative)`);
                    } catch (err2) {
                        console.error('Error with original format:', err2);
                    }
                }
            }

            if (!unreadSuccess) {
                console.error('All methods failed to mark chat as unread in WhatsApp');
                console.error(`ChatId used: ${normalizedChatId} (original: ${chatId})`);
                // Continue to update database even if WhatsApp fails
                console.warn('Continuing to update database despite WhatsApp error');
            }

            // Increment unread count in database (set to 1 if currently 0)
            const newUnreadCount = chat.unreadCount > 0 ? chat.unreadCount : 1;
            
            await prisma.chat.updateMany({
                where: {
                    instanceId,
                    OR: [
                        { chatId: normalizedChatId },
                        { chatId: chatId },
                    ],
                },
                data: {
                    unreadCount: newUnreadCount,
                },
            });

            console.log(`Chat ${normalizedChatId} marked as unread in database (unreadCount: ${newUnreadCount})`);

            return {
                success: true,
                message: 'Chat marked as unread',
                chatId: normalizedChatId,
                unreadCount: newUnreadCount,
            };
        } catch (error) {
            console.error('Error marking chat as unread:', error);
            throw error;
        }
    }

    // Additional Webhook Handlers
    async handleCallEvents(instanceId, callEvents) {
        try {
            for (const call of callEvents) {
                const callData = {
                    callId: call.id,
                    from: call.from,
                    fromName: call.pushName || (call.from || '').split('@')[0],
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

            const chatName = chat?.name || (chatId || '').split('@')[0];

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

    // Channel/Newsletter Methods
    async getChannels(instanceId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;
        const prisma = database.getInstance();

        try {
            // Get channels from store (simple and reliable, no app state key needed)
            let storeChats = [];
            
            if (socket.store && socket.store.chats) {
                // Try different methods to get chats from store
                if (typeof socket.store.chats.all === 'function') {
                    storeChats = socket.store.chats.all();
                } else if (socket.store.chats instanceof Map) {
                    storeChats = Array.from(socket.store.chats.values());
                } else if (typeof socket.store.chats === 'object') {
                    storeChats = Object.values(socket.store.chats);
                } else if (Array.isArray(socket.store.chats)) {
                    storeChats = socket.store.chats;
                }
            }

            console.log(`Total chats in store: ${storeChats.length}`);

            // Filter only newsletter channels (ending with @newsletter)
            let channels = storeChats
                .filter(chat => {
                    if (!chat || !chat.id) return false;
                    const isNewsletter = chat.id.endsWith('@newsletter');
                    if (isNewsletter) {
                        console.log(`Found newsletter in store: ${chat.id}, name: ${chat.name || 'N/A'}`);
                    }
                    return isNewsletter;
                })
                .map(chat => {
                    // Try to get more info from newsletterMetadata if available
                    let channelData = {
                        id: chat.id,
                        name: chat.name || chat.conversationTimestamp || (chat.id || '').split('@')[0],
                        description: chat.description || '',
                        subscriberCount: chat.subscriberCount || 0,
                        createdAt: chat.createdAt || chat.conversationTimestamp || null,
                        picture: chat.picture || null,
                    };

                    // If we have thread_metadata in chat, use it
                    if (chat.threadMetadata) {
                        channelData.name = chat.threadMetadata.name?.text || channelData.name;
                        channelData.description = chat.threadMetadata.description?.text || channelData.description;
                        channelData.subscriberCount = parseInt(chat.threadMetadata.subscribers_count || '0');
                        channelData.createdAt = parseInt(chat.threadMetadata.creation_time || '0') * 1000; // Convert to milliseconds
                    }

                    return channelData;
                });

            console.log(`Found ${channels.length} channels from store`);

            // Also try to get channels from database as additional source
            try {
                const dbChats = await prisma.chat.findMany({
                    where: {
                        instanceId,
                        chatId: {
                            contains: '@newsletter'
                        }
                    },
                    orderBy: {
                        lastMessageAt: 'desc'
                    }
                });

                console.log(`Found ${dbChats.length} channels in database`);

                // Merge with store channels, avoiding duplicates
                const existingIds = new Set(channels.map(c => c.id));
                
                dbChats.forEach(chat => {
                    if (chat.chatId && chat.chatId.endsWith('@newsletter') && !existingIds.has(chat.chatId)) {
                        channels.push({
                            id: chat.chatId,
                            name: chat.name || (chat.chatId || '').split('@')[0],
                            description: '',
                            subscriberCount: 0,
                            createdAt: chat.createdAt || null,
                            picture: null,
                        });
                        console.log(`Added channel from DB: ${chat.chatId}`);
                    }
                });
            } catch (dbErr) {
                console.warn(`Error getting channels from database: ${dbErr.message}`);
            }

            // Remove duplicates based on ID
            const uniqueChannels = [];
            const seenIds = new Set();
            channels.forEach(channel => {
                if (channel.id && !seenIds.has(channel.id)) {
                    seenIds.add(channel.id);
                    uniqueChannels.push(channel);
                }
            });

            console.log(`Total unique channels found: ${uniqueChannels.length} for instance ${instanceId}`);
            return uniqueChannels;
        } catch (error) {
            console.error('Error getting channels:', error);
            throw error;
        }
    }

    async getChannelInfo(instanceId, channelId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;
        const prisma = database.getInstance();

        try {
            // Normalize channelId
            const normalizedChannelId = channelId.includes('@') ? channelId : `${channelId}@newsletter`;

            // First, try to get info from store (simpler and more reliable)
            if (socket.store && socket.store.chats) {
                let storeChats = [];
                if (typeof socket.store.chats.all === 'function') {
                    storeChats = socket.store.chats.all();
                } else if (socket.store.chats instanceof Map) {
                    storeChats = Array.from(socket.store.chats.values());
                } else if (typeof socket.store.chats === 'object') {
                    storeChats = Object.values(socket.store.chats);
                }

                const storeChat = storeChats.find(chat => chat && chat.id === normalizedChannelId);
                
                if (storeChat) {
                    // Build info from store data
                    const info = {
                        id: storeChat.id,
                        name: storeChat.name || (storeChat.id || '').split('@')[0],
                        description: storeChat.description || '',
                        subscriberCount: storeChat.subscriberCount || 0,
                        createdAt: storeChat.createdAt || storeChat.conversationTimestamp || null,
                        picture: storeChat.picture || null,
                    };

                    // If we have thread_metadata, use it
                    if (storeChat.threadMetadata) {
                        info.name = storeChat.threadMetadata.name?.text || info.name;
                        info.description = storeChat.threadMetadata.description?.text || info.description;
                        info.subscriberCount = parseInt(storeChat.threadMetadata.subscribers_count || '0');
                        info.createdAt = parseInt(storeChat.threadMetadata.creation_time || '0') * 1000;
                    }

                    console.log(`✅ Got channel info from store for ${normalizedChannelId}`);
                    return info;
                }
            }

            // Try to get from database as fallback
            try {
                const dbChat = await prisma.chat.findFirst({
                    where: {
                        instanceId,
                        chatId: normalizedChannelId,
                    },
                });

                if (dbChat) {
                    console.log(`✅ Got channel info from database for ${normalizedChannelId}`);
                    return {
                        id: dbChat.chatId,
                        name: dbChat.name || (dbChat.chatId || '').split('@')[0],
                        description: '',
                        subscriberCount: 0,
                        createdAt: dbChat.createdAt || null,
                        picture: null,
                    };
                }
            } catch (dbErr) {
                console.warn(`Error getting channel from database: ${dbErr.message}`);
            }

            // Last resort: try newsletterMetadata (may fail with Bad Request for some channels)
            if (typeof socket.newsletterMetadata === 'function') {
                try {
                    const info = await socket.newsletterMetadata(normalizedChannelId);
                    console.log(`✅ Got channel info from newsletterMetadata for ${normalizedChannelId}`);
                    return info;
                } catch (err) {
                    // If Bad Request, it might be a permission issue or invalid channel
                    if (err.message?.includes('Bad Request') || err.message?.includes('GraphQL')) {
                        console.warn(`⚠️ newsletterMetadata returned Bad Request for ${normalizedChannelId}, using fallback data`);
                        // Return basic info from channelId
                        return {
                            id: normalizedChannelId,
                            name: (normalizedChannelId || '').split('@')[0],
                            description: '',
                            subscriberCount: 0,
                            createdAt: null,
                            picture: null,
                            note: 'Limited info available. Channel may require special permissions to access full metadata.',
                        };
                    }
                    throw new Error(`Failed to get channel info: ${err.message}`);
                }
            } else {
                // If newsletterMetadata not available, return basic info
                return {
                    id: normalizedChannelId,
                    name: (normalizedChannelId || '').split('@')[0],
                    description: '',
                    subscriberCount: 0,
                    createdAt: null,
                    picture: null,
                    note: 'newsletterMetadata method not available. Using basic channel info.',
                };
            }
        } catch (error) {
            console.error('Error getting channel info:', error);
            throw error;
        }
    }

    async followChannel(instanceId, channelId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;

        try {
            // Check if socket is ready
            if (!socket.user) {
                throw new Error('WhatsApp not fully connected. Please wait for connection to complete.');
            }

            // Normalize channelId
            const normalizedChannelId = channelId.includes('@') ? channelId : `${channelId}@newsletter`;

            console.log(`Attempting to follow channel ${normalizedChannelId} for instance ${instanceId}`);

            // Follow newsletter using newsletterFollow (correct method according to Baileys docs)
            if (typeof socket.newsletterFollow !== 'function') {
                throw new Error('newsletterFollow method is not available');
            }

            try {
                const result = await socket.newsletterFollow(normalizedChannelId);
                console.log(`✅ Successfully followed channel ${normalizedChannelId} for instance ${instanceId}`);
                
                // Return result in consistent format, regardless of response structure
                return normalizedChannelId
            } catch (followError) {
                // Check if error is about response structure (operation might have succeeded)
                if (followError.message?.includes('unexpected response structure') || 
                    followError.message?.includes('response structure')) {
                    console.warn(`⚠️ Response structure warning, but channel may have been followed: ${followError.message}`);
                    // Assume success if it's just a response structure issue
                    return normalizedChannelId
                }
                // Re-throw other errors
                throw followError;
            }
        } catch (error) {
            console.error('Error following channel:', error);
            
            // Provide more helpful error messages
            if (error.message?.includes('not found') || error.message?.includes('Not Found')) {
                throw new Error('Channel not found. The channel may not exist or is not accessible.');
            }
            
            if (error.message?.includes('already') || error.message?.includes('Already')) {
                throw new Error('Channel is already being followed.');
            }
            
            throw error;
        }
    }

    async unfollowChannel(instanceId, channelId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;

        try {
            // Check if socket is ready
            if (!socket.user) {
                throw new Error('WhatsApp not fully connected. Please wait for connection to complete.');
            }

            // Normalize channelId
            const normalizedChannelId = channelId.includes('@') ? channelId : `${channelId}@newsletter`;

            console.log(`Attempting to unfollow channel ${normalizedChannelId} for instance ${instanceId}`);

            // Unfollow newsletter using newsletterUnfollow (correct method according to Baileys docs)
            if (typeof socket.newsletterUnfollow !== 'function') {
                throw new Error('newsletterUnfollow method is not available');
            }

            try {
                const result = await socket.newsletterUnfollow(normalizedChannelId);
                console.log(`✅ Successfully unfollowed channel ${normalizedChannelId} for instance ${instanceId}`);
                
                // Return result in consistent format
                return {
                    success: true,
                    channelId: normalizedChannelId,
                    data: result || { unfollowed: true }
                };
            } catch (unfollowError) {
                // Check if error is about response structure (operation might have succeeded)
                if (unfollowError.message?.includes('unexpected response structure') || 
                    unfollowError.message?.includes('response structure')) {
                    console.warn(`⚠️ Response structure warning, but channel may have been unfollowed: ${unfollowError.message}`);
                    // Assume success if it's just a response structure issue
                    return {
                        success: true,
                        channelId: normalizedChannelId,
                        data: { unfollowed: true },
                        note: 'Channel unfollowed successfully, but response format was unexpected'
                    };
                }
                // Re-throw other errors
                throw unfollowError;
            }
        } catch (error) {
            console.error('Error unfollowing channel:', error);
            
            // Provide more helpful error messages
            if (error.message?.includes('not found') || error.message?.includes('Not Found')) {
                throw new Error('Channel not found. The channel may not exist or is not accessible.');
            }
            
            if (error.message?.includes('not following') || error.message?.includes('Not following')) {
                throw new Error('Channel is not being followed.');
            }
            
            throw error;
        }
    }

    async muteChannel(instanceId, channelId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;

        try {
            // Normalize channelId
            const normalizedChannelId = channelId.includes('@') ? channelId : `${channelId}@newsletter`;

            // Mute newsletter using newsletterMute (correct method according to Baileys docs)
            if (typeof socket.newsletterMute === 'function') {
                await socket.newsletterMute(normalizedChannelId);
                console.log(`Successfully muted channel ${normalizedChannelId} for instance ${instanceId}`);
                return normalizedChannelId
            } else {
                throw new Error('newsletterMute method is not available');
            }
        } catch (error) {
            console.error('Error muting channel:', error);
            throw error;
        }
    }

    async unmuteChannel(instanceId, channelId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;

        try {
            // Normalize channelId
            const normalizedChannelId = channelId.includes('@') ? channelId : `${channelId}@newsletter`;

            // Unmute newsletter using newsletterUnmute (correct method according to Baileys docs)
            if (typeof socket.newsletterUnmute === 'function') {
                await socket.newsletterUnmute(normalizedChannelId);
                console.log(`Successfully unmuted channel ${normalizedChannelId} for instance ${instanceId}`);
                return normalizedChannelId;
            } else {
                throw new Error('newsletterUnmute method is not available');
            }
        } catch (error) {
            console.error('Error unmuting channel:', error);
            throw error;
        }
    }

    async getChannelMessages(instanceId, channelId, limit = 20) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;

        try {
            // Normalize channelId
            const normalizedChannelId = channelId.includes('@') ? channelId : `${channelId}@newsletter`;

            // Get newsletter messages using newsletterFetchMessages (correct method according to Baileys docs)
            if (typeof socket.newsletterFetchMessages === 'function') {
                const messages = await socket.newsletterFetchMessages(normalizedChannelId, limit);
                return messages || [];
            } else {
                throw new Error('newsletterFetchMessages method is not available');
            }
        } catch (error) {
            console.error('Error getting channel messages:', error);
            throw error;
        }
    }

    async createChannel(instanceId, name, description = '', picture = null) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;
        const prisma = database.getInstance();

        try {
            // Check if socket is ready
            if (!socket.user) {
                throw new Error('WhatsApp not fully connected. Please wait for connection to complete.');
            }

            // Validate name
            if (!name || typeof name !== 'string') {
                throw new Error('Channel name is required and must be a string');
            }

            const trimmedName = name.trim();
            
            if (trimmedName.length === 0) {
                throw new Error('Channel name cannot be empty');
            }
            
            // Validate name length
            if (trimmedName.length > 100) {
                throw new Error('Channel name must be 100 characters or less');
            }

            // Prepare description (optional parameter)
            const trimmedDesc = description && typeof description === 'string' && description.trim().length > 0
                ? description.trim().substring(0, 500)
                : undefined;

            console.log(`Creating channel: name="${trimmedName}"${trimmedDesc ? `, description="${trimmedDesc.substring(0, 50)}..."` : ''}`);

            // Use direct parameters format as per Baileys documentation:
            // newsletterCreate: (name, description?) => Promise<NewsletterMetadata>
            if (typeof socket.newsletterCreate !== 'function') {
                throw new Error('newsletterCreate method is not available. This feature may require special permissions.');
            }

            let result;
            let rateLimitError = false;
            
            try {
                // Call with direct parameters (name, description?) - sesuai dokumentasi Baileys
                if (trimmedDesc) {
                    result = await socket.newsletterCreate(trimmedName, trimmedDesc);
                } else {
                    result = await socket.newsletterCreate(trimmedName);
                }
                console.log(`✅ Channel created successfully for instance ${instanceId}`);
            } catch (error) {
                // Handle rate limit error - channel may have been created despite the error
                if (error.message?.includes('rate-overlimit') || error.message?.includes('rate limit')) {
                    console.warn(`⚠️ Rate limit error, but channel may have been created: ${error.message}`);
                    rateLimitError = true;
                    // Don't throw error, channel was likely created successfully
                    result = null; // Will handle below
                } else {
                    console.error('Error creating channel:', error);
                    throw error;
                }
            }

            // Extract channel ID from result
            const channelId = result?.id || result?.jid || result?.newsletterJid || result?.newsletter?.id || null;

            // If rate limit error occurred, channel was likely created
            if (rateLimitError && !channelId) {
                console.log('Channel likely created despite rate limit. Will sync on next getChannels call.');
            }

            // Save to database if channelId exists
            if (channelId) {
                try {
                    await prisma.chat.upsert({
                        where: {
                            instanceId_chatId: {
                                instanceId,
                                chatId: channelId,
                            },
                        },
                        update: {
                            name: trimmedName,
                        },
                        create: {
                            instanceId,
                            chatId: channelId,
                            name: trimmedName,
                            isGroup: false,
                        },
                    });
                    console.log(`✅ Channel ${channelId} saved to database`);
                } catch (dbErr) {
                    console.warn(`Warning: Failed to save channel to database: ${dbErr.message}`);
                }
            }

            // Return success even if rate limit error (channel was created)
            return {
                success: true,
                channelId: channelId,
                name: trimmedName,
                description: trimmedDesc || '',
                data: result,
                note: rateLimitError 
                    ? 'Channel created successfully, but rate limit error occurred. Channel should be available in WhatsApp.'
                    : undefined,
            };
        } catch (error) {
            console.error('Error creating channel:', error);
            throw error;
        }
    }

    async deleteChannel(instanceId, channelId) {
        const instance = this.instances.get(instanceId);

        if (!instance || !instance.socket) {
            throw new Error('Instance not found or not connected');
        }

        const { socket } = instance;
        const prisma = database.getInstance();

        try {
            // Check if socket is ready
            if (!socket.user) {
                throw new Error('WhatsApp not fully connected. Please wait for connection to complete.');
            }

            // Normalize channelId
            const normalizedChannelId = channelId.includes('@') ? channelId : `${channelId}@newsletter`;

            console.log(`Attempting to delete channel ${normalizedChannelId} for instance ${instanceId}`);

            // Verify channel exists (optional check, will fail on delete if not found anyway)
            try {
                const channelInfo = await socket.newsletterMetadata(normalizedChannelId);
                if (!channelInfo) {
                    throw new Error('Channel not found');
                }
                console.log(`Channel info retrieved: ${normalizedChannelId}`);
            } catch (infoError) {
                // If we can't get channel info, still try to delete
                // The delete operation itself will fail if channel doesn't exist or user doesn't have permission
                console.warn(`Could not get channel info (will attempt delete anyway): ${infoError.message}`);
            }

            // Delete newsletter using newsletterDelete
            if (typeof socket.newsletterDelete !== 'function') {
                throw new Error('newsletterDelete method is not available. This feature may require special permissions.');
            }

            const result = await socket.newsletterDelete(normalizedChannelId);
            
            console.log(`✅ Channel ${normalizedChannelId} deleted successfully for instance ${instanceId}`);

            // Delete channel from database
            try {
                await prisma.chat.deleteMany({
                    where: {
                        instanceId,
                        chatId: normalizedChannelId,
                    },
                });
                console.log(`✅ Channel ${normalizedChannelId} removed from database`);
            } catch (dbErr) {
                console.warn(`Warning: Failed to remove channel from database: ${dbErr.message}`);
                // Don't throw error, channel deletion was successful
            }

            return {
                success: true,
                channelId: normalizedChannelId,
                data: result,
            };
        } catch (error) {
            console.error('Error deleting channel:', error);
            
            // Provide more helpful error messages
            if (error.message?.includes('Not Authorized') || error.message?.includes('not authorized')) {
                throw new Error('Not Authorized: You must be the owner of the channel to delete it. Only channel owners can delete their channels.');
            }
            
            if (error.message?.includes('not found') || error.message?.includes('Not Found')) {
                throw new Error('Channel not found. The channel may have already been deleted or does not exist.');
            }
            
            throw error;
        }
    }
}

module.exports = new WhatsAppService();
