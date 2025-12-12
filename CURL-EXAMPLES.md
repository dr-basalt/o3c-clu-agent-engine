# API Testing with cURL Examples

This document provides comprehensive cURL examples for testing all API endpoints of the O3C Agent Engine.

## Base URL

```bash
export BASE_URL="http://localhost:3000/api/v1"
# Or for production:
# export BASE_URL="https://your-domain.com/api/v1"
```

## Authentication

### Register a New User

```bash
curl -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "secure_password123",
    "name": "New User"
  }'
```

### Login

```bash
curl -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@o3c.dev",
    "password": "password123"
  }'
```

Response will include:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": { ... }
  }
}
```

**Save the token for subsequent requests:**

```bash
export TOKEN="eyJhbGciOiJIUzI1NiIs..."
# Or using API Key:
export API_KEY="your-api-key-from-seed"
```

### Get Current User

```bash
curl -X GET $BASE_URL/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Generate API Key

```bash
curl -X POST $BASE_URL/auth/api-keys \
  -H "Authorization: Bearer $TOKEN"
```

---

## Providers Management

### Create Provider Config (OpenAI)

```bash
curl -X POST $BASE_URL/providers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerName": "openai",
    "flavor": "openai",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-...",
    "isDefault": true,
    "defaultModel": "gpt-4"
  }'
```

### Create Provider Config (Anthropic)

```bash
curl -X POST $BASE_URL/providers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerName": "anthropic",
    "flavor": "anthropic",
    "apiKey": "sk-ant-...",
    "isDefault": false,
    "defaultModel": "claude-3-opus-20240229"
  }'
```

### List Providers

```bash
curl -X GET $BASE_URL/providers \
  -H "Authorization: Bearer $TOKEN"
```

### Test Provider Connection

```bash
curl -X POST "$BASE_URL/providers/{provider-id}/test" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Agents Management

### Create an Agent

```bash
curl -X POST $BASE_URL/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Email Assistant",
    "description": "Helps manage and organize emails",
    "systemPrompt": "You are an AI assistant specialized in email management. Help users organize, prioritize, and respond to emails efficiently.",
    "mcpServers": [
      {
        "name": "gmail",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-gmail"]
      }
    ],
    "tools": ["search", "compose"],
    "allowShell": false,
    "maxIterations": 10,
    "metadata": {
      "category": "productivity"
    }
  }'
```

### List All Agents

```bash
curl -X GET "$BASE_URL/agents?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Agent by ID

```bash
curl -X GET "$BASE_URL/agents/{agent-id}" \
  -H "Authorization: Bearer $TOKEN"
```

### Update Agent

```bash
curl -X PUT "$BASE_URL/agents/{agent-id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Agent Name",
    "systemPrompt": "Updated system prompt"
  }'
```

### Delete Agent

```bash
curl -X DELETE "$BASE_URL/agents/{agent-id}" \
  -H "Authorization: Bearer $TOKEN"
```

### Execute an Agent

```bash
curl -X POST "$BASE_URL/agents/{agent-id}/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Analyze my latest emails and summarize urgent ones"
  }'
```

Response includes `runId` for tracking execution.

### Schedule an Agent

```bash
curl -X POST "$BASE_URL/agents/{agent-id}/schedule" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleCron": "0 9 * * *"
  }'
```

Schedule expressions:
- `0 9 * * *` - Every day at 9 AM
- `0 */6 * * *` - Every 6 hours
- `0 9 * * 1` - Every Monday at 9 AM

### Remove Schedule

```bash
curl -X DELETE "$BASE_URL/agents/{agent-id}/schedule" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Workflows Management

### Create a Workflow

```bash
curl -X POST $BASE_URL/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Email Processing Pipeline",
    "description": "Fetch emails, analyze sentiment, and generate summary",
    "steps": [
      {
        "agentId": "{email-agent-id}",
        "order": 0,
        "inputMapping": {},
        "metadata": { "stepName": "Fetch Emails" }
      },
      {
        "agentId": "{analyzer-agent-id}",
        "order": 1,
        "inputMapping": { "data": "emails" },
        "metadata": { "stepName": "Analyze Sentiment" }
      },
      {
        "agentId": "{summary-agent-id}",
        "order": 2,
        "inputMapping": { "analysis": "output" },
        "metadata": { "stepName": "Generate Summary" }
      }
    ]
  }'
```

### List Workflows

```bash
curl -X GET "$BASE_URL/workflows?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Workflow by ID

```bash
curl -X GET "$BASE_URL/workflows/{workflow-id}" \
  -H "Authorization: Bearer $TOKEN"
```

### Update Workflow

```bash
curl -X PUT "$BASE_URL/workflows/{workflow-id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Workflow Name",
    "description": "Updated description"
  }'
```

### Execute a Workflow

```bash
curl -X POST "$BASE_URL/workflows/{workflow-id}/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inputData": {
      "emailFilter": "unread",
      "maxCount": 50
    }
  }'
```

Response includes `executionId` for tracking.

### Get Workflow Execution Status

```bash
curl -X GET "$BASE_URL/workflows/executions/{execution-id}" \
  -H "Authorization: Bearer $TOKEN"
```

### List Workflow Executions

```bash
curl -X GET "$BASE_URL/workflows/{workflow-id}/executions?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Discovery (Workspace Scanning)

### Discover Agents in Workspace

```bash
curl -X GET $BASE_URL/discovery/agents \
  -H "Authorization: Bearer $TOKEN"
```

### Discover Workflows in Workspace

```bash
curl -X GET $BASE_URL/discovery/workflows \
  -H "Authorization: Bearer $TOKEN"
```

### Import a Discovered Agent

```bash
curl -X POST "$BASE_URL/discovery/agents/{agent-name}/import" \
  -H "Authorization: Bearer $TOKEN"
```

### Sync All Discovered Agents

```bash
curl -X POST $BASE_URL/discovery/agents/sync \
  -H "Authorization: Bearer $TOKEN"
```

---

## TTY Streaming Service

### Send a Natural Language Command

```bash
curl -X POST $BASE_URL/tty/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "Create agent to analyze GitHub repositories"
  }'
```

Response includes `sessionId` and `streamUrl`.

### Stream Output via SSE

```bash
curl -N -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/tty/stream/{session-id}"
```

Example Natural Language Commands:
```bash
# List agents
curl -X POST $BASE_URL/tty/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "What agents do I have scheduled to run"}'

# Create an agent
curl -X POST $BASE_URL/tty/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "Create agent to summarize Slack messages"}'

# Schedule an agent
curl -X POST $BASE_URL/tty/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "Make agent Email Manager run every day at 10 AM"}'

# Run an agent
curl -X POST $BASE_URL/tty/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "Run agent Email Manager with input check unread emails"}'
```

### Close Stream

```bash
curl -X POST "$BASE_URL/tty/stream/{session-id}/close" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Executions Monitoring

### List Executions

```bash
curl -X GET "$BASE_URL/executions?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Execution Details

```bash
curl -X GET "$BASE_URL/executions/{run-id}" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Execution Logs

```bash
curl -X GET "$BASE_URL/executions/{run-id}/logs" \
  -H "Authorization: Bearer $TOKEN"
```

### Stream Execution Logs (SSE)

```bash
curl -N -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/executions/{run-id}/logs/stream"
```

### Cancel Execution

```bash
curl -X POST "$BASE_URL/executions/{run-id}/cancel" \
  -H "Authorization: Bearer $TOKEN"
```

---

## OpenAI-Compatible API

### Chat Completion (Sync)

```bash
curl -X POST $BASE_URL/../v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agent:{agent-id}",
    "messages": [
      {"role": "user", "content": "Analyze my latest emails"}
    ]
  }'
```

### Chat Completion (Async)

```bash
curl -X POST $BASE_URL/../v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agent:{agent-id}",
    "messages": [
      {"role": "user", "content": "Process all pending tasks"}
    ],
    "metadata": {
      "run_async": true
    }
  }'
```

Response includes `runId`. Poll for status:

```bash
curl -X GET "$BASE_URL/../v1/runs/{run-id}" \
  -H "Authorization: Bearer $API_KEY"
```

---

## Health Checks

### Basic Health Check

```bash
curl -X GET $BASE_URL/health
```

### Readiness Probe (Database Check)

```bash
curl -X GET $BASE_URL/health/ready
```

### System Metrics

```bash
curl -X GET $BASE_URL/health/metrics
```

---

## Complete Testing Script

Here's a complete bash script to test the entire workflow:

```bash
#!/bin/bash

# Configuration
BASE_URL="http://localhost:3000/api/v1"

# 1. Login
echo "=== Logging in ==="
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@o3c.dev",
    "password": "password123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')
echo "Token: ${TOKEN:0:20}..."

# 2. Create an agent
echo -e "\n=== Creating Agent ==="
AGENT_RESPONSE=$(curl -s -X POST $BASE_URL/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "systemPrompt": "You are a helpful assistant.",
    "allowShell": true
  }')

AGENT_ID=$(echo $AGENT_RESPONSE | jq -r '.data.id')
echo "Agent ID: $AGENT_ID"

# 3. Execute the agent
echo -e "\n=== Executing Agent ==="
EXEC_RESPONSE=$(curl -s -X POST "$BASE_URL/agents/$AGENT_ID/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Hello, world!"
  }')

RUN_ID=$(echo $EXEC_RESPONSE | jq -r '.data.runId')
echo "Run ID: $RUN_ID"

# 4. Check execution status
echo -e "\n=== Checking Execution Status ==="
sleep 2
curl -s -X GET "$BASE_URL/executions/$RUN_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 5. Create a workflow
echo -e "\n=== Creating Workflow ==="
WORKFLOW_RESPONSE=$(curl -s -X POST $BASE_URL/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Workflow\",
    \"description\": \"A test workflow\",
    \"steps\": [
      {
        \"agentId\": \"$AGENT_ID\",
        \"order\": 0
      }
    ]
  }")

WORKFLOW_ID=$(echo $WORKFLOW_RESPONSE | jq -r '.data.id')
echo "Workflow ID: $WORKFLOW_ID"

echo -e "\n=== All Tests Completed ==="
```

---

## Using API Key Instead of JWT

For headless/programmatic access, use API keys:

```bash
# All requests can use X-API-Key header instead of Bearer token
curl -X GET $BASE_URL/agents \
  -H "X-API-Key: your-api-key-here"
```

---

## Troubleshooting

### Check API is Running

```bash
curl -X GET $BASE_URL/health
```

### View Swagger Documentation

Open in browser:
```
http://localhost:3000/api/docs
```

### Common Errors

**401 Unauthorized**: Token expired or invalid
```bash
# Get a fresh token
curl -X POST $BASE_URL/auth/login -H "Content-Type: application/json" -d '{"email":"demo@o3c.dev","password":"password123"}'
```

**404 Not Found**: Incorrect endpoint or resource doesn't exist
```bash
# Verify resource exists
curl -X GET $BASE_URL/agents -H "Authorization: Bearer $TOKEN"
```

**500 Internal Server Error**: Check server logs
```bash
# Docker logs
docker-compose logs -f api

# Kubernetes logs
kubectl logs -f deployment/o3c-api -n o3c-agent-engine
```
