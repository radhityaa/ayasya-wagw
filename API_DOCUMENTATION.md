# 📚 WhatsApp Gateway API - Complete Documentation

## Version: 1.0.0
## Base URL: `http://localhost:3000`

---

## 🌟 About This API

This is a **REST API service** that provides WhatsApp automation capabilities through HTTP endpoints.This service allows you to integrate WhatsApp messaging into your applications without dealing with the complexity of WhatsApp Web protocol directly.

### What This Documentation Covers

This documentation provides complete reference for all **128+ HTTP endpoints** available in this API service. Each endpoint is documented with:
- HTTP method and URL
- Required authentication
- Request parameters and body format
- Response format and examples
- Error handling

### How to Use This API

1. **Deploy this API service** on your server (see [Installation Guide](./README.md#installation))
2. **Generate an API key** for authentication
3. **Make HTTP requests** from your application to this API service
4. **Receive webhooks** for incoming WhatsApp events

### Integration Architecture

```
Your Application (Any Language)
    ↓ HTTP Requests (REST API Calls)
This API Service (Node.js)
    ↓ WhatsApp Web Protocol (Baileys)
WhatsApp Servers
```

---

## 📑 Table of Contents

1. [Authentication](#authentication)
2. [Instance Management](#instance-management)
3. [Messaging](#messaging)
4. [Groups](#groups)
5. [Status/Stories](#statusstories)
6. [Contacts](#contacts)
7. [Presence](#presence)
8. [Events](#events)
9. [Labels](#labels)
10. [Media](#media)
11. [Channels](#channels)
12. [Profile](#profile)
13. [Webhooks](#webhooks)
14. [Observability](#observability)
15. [Error Codes](#error-codes)
16. [Rate Limiting](#rate-limiting)

---

## 🔐 Authentication

All protected endpoints require an API key in the request header.

### Header Format
```
X-API-Key: your-api-key-here
```

### Generate API Key
```http
POST /api/auth/generate-key
Content-Type: application/json

{
  "name": "My API Key"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "My API Key",
    "apiKey": "ecad2deb-e9e5-4215-ac6c-e5a5e80fa8ab",
    "permissions": ["read", "write"],
    "createdAt": "2025-11-07T08:00:00.000Z"
  }
}
```

---

## 📱 Instance Management

### Create Instance
```http
POST /api/instance/create
X-API-Key: your-api-key
Content-Type: application/json

{
  "name": "My WhatsApp Instance",
  "webhookUrl": "https://your-webhook.com/webhook"
}
```

**Request Body:**
- `name` (required): A friendly name for your instance
- `webhookUrl` (optional): URL to receive webhook events

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "auto-generated-uuid",
    "name": "My WhatsApp Instance",
    "webhookUrl": "https://your-webhook.com/webhook",
    "status": "disconnected",
    "createdAt": "2025-11-07T08:00:00.000Z"
  },
  "message": "Instance created successfully. Please scan the QR code."
}
```

**Note:** The instance ID is automatically generated as a UUID. You don't need to provide it.

### Get Instance Status
```http
GET /api/instance/:instanceId/status
X-API-Key: your-api-key
```

### Get QR Code
```http
GET /api/instance/:instanceId/qr
X-API-Key: your-api-key
```

### List All Instances
```http
GET /api/instance
X-API-Key: your-api-key
```

### Delete Instance
```http
DELETE /api/instance/:instanceId
X-API-Key: your-api-key
```

### Restart Instance
```http
POST /api/instance/:instanceId/restart
X-API-Key: your-api-key
```

### Logout Instance
```http
POST /api/instance/:instanceId/logout
X-API-Key: your-api-key
```

---

## 💬 Messaging

### Send Text Message
```http
POST /api/message/send/text
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "to": "6281234567890@s.whatsapp.net",
  "message": "Hello World!"
}
```

### Send Image
```http
POST /api/message/send/image
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "to": "6281234567890@s.whatsapp.net",
  "image": "https://example.com/image.jpg",
  "caption": "Check this out!"
}
```

### Send File/Document
```http
POST /api/message/send/file
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "to": "6281234567890@s.whatsapp.net",
  "file": "https://example.com/document.pdf",
  "filename": "document.pdf",
  "caption": "Important document"
}
```

### Send Voice Note
```http
POST /api/message/send/voice
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "to": "6281234567890@s.whatsapp.net",
  "audio": "https://example.com/voice.ogg"
}
```

### Send Video
```http
POST /api/message/send/video
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "to": "6281234567890@s.whatsapp.net",
  "video": "https://example.com/video.mp4",
  "caption": "Check this video!"
}
```

### Send Link with Preview
```http
POST /api/message/send/link-preview
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "to": "6281234567890@s.whatsapp.net",
  "url": "https://example.com",
  "title": "Example Website",
  "description": "This is an example",
  "image": "https://example.com/preview.jpg"
}
```

### Send List Message
```http
POST /api/message/send/list
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "to": "6281234567890@s.whatsapp.net",
  "title": "Choose an option",
  "buttonText": "View Options",
  "sections": [
    {
      "title": "Section 1",
      "rows": [
        {
          "title": "Option 1",
          "description": "Description 1",
          "rowId": "option1"
        }
      ]
    }
  ]
}
```

### Send Button Message
```http
POST /api/message/send/buttons
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "to": "6281234567890@s.whatsapp.net",
  "text": "Choose an action",
  "buttons": [
    {
      "buttonId": "btn1",
      "buttonText": "Button 1"
    },
    {
      "buttonId": "btn2",
      "buttonText": "Button 2"
    }
  ]
}
```

### Send Poll
```http
POST /api/message/send/poll
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "to": "6281234567890@s.whatsapp.net",
  "question": "What's your favorite color?",
  "options": ["Red", "Blue", "Green"],
  "selectableCount": 1
}
```

### Send Location
```http
POST /api/message/send/location
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "to": "6281234567890@s.whatsapp.net",
  "latitude": -6.2088,
  "longitude": 106.8456,
  "name": "Jakarta",
  "address": "Jakarta, Indonesia"
}
```

### Send Contact vCard
```http
POST /api/message/send/contact
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "to": "6281234567890@s.whatsapp.net",
  "contacts": [
    {
      "displayName": "John Doe",
      "vcard": "BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nTEL:+6281234567890\nEND:VCARD"
    }
  ]
}
```

### Forward Message
```http
POST /api/message/forward
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "to": "6281234567890@s.whatsapp.net",
  "messageId": "message-id-to-forward"
}
```

### Mark as Read
```http
POST /api/message/seen
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "chatId": "6281234567890@s.whatsapp.net",
  "messageId": "message-id"
}
```

### Start Typing
```http
POST /api/message/typing/start
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "chatId": "6281234567890@s.whatsapp.net"
}
```

### Stop Typing
```http
POST /api/message/typing/stop
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "chatId": "6281234567890@s.whatsapp.net"
}
```

### Add Reaction
```http
PUT /api/message/reaction
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "chatId": "6281234567890@s.whatsapp.net",
  "messageId": "message-id",
  "emoji": "👍"
}
```

### Star Message
```http
PUT /api/message/star
X-API-Key: your-api-key
Content-Type: application/json

{
  "instanceId": "my-instance",
  "chatId": "6281234567890@s.whatsapp.net",
  "messageId": "message-id",
  "star": true
}
```

### Get Chats
```http
GET /api/message/chats/:instanceId
X-API-Key: your-api-key
```

### Get Chat Messages
```http
GET /api/message/chat/:instanceId/:chatId
X-API-Key: your-api-key
```

### Delete Message
```http
DELETE /api/message/:instanceId/:messageId
X-API-Key: your-api-key
```

---

## 👥 Groups

### Get All Groups
```http
GET /api/groups/:instanceId
X-API-Key: your-api-key
```

### Create Group
```http
POST /api/groups/:instanceId
X-API-Key: your-api-key
Content-Type: application/json

{
  "name": "My Group",
  "participants": [
    "6281234567890@s.whatsapp.net",
    "6289876543210@s.whatsapp.net"
  ]
}
```

### Get Group Info
```http
GET /api/groups/:instanceId/:groupId
X-API-Key: your-api-key
```

### Update Group Name
```http
PUT /api/groups/:instanceId/:groupId/name
X-API-Key: your-api-key
Content-Type: application/json

{
  "name": "New Group Name"
}
```

### Update Group Description
```http
PUT /api/groups/:instanceId/:groupId/description
X-API-Key: your-api-key
Content-Type: application/json

{
  "description": "New group description"
}
```

### Update Group Subject
```http
PUT /api/groups/:instanceId/:groupId/subject
X-API-Key: your-api-key
Content-Type: application/json

{
  "subject": "New Subject"
}
```

### Add Participants
```http
POST /api/groups/:instanceId/:groupId/participants
X-API-Key: your-api-key
Content-Type: application/json

{
  "participants": [
    "6281234567890@s.whatsapp.net"
  ]
}
```

### Remove Participants
```http
DELETE /api/groups/:instanceId/:groupId/participants
X-API-Key: your-api-key
Content-Type: application/json

{
  "participants": [
    "6281234567890@s.whatsapp.net"
  ]
}
```

### Promote to Admin
```http
POST /api/groups/:instanceId/:groupId/promote
X-API-Key: your-api-key
Content-Type: application/json

{
  "participants": [
    "6281234567890@s.whatsapp.net"
  ]
}
```

### Demote Admin
```http
POST /api/groups/:instanceId/:groupId/demote
X-API-Key: your-api-key
Content-Type: application/json

{
  "participants": [
    "6281234567890@s.whatsapp.net"
  ]
}
```

### Update Group Settings
```http
PUT /api/groups/:instanceId/:groupId/settings
X-API-Key: your-api-key
Content-Type: application/json

{
  "announcement": true,
  "locked": false,
  "ephemeral": 86400
}
```

### Leave Group
```http
POST /api/groups/:instanceId/:groupId/leave
X-API-Key: your-api-key
```

### Get Invite Code
```http
GET /api/groups/:instanceId/:groupId/invite-code
X-API-Key: your-api-key
```

### Revoke Invite Code
```http
POST /api/groups/:instanceId/:groupId/revoke-invite
X-API-Key: your-api-key
```

### Accept Invite
```http
POST /api/groups/:instanceId/accept-invite
X-API-Key: your-api-key
Content-Type: application/json

{
  "inviteCode": "invite-code-here"
}
```

### Get Group Participants
```http
GET /api/groups/:instanceId/:groupId/participants
X-API-Key: your-api-key
```

### Send Message to Group
```http
POST /api/groups/:instanceId/:groupId/message
X-API-Key: your-api-key
Content-Type: application/json

{
  "message": "Hello group!"
}
```

---

## 📱 Status/Stories

### Send Text Status
```http
POST /api/status/:instanceId/text
X-API-Key: your-api-key
Content-Type: application/json

{
  "text": "My status update",
  "backgroundColor": "#25D366",
  "font": 1
}
```

### Send Image Status
```http
POST /api/status/:instanceId/image
X-API-Key: your-api-key
Content-Type: application/json

{
  "image": "https://example.com/image.jpg",
  "caption": "Check this out!"
}
```

### Send Voice Status
```http
POST /api/status/:instanceId/voice
X-API-Key: your-api-key
Content-Type: application/json

{
  "audio": "https://example.com/voice.ogg"
}
```

### Send Video Status
```http
POST /api/status/:instanceId/video
X-API-Key: your-api-key
Content-Type: application/json

{
  "video": "https://example.com/video.mp4",
  "caption": "My video status"
}
```

### Delete Status
```http
POST /api/status/:instanceId/delete
X-API-Key: your-api-key
Content-Type: application/json

{
  "messageId": "status-message-id"
}
```

### Generate New Message ID
```http
GET /api/status/:instanceId/new-message-id
X-API-Key: your-api-key
```

---

## 📇 Contacts

### Get All Contacts
```http
GET /api/contacts/:instanceId/all
X-API-Key: your-api-key
```

### Get Contact Info
```http
GET /api/contacts/:instanceId?phoneNumber=6281234567890
X-API-Key: your-api-key
```

### Check if Contact Exists
```http
GET /api/contacts/:instanceId/check-exists?phoneNumber=6281234567890
X-API-Key: your-api-key
```

### Get Profile Picture
```http
GET /api/contacts/:instanceId/about?phoneNumber=6281234567890
X-API-Key: your-api-key
```

### Block Contact
```http
POST /api/contacts/:instanceId/block
X-API-Key: your-api-key
Content-Type: application/json

{
  "phoneNumber": "6281234567890"
}
```

### Unblock Contact
```http
POST /api/contacts/:instanceId/unblock
X-API-Key: your-api-key
Content-Type: application/json

{
  "phoneNumber": "6281234567890"
}
```

### Update Contact
```http
PUT /api/contacts/:instanceId/:chatId
X-API-Key: your-api-key
Content-Type: application/json

{
  "name": "New Contact Name"
}
```

### Get All LIDs
```http
GET /api/contacts/:instanceId/lids
X-API-Key: your-api-key
```

### Get LID Count
```http
GET /api/contacts/:instanceId/lids/count
X-API-Key: your-api-key
```

### Get Phone Number by LID
```http
GET /api/contacts/:instanceId/lids/:lid
X-API-Key: your-api-key
```

### Get LID by Phone Number
```http
GET /api/contacts/:instanceId/lids/pn/:phoneNumber
X-API-Key: your-api-key
```

---

## 👁️ Presence

### Set Presence
```http
POST /api/presence/:instanceId
X-API-Key: your-api-key
Content-Type: application/json

{
  "presence": "available"
}
```

**Presence Options:**
- `available` - Online
- `unavailable` - Offline
- `composing` - Typing
- `recording` - Recording audio
- `paused` - Stopped typing

### Get All Presence
```http
GET /api/presence/:instanceId
X-API-Key: your-api-key
```

### Get Specific Chat Presence
```http
GET /api/presence/:instanceId/:chatId
X-API-Key: your-api-key
```

### Subscribe to Presence Updates
```http
POST /api/presence/:instanceId/:chatId/subscribe
X-API-Key: your-api-key
```

---

## 🎉 Events

### Send Event Message
```http
POST /api/events/:instanceId
X-API-Key: your-api-key
Content-Type: application/json

{
  "to": "6281234567890@s.whatsapp.net",
  "event": "birthday",
  "name": "John's Birthday Party",
  "description": "Come celebrate!",
  "location": "My House",
  "startTime": "2025-12-25T18:00:00.000Z",
  "endTime": "2025-12-25T23:00:00.000Z"
}
```

**Event Types:**
- `birthday`
- `appointment`
- `meeting`
- `reminder`
- `custom`

---

## 🏷️ Labels (WhatsApp Business Only)

### Get All Labels
```http
GET /api/labels/:instanceId
X-API-Key: your-api-key
```

### Create Label
```http
POST /api/labels/:instanceId
X-API-Key: your-api-key
Content-Type: application/json

{
  "name": "Important",
  "color": 1
}
```

**Color Options:** 0-19

### Update Label
```http
PUT /api/labels/:instanceId/:labelId
X-API-Key: your-api-key
Content-Type: application/json

{
  "name": "Very Important",
  "color": 2
}
```

### Delete Label
```http
DELETE /api/labels/:instanceId/:labelId
X-API-Key: your-api-key
```

### Get Chat Labels
```http
GET /api/labels/:instanceId/chats/:chatId
X-API-Key: your-api-key
```

### Save Chat Labels
```http
PUT /api/labels/:instanceId/chats/:chatId
X-API-Key: your-api-key
Content-Type: application/json

{
  "labelIds": ["label-id-1", "label-id-2"]
}
```

### Get Chats by Label
```http
GET /api/labels/:instanceId/:labelId/chats
X-API-Key: your-api-key
```

---

## 🎬 Media (Requires FFmpeg)

### Convert Voice to Opus
```http
POST /api/media/:instanceId/convert/voice
X-API-Key: your-api-key
Content-Type: application/json

{
  "filePath": "/path/to/audio.mp3"
}
```

**Or with base64:**
```json
{
  "base64": "base64-encoded-audio-data",
  "mimeType": "audio/mpeg"
}
```

### Convert Video to MP4
```http
POST /api/media/:instanceId/convert/video
X-API-Key: your-api-key
Content-Type: application/json

{
  "filePath": "/path/to/video.avi"
}
```

**Or with base64:**
```json
{
  "base64": "base64-encoded-video-data",
  "mimeType": "video/x-msvideo"
}
```

---

## 📢 Channels

### Get All Channels
```http
GET /api/channels/:instanceId
X-API-Key: your-api-key
```

### Follow Channel
```http
POST /api/channels/:instanceId/:channelId/follow
X-API-Key: your-api-key
```

### Unfollow Channel
```http
POST /api/channels/:instanceId/:channelId/unfollow
X-API-Key: your-api-key
```

### Mute Channel
```http
POST /api/channels/:instanceId/:channelId/mute
X-API-Key: your-api-key
Content-Type: application/json

{
  "duration": 86400
}
```

### Unmute Channel
```http
POST /api/channels/:instanceId/:channelId/unmute
X-API-Key: your-api-key
```

---

## 👤 Profile

### Get Profile
```http
GET /api/profile/:instanceId
X-API-Key: your-api-key
```

### Update Name
```http
PUT /api/profile/:instanceId/name
X-API-Key: your-api-key
Content-Type: application/json

{
  "name": "New Name"
}
```

### Update Status
```http
PUT /api/profile/:instanceId/status
X-API-Key: your-api-key
Content-Type: application/json

{
  "status": "Hey there! I'm using WhatsApp"
}
```

### Update Picture
```http
PUT /api/profile/:instanceId/picture
X-API-Key: your-api-key
Content-Type: application/json

{
  "image": "https://example.com/profile.jpg"
}
```

### Delete Picture
```http
DELETE /api/profile/:instanceId/picture
X-API-Key: your-api-key
```

---

## 🔔 Webhooks

### Test Webhook
```http
POST /api/webhook/test
X-API-Key: your-api-key
Content-Type: application/json

{
  "url": "https://your-webhook.com/webhook",
  "event": "message.received",
  "data": {
    "test": true
  }
}
```

### Get Webhook Logs
```http
GET /api/webhook/logs
X-API-Key: your-api-key
```

### Get Webhook Stats
```http
GET /api/webhook/stats
X-API-Key: your-api-key
```

### Retry Webhook
```http
POST /api/webhook/retry/:webhookId
X-API-Key: your-api-key
```

### Clear Logs
```http
DELETE /api/webhook/logs
X-API-Key: your-api-key
```

---

## 📊 Observability

### Ping (Public)
```http
GET /api/observability/ping
```

**Response:**
```json
{
  "success": true,
  "message": "pong",
  "timestamp": "2025-11-07T08:00:00.000Z"
}
```

### Health Check (Public)
```http
GET /api/observability/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": {
      "seconds": 3600,
      "formatted": "1h 0m 0s"
    },
    "memory": {
      "rss": "150.25 MB",
      "heapTotal": "80.50 MB",
      "heapUsed": "60.30 MB",
      "external": "5.20 MB"
    },
    "database": {
      "status": "connected"
    },
    "instances": {
      "total": 5,
      "active": 3
    }
  }
}
```

### Get Version
```http
GET /api/observability/version
X-API-Key: your-api-key
```

### Get Environment
```http
GET /api/observability/environment
X-API-Key: your-api-key
```

### Get Status
```http
GET /api/observability/status
X-API-Key: your-api-key
```

### Stop Server (Dangerous)
```http
POST /api/observability/stop
X-API-Key: your-api-key
```

### Restart Server (Dangerous)
```http
POST /api/observability/restart
X-API-Key: your-api-key
```

---

## ⚠️ Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid API key |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 501 | Not Implemented | Feature not supported |

### Error Response Format
```json
{
  "success": false,
  "error": "Error message here",
  "details": "Additional error details"
}
```

---

## 🚦 Rate Limiting

- **General Limit:** 100 requests per 15 minutes per IP
- **Headers:**
  - `RateLimit-Limit`: Maximum requests allowed
  - `RateLimit-Remaining`: Remaining requests
  - `RateLimit-Reset`: Time until limit resets (seconds)

### Rate Limit Response
```json
{
  "success": false,
  "error": "Too many requests, please try again later"
}
```

---

## 📝 Webhook Events

Your webhook will receive POST requests for these events:

### Message Events
- `message.received` - New message received
- `message.sent` - Message sent successfully
- `message.failed` - Message failed to send
- `message.read` - Message read by recipient
- `message.delivered` - Message delivered

### Connection Events
- `connection.open` - Connection established
- `connection.close` - Connection closed
- `connection.update` - Connection status updated

### Group Events
- `group.join` - Joined a group
- `group.leave` - Left a group
- `group.update` - Group info updated
- `group.participants.update` - Participants changed

### Call Events
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

---

## 🔧 Best Practices

### 1. Error Handling
Always check the `success` field in responses:
```javascript
if (response.success) {
  // Handle success
} else {
  // Handle error
  console.error(response.error);
}
```

### 2. Rate Limiting
Implement exponential backoff for rate limit errors:
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      throw error;
    }
  }
}
```

### 3. Webhook Security
Verify webhook signatures:
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return hash === signature;
}
```

### 4. Instance Management
Always check instance status before sending messages:
```javascript
const status = await getInstanceStatus(instanceId);
if (status.data.status === 'connected') {
  await sendMessage(instanceId, to, message);
}
```

---

## 📚 Code Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

const API_KEY = 'your-api-key';
const BASE_URL = 'http://localhost:3000';

async function sendMessage(instanceId, to, message) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/message/send/text`,
      {
        instanceId,
        to,
        message
      },
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
sendMessage('my-instance', '6281234567890@s.whatsapp.net', 'Hello!')
  .then(result => console.log('Success:', result))
  .catch(error => console.error('Failed:', error));
```

### Python
```python
import requests

API_KEY = 'your-api-key'
BASE_URL = 'http://localhost:3000'

def send_message(instance_id, to, message):
    headers = {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
    }
    
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

# Usage
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

// Usage
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

# Get instance status
curl -X GET http://localhost:3000/api/instance/my-instance/status \
  -H "X-API-Key: your-api-key"

# Health check (no auth required)
curl -X GET http://localhost:3000/api/observability/health
```

---

## 🎯 Quick Start Guide

### 1. Generate API Key
```bash
curl -X POST http://localhost:3000/api/auth/generate-key \
  -H "Content-Type: application/json" \
  -d '{"name": "My First Key"}'
```

### 2. Create WhatsApp Instance
```bash
curl -X POST http://localhost:3000/api/instance/create \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Instance",
    "webhookUrl": "https://your-webhook.com/webhook"
  }'
```

**Note:** The instance ID will be automatically generated and returned in the response.

### 3. Get QR Code
```bash
curl -X GET http://localhost:3000/api/instance/my-first-instance/qr \
  -H "X-API-Key: your-api-key"
```

Scan the QR code with WhatsApp mobile app.

### 4. Send Your First Message
```bash
curl -X POST http://localhost:3000/api/message/send/text \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "my-first-instance",
    "to": "6281234567890@s.whatsapp.net",
    "message": "Hello World!"
  }'
```

---

## 🔍 Common Use Cases

### 1. Broadcast Messages
```javascript
async function broadcastMessage(instanceId, recipients, message) {
  const results = [];
  
  for (const recipient of recipients) {
    try {
      const result = await sendMessage(instanceId, recipient, message);
      results.push({ recipient, success: true, result });
    } catch (error) {
      results.push({ recipient, success: false, error: error.message });
    }
    
    // Add delay to avoid rate limiting
    await sleep(1000);
  }
  
  return results;
}
```

### 2. Auto-Reply Bot
```javascript
// Webhook handler
app.post('/webhook', (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'message.received') {
    const { from, message, instanceId } = data;
    
    // Auto-reply logic
    if (message.conversation) {
      const reply = generateReply(message.conversation);
      sendMessage(instanceId, from, reply);
    }
  }
  
  res.sendStatus(200);
});
```

### 3. Group Management Bot
```javascript
async function manageGroup(instanceId, groupId, command, params) {
  switch (command) {
    case 'add':
      return await addParticipants(instanceId, groupId, params.participants);
    case 'remove':
      return await removeParticipants(instanceId, groupId, params.participants);
    case 'promote':
      return await promoteToAdmin(instanceId, groupId, params.participants);
    case 'demote':
      return await demoteAdmin(instanceId, groupId, params.participants);
    default:
      throw new Error('Unknown command');
  }
}
```

### 4. Status Monitor
```javascript
async function monitorInstances() {
  const instances = await getAllInstances();
  
  for (const instance of instances) {
    const status = await getInstanceStatus(instance.id);
    
    if (status.data.status !== 'connected') {
      console.log(`Instance ${instance.id} is disconnected`);
      // Send alert or restart instance
      await restartInstance(instance.id);
    }
  }
}

// Run every 5 minutes
setInterval(monitorInstances, 5 * 60 * 1000);
```

---

## 📱 Phone Number Format

WhatsApp uses JID (Jabber ID) format for phone numbers:

### Individual Chats
```
[country_code][phone_number]@s.whatsapp.net
```

Examples:
- Indonesia: `6281234567890@s.whatsapp.net`
- USA: `11234567890@s.whatsapp.net`
- UK: `441234567890@s.whatsapp.net`

### Group Chats
```
[group_id]@g.us
```

Example: `120363123456789012@g.us`

### Broadcast Lists
```
[broadcast_id]@broadcast
```

---

## 🛡️ Security Best Practices

### 1. API Key Management
- Store API keys in environment variables
- Never commit API keys to version control
- Rotate API keys regularly
- Use different keys for different environments

### 2. Webhook Security
- Use HTTPS for webhook URLs
- Implement signature verification
- Validate incoming data
- Rate limit webhook endpoints

### 3. Instance Security
- Use unique instance IDs
- Implement access control
- Monitor instance activity
- Log all operations

### 4. Data Privacy
- Encrypt sensitive data
- Implement data retention policies
- Comply with GDPR/privacy laws
- Secure database connections

---

## 🐛 Troubleshooting

### Instance Not Connecting
```bash
# Check instance status
curl -X GET http://localhost:3000/api/instance/my-instance/status \
  -H "X-API-Key: your-api-key"

# Restart instance
curl -X POST http://localhost:3000/api/instance/my-instance/restart \
  -H "X-API-Key: your-api-key"

# Get new QR code
curl -X GET http://localhost:3000/api/instance/my-instance/qr \
  -H "X-API-Key: your-api-key"
```

### Messages Not Sending
1. Check instance is connected
2. Verify phone number format
3. Check rate limits
4. Review error logs

### Webhook Not Receiving Events
1. Verify webhook URL is accessible
2. Check webhook logs
3. Test webhook manually
4. Review firewall settings

### Database Connection Issues
1. Check MySQL is running
2. Verify DATABASE_URL in .env
3. Run Prisma migrations
4. Check database permissions

---

## 📊 Performance Tips

### 1. Batch Operations
```javascript
// Instead of sending messages one by one
for (const recipient of recipients) {
  await sendMessage(instanceId, recipient, message);
}

// Use Promise.all for parallel execution
await Promise.all(
  recipients.map(recipient => 
    sendMessage(instanceId, recipient, message)
  )
);
```

### 2. Connection Pooling
```javascript
// Configure database connection pool
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error'],
  pool: {
    min: 2,
    max: 10,
  },
});
```

### 3. Caching
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 });

async function getInstanceStatus(instanceId) {
  const cacheKey = `status:${instanceId}`;
  let status = cache.get(cacheKey);
  
  if (!status) {
    status = await fetchInstanceStatus(instanceId);
    cache.set(cacheKey, status);
  }
  
  return status;
}
```

### 4. Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later'
});

app.use('/api/', limiter);
```

---

## 📈 Monitoring & Logging

### Health Check Endpoint
```bash
# Check if server is healthy
curl http://localhost:3000/api/observability/health
```

### Server Metrics
```bash
# Get comprehensive server status
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/observability/status
```

### Webhook Logs
```bash
# Get webhook delivery logs
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/webhook/logs

# Get webhook statistics
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/webhook/stats
```

---

## 🔄 Migration Guide

### From Other WhatsApp APIs

#### From Twilio WhatsApp API
```javascript
// Twilio
client.messages.create({
  from: 'whatsapp:+14155238886',
  body: 'Hello',
  to: 'whatsapp:+15551234567'
});

// This API
sendMessage('my-instance', '15551234567@s.whatsapp.net', 'Hello');
```

#### From WhatsApp Business API
```javascript
// WABA
POST https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/messages
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "text": { "body": "Hello" }
}

// This API
POST http://localhost:3000/api/message/send/text
{
  "instanceId": "my-instance",
  "to": "15551234567@s.whatsapp.net",
  "message": "Hello"
}
```

---

## 📞 Support & Resources

### Documentation
- API Documentation: This file
- Implementation Guide: `IMPLEMENTATION_SUMMARY.md`
- Webhook Guide: `WEBHOOK_IMPLEMENTATION.md`
- Testing Results: `TESTING_RESULTS_FINAL.md`

### Test Files
- HTTP Tests: `test-observability.http`
- Automated Tests: `test-all-new-endpoints.js`
- API Examples: `api-examples.http`

### External Resources
- Baileys Documentation: https://baileys.wiki/docs/intro
- WhatsApp Web Protocol: https://github.com/WhiskeySockets/Baileys
- Prisma Documentation: https://www.prisma.io/docs

---

## 📄 License

This API is provided as-is for educational and development purposes.

---

## 🎉 Changelog

### Version 1.0.0 (2025-11-07)
- ✅ Initial release
- ✅ 128+ endpoints implemented
- ✅ Multi-instance support
- ✅ Webhook integration
- ✅ Complete messaging features
- ✅ Group management
- ✅ Status/Stories support
- ✅ Contact operations
- ✅ Presence tracking
- ✅ Event messages
- ✅ Labels (WhatsApp Business)
- ✅ Media conversion
- ✅ Observability & monitoring
- ✅ Rate limiting
- ✅ API key authentication

---

## 🚀 Future Enhancements

### Planned Features
- [ ] Multi-device support improvements
- [ ] Advanced message scheduling
- [ ] Template message support
- [ ] Analytics dashboard
- [ ] Message queue system
- [ ] Redis caching
- [ ] Docker deployment
- [ ] Kubernetes support
- [ ] GraphQL API
- [ ] WebSocket real-time updates

---

**Last Updated:** 2025-11-07  
**API Version:** 1.0.0  
**Documentation Version:** 1.0.0

---

For questions or issues, please refer to the test files and implementation documentation included in this project.
