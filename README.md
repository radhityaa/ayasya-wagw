# 📱 WhatsApp Gateway API

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D17.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

**A comprehensive, production-ready multi-instance WhatsApp Gateway API built with Baileys, Express.js, Prisma, and MySQL.**

[Features](#-features) • [Installation](#-installation) • [Documentation](#-documentation) • [API Endpoints](#-api-endpoints) • [Examples](#-usage-examples) • [Contributing](#-contributing)

</div>
# 📱 WhatsApp Gateway API

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D17.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

**A comprehensive, production-ready multi-instance WhatsApp Gateway API built with Baileys, Express.js, Prisma, and MySQL.**

[Features](#-features) • [Installation](#-installation) • [Documentation](#-documentation) • [API Endpoints](#-api-endpoints) • [Examples](#-usage-examples) • [Contributing](#-contributing)

</div>

---

## ☕ Support/Donate

If you find this project helpful, consider supporting the development:

**Trakteer:** [teer.id/rama_adhitya_setiadi](https://teer.id/rama_adhitya_setiadi)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Quick Start](#-quick-start)
- [Documentation](#-documentation)
- [API Endpoints](#-api-endpoints)
- [Usage Examples](#-usage-examples)
- [Project Structure](#-project-structure)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Security](#-security)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## 🌟 Overview

WhatsApp Gateway API is a **REST API service** that provides WhatsApp automation capabilities through HTTP endpoints.This service allows you to integrate WhatsApp messaging into your applications without dealing with the complexity of WhatsApp Web protocol directly.

**This is an API service only** - it provides HTTP endpoints that your applications can call to send/receive WhatsApp messages, manage groups, handle contacts, and more. You integrate this service into your own applications via HTTP requests.

### Why Choose This API Service?

- ✅ **128+ REST API Endpoints** - Comprehensive HTTP API coverage
- ✅ **Multi-Instance Support** - Manage multiple WhatsApp accounts via API
- ✅ **Production Ready** - Battle-tested with proper error handling
- ✅ **Well Documented** - Complete API documentation included
- ✅ **Webhook Support** - Real-time event notifications via HTTP callbacks
- ✅ **Database Persistence** - MySQL with Prisma ORM for data storage
- ✅ **Security First** - API key authentication & rate limiting
- ✅ **Easy Integration** - RESTful API with JSON requests/responses
- ✅ **Language Agnostic** - Use with any programming language that supports HTTP

---

## ✨ Features

### 💬 Complete Messaging Capabilities

#### Basic Messaging
- ✅ Text messages with formatting
- ✅ Quoted replies
- ✅ Message forwarding
- ✅ Bulk messaging

#### Media Messages
- ✅ Images (URL/Base64/File upload)
- ✅ Videos with captions
- ✅ Documents/Files
- ✅ Voice notes
- ✅ Audio files

#### Interactive Messages
- ✅ List messages
- ✅ Button messages
- ✅ Polls (create & vote)
- ✅ Link previews (custom)

#### Location & Contacts
- ✅ Share location
- ✅ Send contact vCards
- ✅ Multiple contacts

#### Message Actions
- ✅ Mark as read/unread
- ✅ Typing indicators
- ✅ Reactions (emojis)
- ✅ Star/unstar messages
- ✅ Delete messages
- ✅ Edit messages

### 👥 Group Management (25 Endpoints)

- ✅ Create & delete groups
- ✅ Add/remove participants
- ✅ Promote/demote admins
- ✅ Update group info (name, description, picture)
- ✅ Group settings (announcement, locked, ephemeral)
- ✅ Invite links (get, revoke, accept)
- ✅ Leave groups
- ✅ Send messages to groups

### 📱 Status/Stories (6 Endpoints)

- ✅ Send text status
- ✅ Send image status
- ✅ Send video status
- ✅ Send voice status
- ✅ Delete status
- ✅ Generate message IDs

### 📇 Contact Management (11 Endpoints)

- ✅ Get all contacts
- ✅ Get contact info
- ✅ Check if contact exists
- ✅ Get profile pictures
- ✅ Block/unblock contacts
- ✅ Update contact info
- ✅ LID operations (WhatsApp's internal IDs)

### 👁️ Presence Tracking (4 Endpoints)

- ✅ Set presence (available, unavailable, composing, recording)
- ✅ Get presence status
- ✅ Subscribe to presence updates
- ✅ Real-time presence notifications

### 🎉 Event Messages (1 Endpoint)

- ✅ Send event invitations (birthday, meeting, appointment)
- ✅ Custom event types
- ✅ Location & time details

### 🏷️ Labels - WhatsApp Business (7 Endpoints)

- ✅ Create & manage labels
- ✅ Assign labels to chats
- ✅ Get chats by label
- ✅ Color customization

### 🎬 Media Conversion (2 Endpoints)

- ✅ Convert voice to Opus format
- ✅ Convert video to MP4
- ✅ Requires FFmpeg

### 📢 Channels/Newsletters (13 Endpoints)

- ✅ Get subscribed channels
- ✅ Follow/unfollow channels
- ✅ Mute/unmute channels
- ✅ Get channel info

### 👤 Profile Management (5 Endpoints)

- ✅ Get profile info
- ✅ Update name
- ✅ Update status message
- ✅ Update profile picture
- ✅ Delete profile picture

### 🔔 Webhooks (6 Endpoints)

- ✅ Real-time event notifications
- ✅ Message events (received, sent, delivered, read)
- ✅ Connection events
- ✅ Group events
- ✅ Call events
- ✅ Webhook logs & statistics

### 📊 Observability & Monitoring (7 Endpoints)

- ✅ Health checks
- ✅ Server metrics (CPU, memory, uptime)
- ✅ Version information
- ✅ Environment details
- ✅ Instance statistics
- ✅ Server control (stop, restart)

### 🔐 Security & Performance

- ✅ API key authentication
- ✅ Rate limiting (100 req/15min)
- ✅ Input validation
- ✅ Error handling
- ✅ Request logging
- ✅ CORS support

### 💾 Database & Persistence

- ✅ MySQL database
- ✅ Prisma ORM
- ✅ Session persistence
- ✅ Message history
- ✅ Webhook logs
- ✅ Auto-reconnection

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 17.0.0
- **MySQL** >= 5.7 or >= 8.0
- **npm** or **yarn**
- **WhatsApp Account** (personal or business)
- **FFmpeg** (optional, for media conversion)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/radhityaa/ayasya-wagw.git
cd ayasya-wagw
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL="mysql://username:password@localhost:3306/whatsapp_gateway"

# Server Configuration
API_PORT=3000
NODE_ENV=development

# Security
JWT_SECRET="your-super-secret-jwt-key-change-this"
API_KEY="your-api-key-here"

# Optional: Webhook Configuration
WEBHOOK_URL="https://your-webhook-endpoint.com/webhook"
```

### 4. Initialize Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Seed database
npx prisma db seed
```

### 5. Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

---

## ⚙️ Configuration

### Database Configuration

Edit `prisma/schema.prisma` to customize your database schema:

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

### API Configuration

Edit `src/config/config.js`:

```javascript
module.exports = {
  port: process.env.API_PORT || 3000,
  apiKey: process.env.API_KEY,
  jwtSecret: process.env.JWT_SECRET,
  // ... other configurations
};
```

### Rate Limiting

Customize rate limits in `src/middleware/rateLimiter.js`:

```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
```

---

## 🎯 Quick Start

### 1. Set API Key in Environment

Set your API key in the `.env` file:

```env
API_KEY="your-super-secret-api-key-here"
```

**Note:** API keys are managed via environment variables only. No dynamic generation endpoint is provided.

### 2. Create WhatsApp Instance

```bash
curl -X POST http://localhost:3000/api/instance/create \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My WhatsApp Instance",
    "webhookUrl": "https://your-webhook.com/webhook"
  }'
```

**Note:** Instance ID will be automatically generated. You'll receive it in the response.

### 3. Get QR Code

```bash
curl -X GET http://localhost:3000/api/instance/my-instance/qr \
  -H "X-API-Key: your-api-key"
```

Scan the QR code with your WhatsApp mobile app.

### 4. Send Your First Message

```bash
curl -X POST http://localhost:3000/api/message/send/text \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "my-instance",
    "to": "6281234567890@s.whatsapp.net",
    "message": "Hello from WhatsApp Gateway API!"
  }'
```

---

## 📚 Documentation

### Complete API Documentation

Access the full interactive API documentation:

- **HTML Documentation**: `http://localhost:3000/`
- **Markdown Documentation**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Implementation Guide**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **Webhook Guide**: [WEBHOOK_IMPLEMENTATION.md](./WEBHOOK_IMPLEMENTATION.md)

### Authentication

All API requests require an API key in the header:

```
X-API-Key: your-api-key-here
```

### Response Format

All responses follow this format:

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details"
}
```

---

## 🔗 API Endpoints

### Instance Management (9 Endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/instance/create` | Create new instance |
| GET | `/api/instance` | List all instances |
| GET | `/api/instance/:id/status` | Get instance status |
| GET | `/api/instance/:id/qr` | Get QR code |
| POST | `/api/instance/:id/restart` | Restart instance |
| POST | `/api/instance/:id/logout` | Logout instance |
| DELETE | `/api/instance/:id` | Delete instance |
| POST | `/api/instance/:id/pairing-code` | Request pairing code |
| GET | `/api/instance/:id/pairing-code` | Get pairing code |

### Messaging (28+ Endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/message/send/text` | Send text message |
| POST | `/api/message/send/image` | Send image |
| POST | `/api/message/send/video` | Send video |
| POST | `/api/message/send/file` | Send document |
| POST | `/api/message/send/voice` | Send voice note |
| POST | `/api/message/send/location` | Send location |
| POST | `/api/message/send/contact` | Send contact vCard |
| POST | `/api/message/send/list` | Send list message |
| POST | `/api/message/send/buttons` | Send button message |
| POST | `/api/message/send/poll` | Send poll |
| POST | `/api/message/send/link-preview` | Send link with preview |
| POST | `/api/message/forward` | Forward message |
| POST | `/api/message/seen` | Mark as read |
| POST | `/api/message/typing/start` | Start typing |
| POST | `/api/message/typing/stop` | Stop typing |
| PUT | `/api/message/reaction` | Add reaction |
| PUT | `/api/message/star` | Star message |
| GET | `/api/message/chats/:id` | Get all chats |
| GET | `/api/message/chat/:id/:chatId` | Get chat messages |
| DELETE | `/api/message/:id/:messageId` | Delete message |

### Groups (25 Endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups/:id` | Get all groups |
| POST | `/api/groups/:id` | Create group |
| GET | `/api/groups/:id/:groupId` | Get group info |
| PUT | `/api/groups/:id/:groupId/name` | Update group name |
| PUT | `/api/groups/:id/:groupId/description` | Update description |
| POST | `/api/groups/:id/:groupId/participants` | Add participants |
| DELETE | `/api/groups/:id/:groupId/participants` | Remove participants |
| POST | `/api/groups/:id/:groupId/promote` | Promote to admin |
| POST | `/api/groups/:id/:groupId/demote` | Demote admin |
| PUT | `/api/groups/:id/:groupId/settings` | Update settings |
| POST | `/api/groups/:id/:groupId/leave` | Leave group |
| GET | `/api/groups/:id/:groupId/invite-code` | Get invite code |
| POST | `/api/groups/:id/:groupId/revoke-invite` | Revoke invite |
| POST | `/api/groups/:id/accept-invite` | Accept invite |
| ... | ... | [See full list](./API_DOCUMENTATION.md) |

### Status/Stories (6 Endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/status/:id/text` | Send text status |
| POST | `/api/status/:id/image` | Send image status |
| POST | `/api/status/:id/video` | Send video status |
| POST | `/api/status/:id/voice` | Send voice status |
| POST | `/api/status/:id/delete` | Delete status |
| GET | `/api/status/:id/new-message-id` | Generate message ID |

### Contacts (11 Endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts/:id/all` | Get all contacts |
| GET | `/api/contacts/:id` | Get contact info |
| GET | `/api/contacts/:id/check-exists` | Check if exists |
| POST | `/api/contacts/:id/block` | Block contact |
| POST | `/api/contacts/:id/unblock` | Unblock contact |
| ... | ... | [See full list](./API_DOCUMENTATION.md) |

### Observability (7 Endpoints)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/observability/ping` | Server ping | No |
| GET | `/api/observability/health` | Health check | No |
| GET | `/api/observability/version` | Get version | Yes |
| GET | `/api/observability/environment` | Get environment | Yes |
| GET | `/api/observability/status` | Get server status | Yes |
| POST | `/api/observability/stop` | Stop server | Yes |
| POST | `/api/observability/restart` | Restart server | Yes |

**[View Complete API Reference →](./API_DOCUMENTATION.md)**

---

## 💡 Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_KEY = 'your-api-key';
const BASE_URL = 'http://localhost:3000';

async function sendMessage(instanceId, to, message) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/message/send/text`,
      { instanceId, to, message },
      { headers: { 'X-API-Key': API_KEY } }
    );
    console.log('Message sent:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

sendMessage('my-instance', '6281234567890@s.whatsapp.net', 'Hello!');
```

### Python

```python
import requests

API_KEY = 'your-api-key'
BASE_URL = 'http://localhost:3000'

def send_message(instance_id, to, message):
    headers = {'X-API-Key': API_KEY}
    data = {
        'instanceId': instance_id,
        'to': to,
        'message': message
    }
    
    response = requests.post(
        f'{BASE_URL}/api/message/send/text',
        json=data,
        headers=headers
    )
    
    return response.json()

result = send_message('my-instance', '6281234567890@s.whatsapp.net', 'Hello!')
print(result)
```

### PHP

```php
<?php
$apiKey = 'your-api-key';
$baseUrl = 'http://localhost:3000';

function sendMessage($instanceId, $to, $message) {
    global $apiKey, $baseUrl;
    
    $data = [
        'instanceId' => $instanceId,
        'to' => $to,
        'message' => $message
    ];
    
    $ch = curl_init($baseUrl . '/api/message/send/text');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'X-API-Key: ' . $apiKey,
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

$result = sendMessage('my-instance', '6281234567890@s.whatsapp.net', 'Hello!');
print_r($result);
?>
```

### cURL

```bash
# Send text message
curl -X POST http://localhost:3000/api/message/send/text \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "my-instance",
    "to": "6281234567890@s.whatsapp.net",
    "message": "Hello from cURL!"
  }'

# Send image
curl -X POST http://localhost:3000/api/message/send/image \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "my-instance",
    "to": "6281234567890@s.whatsapp.net",
    "image": "https://example.com/image.jpg",
    "caption": "Check this out!"
  }'

# Create group
curl -X POST http://localhost:3000/api/groups/my-instance \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Group",
    "participants": [
      "6281234567890@s.whatsapp.net",
      "6289876543210@s.whatsapp.net"
    ]
  }'
```

### Integration Examples

#### 1. Integrate into Your Web Application

```javascript
// Your application calls this API service
async function sendWhatsAppMessage(to, message) {
  const response = await fetch('http://your-api-server:3000/api/message/send/text', {
    method: 'POST',
    headers: {
      'X-API-Key': 'your-api-key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      instanceId: 'my-instance',
      to: to,
      message: message
    })
  });
  
  return await response.json();
}

// Use in your application
await sendWhatsAppMessage('6281234567890@s.whatsapp.net', 'Hello from my app!');
```

#### 2. Receive Webhooks in Your Application

```javascript
// Your application receives webhooks from this API service
app.post('/webhook', (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'message.received') {
    const { from, message, instanceId } = data;
    
    // Process the incoming message in your application
    console.log(`Received message from ${from}: ${message.conversation}`);
    
    // Your application logic here
    processIncomingMessage(from, message);
  }
  
  res.sendStatus(200);
});
```

#### 3. Build a Chatbot Service

```javascript
// Your chatbot application uses this API service
async function handleUserMessage(from, message) {
  // Your chatbot logic
  const reply = await generateBotReply(message);
  
  // Send reply via this API service
  await fetch('http://your-api-server:3000/api/message/send/text', {
    method: 'POST',
    headers: {
      'X-API-Key': 'your-api-key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      instanceId: 'bot-instance',
      to: from,
      message: reply
    })
  });
}
```

**[More Examples →](./API_DOCUMENTATION.md#-usage-examples)**

---

## 📁 Project Structure

```
whatsapp-gateway-api/
├── src/
│   ├── controllers/          # Request handlers
│   │   ├── instanceController.js
│   │   ├── messageController.js
│   │   ├── groupController.js
│   │   ├── statusController.js
│   │   ├── contactController.js
│   │   ├── presenceController.js
│   │   ├── eventController.js
│   │   ├── labelController.js
│   │   ├── mediaController.js
│   │   ├── channelController.js
│   │   ├── profileController.js
│   │   ├── webhookController.js
│   │   ├── observabilityController.js
│   │   └── authController.js
│   ├── routes/               # API routes
│   │   ├── instanceRoutes.js
│   │   ├── messageRoutes.js
│   │   ├── groupRoutes.js
│   │   └── ... (14 route files)
│   ├── services/             # Business logic
│   │   ├── whatsappService.js
│   │   ├── sessionManager.js
│   │   └── webhookService.js
│   ├── middleware/           # Express middleware
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── config/               # Configuration
│   │   ├── config.js
│   │   ├── database.js
│   │   └── swagger.js
│   ├── utils/                # Utility functions
│   └── app.js                # Express app setup
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
├── sessions/                 # WhatsApp session files
├── public/                   # Static files
├── tests/                    # Test files
│   ├── test-all-new-endpoints.js
│   ├── test-observability-endpoints.js
│   └── test-webhook.js
├── docs/                     # Documentation
│   ├── API_DOCUMENTATION.md
│   ├── IMPLEMENTATION_SUMMARY.md
│   └── WEBHOOK_IMPLEMENTATION.md
├── .env                      # Environment variables
├── .gitignore
├── package.json
├── nodemon.json
├── server.js                 # Server entry point
└── README.md
```

---
## 🔔 Webhooks

### Webhook Events

Your webhook will receive POST requests for these events:

#### Message Events
- `message.received` - New message received
- `message.sent` - Message sent successfully
- `message.failed` - Message failed to send
- `message.read` - Message read by recipient
- `message.delivered` - Message delivered

#### Connection Events
- `connection.open` - Connection established
- `connection.close` - Connection closed
- `connection.update` - Connection status updated

#### Group Events
- `group.join` - Joined a group
- `group.leave` - Left a group
- `group.update` - Group info updated
- `group.participants.update` - Participants changed

#### Call Events
- `call.received` - Incoming call
- `call.rejected` - Call rejected

### Webhook Payload Example

```json
{
  "event": "message.received",
  "instanceId": "my-instance",
  "timestamp": "2025-11-07T08:00:00.000Z",
  "data": {
    "from": "6281234567890@s.whatsapp.net",
    "to": "6289876543210@s.whatsapp.net",
    "message": {
      "conversation": "Hello!"
    },
    "messageId": "message-id-here"
  }
}
```

### Setting Up Webhooks

```bash
# Configure webhook URL when creating instance
curl -X POST http://localhost:3000/api/instance/create \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Instance",
    "webhookUrl": "https://your-webhook.com/webhook"
  }'
```

### Webhook Handler Example

```javascript
const express = require('express');
const app = express();

app.post('/webhook', express.json(), (req, res) => {
  const { event, instanceId, data } = req.body;
  
  console.log(`Received event: ${event} from instance: ${instanceId}`);
  
  switch (event) {
    case 'message.received':
      handleIncomingMessage(data);
      break;
    case 'connection.update':
      handleConnectionUpdate(data);
      break;
    case 'group.participants.update':
      handleGroupUpdate(data);
      break;
  }
  
  res.sendStatus(200);
});

app.listen(3001, () => {
  console.log('Webhook server running on port 3001');
});
```

### Webhook Management

```bash
# Test webhook
curl -X POST http://localhost:3000/api/webhook/test \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-webhook.com/webhook",
    "event": "message.received",
    "data": {"test": true}
  }'

# Get webhook logs
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/webhook/logs

# Get webhook statistics
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/webhook/stats
```

**[Complete Webhook Documentation →](./WEBHOOK_IMPLEMENTATION.md)**

---

## 🚢 Deployment

### Docker Deployment

```dockerfile
FROM node:17-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=mysql://user:password@db:3306/whatsapp_gateway
      - API_KEY=your-api-key
    depends_on:
      - db
    volumes:
      - ./sessions:/app/sessions

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=whatsapp_gateway
      - MYSQL_USER=user
      - MYSQL_PASSWORD=password
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

### Production Checklist

- [ ] Set strong `JWT_SECRET` and `API_KEY`
- [ ] Configure proper `DATABASE_URL`
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS
- [ ] Configure firewall rules
- [ ] Set up monitoring
- [ ] Configure backup strategy
- [ ] Review rate limits
- [ ] Set up logging
- [ ] Configure webhook URLs

---

## 🔒 Security

### Best Practices

1. **API Key Management**
   - Store API keys in environment variables
   - Never commit API keys to version control
   - Rotate API keys regularly
   - Use different keys for different environments

2. **Webhook Security**
   - Use HTTPS for webhook URLs
   - Implement signature verification
   - Validate incoming data
   - Rate limit webhook endpoints

3. **Instance Security**
   - Use unique instance IDs
   - Implement access control
   - Monitor instance activity
   - Log all operations

4. **Data Privacy**
   - Encrypt sensitive data
   - Implement data retention policies
   - Comply with GDPR/privacy laws
   - Secure database connections

### Rate Limiting

Default rate limits:
- **100 requests per 15 minutes** per IP address
- Configurable in `src/middleware/rateLimiter.js`

### Authentication

All protected endpoints require API key authentication:

```
X-API-Key: your-api-key-here
```

---

## 🐛 Troubleshooting

### Common Issues

#### Instance Not Connecting

```bash
# Check instance status
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/instance/my-instance/status

# Restart instance
curl -X POST -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/instance/my-instance/restart

# Get new QR code
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/instance/my-instance/qr
```

#### Messages Not Sending

1. Check instance is connected
2. Verify phone number format (`6281234567890@s.whatsapp.net`)
3. Check rate limits
4. Review error logs

#### Webhook Not Receiving Events

1. Verify webhook URL is accessible
2. Check webhook logs: `GET /api/webhook/logs`
3. Test webhook manually: `POST /api/webhook/test`
4. Review firewall settings

#### Database Connection Issues

1. Check MySQL is running
2. Verify `DATABASE_URL` in `.env`
3. Run Prisma migrations: `npx prisma migrate dev`
4. Check database permissions

### Debug Mode

Enable debug logging:

```env
NODE_ENV=development
DEBUG=whatsapp:*
```

### Logs

Check logs in:
- Console output
- `logs/` directory (if configured)
- Database webhook logs

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/whatsapp-gateway-api.git

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Code Style

- Follow ESLint configuration
- Use Prettier for formatting
- Write meaningful commit messages
- Add tests for new features
- Update documentation

### Reporting Issues

When reporting issues, please include:
- Node.js version
- MySQL version
- Error messages
- Steps to reproduce
- Expected vs actual behavior

---

## 📄 License

This project is licensed under the ISC License.

---

## 🙏 Acknowledgments

### Built With

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Express.js](https://expressjs.com/) - Web framework
- [Prisma](https://www.prisma.io/) - Database ORM
- [MySQL](https://www.mysql.com/) - Database

### Special Thanks

- WhatsApp for the amazing platform
- Baileys contributors for the excellent library
- All contributors to this project

---

## 📞 Support

For questions, issues, or feature requests:

- **Documentation**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Issues**: [GitHub Issues](https://github.com/radhityaa/ayasya-wagw/issues)
- **Discussions**: [GitHub Discussions](https://github.com/radhityaa/ayasya-wagw/discussions)

---

## 📊 Project Stats

- **128+ API Endpoints**
- **14 Feature Categories**
- **Multi-Instance Support**
- **Real-time Webhooks**
- **Production Ready**
- **Well Documented**

---

## 🎯 What This Service Provides

This is a **REST API service** that:
- ✅ Runs as a standalone HTTP server
- ✅ Provides 128+ HTTP endpoints for WhatsApp operations
- ✅ Manages WhatsApp Web connections internally
- ✅ Stores session data in MySQL database
- ✅ Sends webhooks to your application for incoming events
- ✅ Handles multiple WhatsApp accounts (multi-instance)

### What You Need to Build

Your application that:
- 📱 Calls this API service via HTTP requests
- 📱 Receives webhooks from this service
- 📱 Implements your business logic
- 📱 Provides your user interface (if needed)

### Architecture

```
┌─────────────────────┐
│  Your Application   │
│  (Any Language)     │
│                     │
│  - Web App          │
│  - Mobile App       │
│  - Desktop App      │
│  - Chatbot          │
│  - etc.             │
└──────────┬──────────┘
           │
           │ HTTP Requests
           │ (REST API Calls)
           ▼
┌─────────────────────┐
│  This API Service   │
│  (Node.js)          │
│                     │
│  - 128+ Endpoints   │
│  - Multi-Instance   │
│  - Webhooks         │
│  - MySQL Storage    │
└──────────┬──────────┘
           │
           │ WhatsApp Web Protocol
           │ (Baileys Library)
           ▼
┌─────────────────────┐
│   WhatsApp Servers  │
└─────────────────────┘
```

---

## 🔄 Similar Projects

This project is similar to:
- **WhatsApp Web.js** - But with REST API interface
- **Baileys** - But with HTTP API wrapper

---

**⚠️ Disclaimer**: This is an API service only. This project is not affiliated with WhatsApp. Use at your own discretion and ensure compliance with WhatsApp's Terms of Service.

---

<div align="center">

**Made with ❤️ for the developer community**

[⬆ Back to Top](#-whatsapp-gateway-api)

</div>