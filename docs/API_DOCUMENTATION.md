# CloudBrain API Documentation

The CloudBrain Backend is a serverless API gateway running on Cloudflare Workers. It manages state, analytics, and orchestrates LLM interactions.

## 📡 Base URL
`https://api.coding.super25.ai`

## 🔑 Authentication
All requests (except health checks) require a Bearer token in the `Authorization` header.
```http
Authorization: Bearer <your_api_key>
```

## 🛣 Endpoints

### 1. Chat Gateway
Orchestrates LLM requests with context and persistent memory.

- **POST** `/gateway/chat`
- **Request Body**:
```json
{
  "prompt": "Task description",
  "model": "model-id (default: glm-4.7-flash)",
  "context": "Project file tree/context (optional)",
  "mode": "agent mode (e.g., default, fix, todo)",
  "history": [] // Optional message history
}
```

### 2. Session Reporting
Stores session telemetry and event logs for auditing.

- **POST** `/sessions/report`
- **Request Body**:
```json
{
  "sessionId": "UUID",
  "mode": "string",
  "prompt": "original prompt",
  "events": [], // FSM event log
  "finalState": "DONE | ABORTED",
  "commandsExecuted": 0,
  "commandsFailed": 0
}
```

### 3. Session Management
- **GET** `/sessions/:id`: Retrieve a specific session's history.
- **LIST** `/sessions`: (Admin) List all active/historical sessions.

## 💾 Storage & State
- **D1 Database**: Persistent storage for session metadata and user keys.
- **Durable Objects**: Maintains live coordination for long-running execution sessions.
- **R2 Bucket**: (Placeholder) Used for storing larger logs or generated assets.

## 🛠 Developer Workflow

1. **Gateway**: Cloudflare Hono Worker (`coding-brain-backend`).
2. **Framework**: Hono with Zod validation.
3. **Deployment**: `npx wrangler deploy`.

---
© 2026 CloudBrain API.
