# Webhook Implementation Guide

## Overview
The WhatsApp Gateway API now includes a comprehensive webhook system with retry mechanism, logging, and monitoring capabilities.

## Features

### 1. Webhook Service (`src/services/webhookService.js`)
- **Automatic Retry**: Failed webhooks are automatically retried up to 3 times with exponential backoff
- **Logging**: All webhook attempts are logged to the database
- **Event Types**:
  - `session.status` - Connection status changes (qr, connecting, connected, disconnected)
  - `message.received` - Incoming messages
  - `message.sent` - Outgoing messages
  - `message.updated` - Message status updates

### 2. Webhook Management API (`/api/webhook`)

#### Test Webhook
```http
POST /api/webhook/test
Content-Type: application/json
X-API-Key: your-api-key

{
  "url": "https://your-webhook-endpoint.com/webhook"
}
```

#### Get Webhook Logs
```http
GET /api/webhook/logs?instanceId=xxx&limit=50&status=failed
X-API-Key: your-api-key
```

#### Get Specific Webhook Log
```http
GET /api/webhook/logs/:webhookId
X-API-Key: your-api-key
```

#### Retry Failed Webhook
```http
POST /api/webhook/retry/:webhookId
X-API-Key: your-api-key
```

#### Get Webhook Statistics
```http
GET /api/webhook/stats?instanceId=xxx&days=7
X-API-Key: your-api-key
```

#### Clear Webhook Logs
```http
DELETE /api/webhook/logs
Content-Type: application/json
X-API-Key: your-api-key

{
  "instanceId": "xxx",  // optional
  "days": 30            // optional - delete logs older than X days
}
```

### 3. Database Schema

#### WebhookLog Model
```prisma
model WebhookLog {
  id          String   @id @default(cuid())
  webhookId   String   @unique
  instanceId  String?
  url         String
  event       String
  payload     Json?
  status      String   // success, failed
  statusCode  Int?
  response    Json?
  error       String?
  attempts    Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  instance    Instance? @relation(fields: [instanceId], references: [id], onDelete: SetNull)
}
```

## Configuration

### Set Webhook URL for Instance
```http
PUT /api/instance/:instanceId
Content-Type: application/json
X-API-Key: your-api-key

{
  "webhookUrl": "https://your-webhook-endpoint.com/webhook"
}
```

### Webhook Payload Format

#### Session Status Event
```json
{
  "event": "session.status",
  "instanceId": "xxx",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "status": "connected",
    "phoneNumber": "6283841581033"
  }
}
```

#### Message Received Event
```json
{
  "event": "message.received",
  "instanceId": "xxx",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "messageId": "xxx",
    "from": "6281234567890@s.whatsapp.net",
    "chatId": "6281234567890@s.whatsapp.net",
    "body": "Hello!",
    "type": "text",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Retry Mechanism

- **Max Retries**: 3 attempts
- **Retry Delay**: Exponential backoff (5s, 10s, 15s)
- **Automatic**: Failed webhooks are automatically queued for retry
- **Manual**: Can manually retry failed webhooks via API

## Monitoring

### Webhook Statistics
The stats endpoint provides:
- Total webhook calls
- Success count
- Failed count
- Success rate percentage
- Top events by frequency
- Filtered by instance and time period

### Example Response
```json
{
  "success": true,
  "data": {
    "period": "7 days",
    "total": 150,
    "success": 145,
    "failed": 5,
    "successRate": "96.67",
    "topEvents": [
      {
        "event": "message.received",
        "_count": { "event": 100 }
      },
      {
        "event": "session.status",
        "_count": { "event": 50 }
      }
    ],
    "instanceId": "xxx"
  }
}
```

## Best Practices

1. **Endpoint Requirements**:
   - Must respond within 10 seconds
   - Should return 2xx status code for success
   - Should handle duplicate events (idempotent)

2. **Security**:
   - Validate webhook signatures (if implemented)
   - Use HTTPS endpoints
   - Implement rate limiting on your endpoint

3. **Error Handling**:
   - Log all webhook attempts
   - Monitor failed webhooks
   - Set up alerts for high failure rates

4. **Performance**:
   - Process webhooks asynchronously
   - Don't block the webhook response
   - Use queue systems for heavy processing

## Integration Example

### Node.js/Express Webhook Receiver
```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
  const { event, instanceId, data } = req.body;
  
  console.log(`Received ${event} from ${instanceId}:`, data);
  
  // Process webhook asynchronously
  processWebhook(event, instanceId, data).catch(console.error);
  
  // Respond immediately
  res.status(200).json({ received: true });
});

async function processWebhook(event, instanceId, data) {
  switch (event) {
    case 'message.received':
      // Handle incoming message
      await handleIncomingMessage(data);
      break;
    case 'session.status':
      // Handle status change
      await handleStatusChange(data);
      break;
  }
}

app.listen(3001, () => {
  console.log('Webhook receiver listening on port 3001');
});
```

## Troubleshooting

### Webhook Not Firing
1. Check if webhookUrl is set for the instance
2. Verify the endpoint is accessible
3. Check webhook logs for errors
4. Test the endpoint using the test webhook API

### High Failure Rate
1. Check endpoint response time
2. Verify endpoint returns 2xx status
3. Review error messages in webhook logs
4. Check network connectivity

### Missing Events
1. Verify event types are supported
2. Check if instance is connected
3. Review webhook logs for the time period
4. Ensure endpoint is not rate-limiting

## Migration

If you have existing instances, run the database migration:
```bash
npx prisma migrate dev --name add-webhook-log
```

Or reset the database (WARNING: This will delete all data):
```bash
npx prisma migrate reset
```

## Support

For issues or questions:
1. Check webhook logs via API
2. Review webhook statistics
3. Test webhook endpoint
4. Check server logs for errors
