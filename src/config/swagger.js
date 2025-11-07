const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Gateway API',
      version: '1.0.0',
      description: 'A comprehensive WhatsApp Gateway API built with Baileys, supporting multi-instance management, message sending/receiving, and webhook notifications.',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.example.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication'
        }
      },
      schemas: {
        Instance: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique instance identifier'
            },
            name: {
              type: 'string',
              description: 'Instance name'
            },
            phoneNumber: {
              type: 'string',
              description: 'Connected phone number'
            },
            status: {
              type: 'string',
              enum: ['connecting', 'connected', 'disconnected', 'qr'],
              description: 'Connection status'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the instance is active'
            },
            webhookUrl: {
              type: 'string',
              format: 'uri',
              description: 'Webhook URL for notifications'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Message: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            instanceId: {
              type: 'string',
              format: 'uuid'
            },
            chatId: {
              type: 'string'
            },
            messageId: {
              type: 'string'
            },
            fromMe: {
              type: 'boolean'
            },
            from: {
              type: 'string'
            },
            to: {
              type: 'string'
            },
            body: {
              type: 'string'
            },
            type: {
              type: 'string',
              enum: ['text', 'image', 'video', 'audio', 'document', 'sticker']
            },
            mediaUrl: {
              type: 'string',
              format: 'uri'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            status: {
              type: 'string',
              enum: ['pending', 'sent', 'delivered', 'read', 'failed']
            }
          }
        },
        Chat: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            instanceId: {
              type: 'string',
              format: 'uuid'
            },
            chatId: {
              type: 'string'
            },
            name: {
              type: 'string'
            },
            isGroup: {
              type: 'boolean'
            },
            participants: {
              type: 'integer'
            },
            lastMessage: {
              type: 'string'
            },
            lastMessageAt: {
              type: 'string',
              format: 'date-time'
            },
            unreadCount: {
              type: 'integer'
            },
            archived: {
              type: 'boolean'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Error message'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string'
            },
            data: {
              type: 'object'
            }
          }
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'], // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
