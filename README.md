# EventBus FSM - Tool-Calling State Machine
> relayed through redis (pub/sub) event bus


![CleanShot 2025-08-17 at 14 56 13@2x](https://github.com/user-attachments/assets/7b525c1e-8d77-4b54-a33e-43756b0a6b65)

A sophisticated Finite State Machine (FSM) system designed for conversational AI with tool-calling capabilities. This system provides a complete framework for building complex, stateful conversational flows with Redis-backed persistence, real-time event streaming, and LLM-powered intent classification.

## 🚀 Features

- **Type-Safe FSM**: Fully typed state machine with generics for states, contexts, intents, and tools
- **Tool-Calling**: Built-in support for external tool execution with timeout and retry logic
- **Real-Time Events**: WebSocket-based real-time event streaming for live monitoring
- **Redis Persistence**: Distributed session state management with Redis streams and locks
- **LLM Integration**: OpenAI-powered intent classification and slot extraction
- **Flexible DSL**: JSON-based flow configuration with template variables and expressions
- **Production Ready**: Error handling, retries, timeouts, and graceful shutdown

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client UI     │    │  WebSocket      │    │  HTTP API       │
│                 │◄──►│  Real-time      │◄──►│  Session Mgmt   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                 │                       │
                        ┌─────────────────┐    ┌─────────────────┐
                        │ FSM Orchestrator│◄──►│ Session Manager │
                        │                 │    │ (Redis)         │
                        └─────────────────┘    └─────────────────┘
                                 │
                        ┌─────────────────┐    ┌─────────────────┐
                        │ LLM Classifier  │    │ Tool Workers    │
                        │ (OpenAI)        │    │ (HTTP/Queue)    │
                        └─────────────────┘    └─────────────────┘
```

## 📝 Flow Configuration DSL

Define your conversational flows using a simple JSON DSL:

```json
{
  "meta": {
    "name": "Restaurant Reservations",
    "language": "en-US"
  },
  "start": "InitialGreeting",
  "intents": {
    "BOOK": {
      "examples": ["I'd like to book", "reservation"],
      "slots": {}
    },
    "PROVIDE_PARTY_SIZE": {
      "examples": ["we are 6", "party of 10"],
      "slots": { "partySize": "number" }
    }
  },
  "tools": {
    "CheckAvailability": {
      "args": { "date": "string", "time": "string", "partySize": "number" },
      "result": { "ok": "boolean" },
      "timeout_ms": 4000
    }
  },
  "states": {
    "InitialGreeting": {
      "onEnter": [{ "say": "Welcome! How can I help?" }],
      "transitions": [{ "onIntent": ["BOOK"], "to": "CollectPartySize" }]
    },
    "CollectPartySize": {
      "onEnter": [{ "ask": "How many people?" }],
      "transitions": [
        {
          "onIntent": ["PROVIDE_PARTY_SIZE"],
          "assign": { "partySize": "{{slot.partySize}}" },
          "branch": [
            { "when": "{{ctx.partySize}} > 8", "to": "TransferToManager" },
            { "when": "else", "to": "CollectDateTime" }
          ]
        }
      ]
    }
  }
}
```

## 🛠 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis server
- OpenAI API key (optional, for LLM classification)

### Installation

```bash
# Install dependencies
pnpm install

# Start PostgreSQL and Redis using Docker Compose
docker-compose up -d

# Copy environment template (optional - defaults work with docker-compose)
cp env.example .env

# Edit .env if needed for custom configuration
# DATABASE_URL=postgresql://postgres:password@localhost:5432/eventbus_fsm
# REDIS_URL=redis://localhost:6379
# OPENAI_API_KEY=your-api-key  # Optional

# Start both server and web app
pnpm dev
```

### Using the Web Interface

1. Start both server and web app: `pnpm dev`
2. Open your browser to: `http://localhost:5173`
3. Available interfaces:
   - **Home Dashboard**: Real-time chat with flow visualization
   - **Flow Manager** (`/flow-manager`): Create, edit, and manage conversation flows
   - **Chat Interface** (`/chat`): Select and test individual flows
   - **Flow Editor** (`/flow-editor`): Visual flow design interface

### Flow Management

The system now includes a complete flow management interface:

- **Create Flows**: Design conversation flows with visual editor
- **Flow Database**: Browse, edit, and organize flows by categories
- **Version Control**: Track flow versions and usage statistics
- **Testing**: Select any flow to test in isolated chat sessions
- **Publishing**: Publish flows to make them available for testing

### Testing Flows

1. Go to `/chat` to access the flow selector
2. Choose from published flows
3. Start a chat session with your selected flow
4. Try these example messages:
   - "I want to make a reservation"
   - "We are 4 people"
   - "Tomorrow at 7pm"
   - "My name is John Doe, phone 555-1234"

### Creating a Session Programmatically

```bash
# Create a demo reservation flow
curl -X POST http://localhost:3000/api/demo/reservation

# Response:
{
  "session_id": "uuid-here",
  "ws_url": "ws://localhost:3001?id=uuid-here",
  "flow_name": "Bella Vista Reservations"
}
```

### WebSocket Connection

```javascript
const ws = new WebSocket("ws://localhost:3001?id=your-session-id");

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log("Received:", message);
};

// Send user input
ws.send(
  JSON.stringify({
    type: "user.text",
    text: "I want to make a reservation",
  })
);
```

## 📡 API Endpoints

### Session Management

- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session state
- `DELETE /api/sessions/:id` - Clean up session
- `POST /api/sessions/:id/input` - Send user input
- `GET /api/sessions/:id/events` - Get event history

### Demo & Testing

- `POST /api/demo/reservation` - Create demo reservation flow
- `GET /api/health` - Health check

## 🔧 Tool Workers

The system supports multiple tool execution patterns:

### HTTP Tool Worker

```typescript
const httpWorker = new HTTPToolWorker("https://api.example.com/tools");
orchestrator.registerTool("MyTool", httpWorker);
```

### Queue-based Tool Worker

```typescript
const queueWorker = new QueueToolWorker(redis, "tool_queue");
orchestrator.registerTool("MyTool", queueWorker);
```

### Custom Function Worker

```typescript
const customWorker = new FunctionToolWorker(
  async (sessionId, toolCallId, args) => {
    // Your custom logic here
    return { result: "success" };
  }
);
orchestrator.registerTool("MyTool", customWorker);
```

## 📊 Event Types

The system emits various events for monitoring and debugging:

- `session.started` - Session initialized
- `ask` / `say` - Bot responses
- `tool.call` - Tool execution started
- `tool.result` - Tool execution completed
- `fsm.transition` - State transition
- `state.updated` - Context updated
- `intent.unhandled` - No matching transition

## 🧪 Testing

Run the built-in test suite:

```bash
cd apps/server
npx tsx src/test-runner.ts
```

This will test:

- Flow configuration parsing
- LLM intent classification (if API key available)
- Complete FSM conversation flow
- Tool execution and state transitions

## 📈 Production Deployment

### Environment Variables

```bash
# Database Configuration (Required)
DATABASE_URL=postgresql://username:password@localhost:5432/eventbus_fsm

# Redis Configuration
REDIS_URL=redis://your-redis-host:6379

# Server Configuration
PORT=3000

# AI Configuration (Optional)
OPENAI_API_KEY=your-openai-key

# Web App Configuration (Development)
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3001
```

### Docker Deployment

For development, simply use the included docker-compose.yml:

```bash
# Start databases
docker-compose up -d

# Start the application
pnpm dev
```

For production deployment, you can extend the compose file:

```yaml
# docker-compose.prod.yml
version: "3.8"
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: eventbus_fsm
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  app:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/eventbus_fsm
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
  redis_data:
```

### Monitoring

The system provides comprehensive event logging through Redis streams. Events include:

- Full conversation replay capability
- Tool execution traces with timing
- State transition audit trail
- Error logging and debugging info

## 🔐 Security Considerations

- PII masking in event logs
- Distributed session locking to prevent race conditions
- Request rate limiting (implement in reverse proxy)
- API key rotation support
- Input validation and sanitization

## 🎯 Use Cases

- **Customer Service Bots**: Multi-step support flows with external system integration
- **Reservation Systems**: Complex booking flows with availability checking
- **E-commerce**: Shopping cart and checkout processes
- **Survey/Forms**: Dynamic form collection with conditional logic
- **Troubleshooting**: Technical support with diagnostic tool integration

## 🤝 Contributing

The codebase demonstrates:

- Type-safe state machine design
- Distributed systems patterns (Redis locks, streams)
- Event-driven architecture
- Robust error handling and retry logic
- Comprehensive testing strategies

## 📄 License

MIT License - see LICENSE file for details.
