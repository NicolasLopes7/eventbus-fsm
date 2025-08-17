# EventBus FSM - Advanced Tool-Calling State Machine

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
- Redis server
- OpenAI API key (optional, for LLM classification)

### Installation

```bash
# Install dependencies
pnpm install

# Start Redis (if not running)
docker run -d -p 6379:6379 redis:alpine

# Set environment variables
export OPENAI_API_KEY="your-api-key"  # Optional
export REDIS_URL="redis://localhost:6379"

# Start the server
cd apps/server
pnpm dev
```

### Using the Chat UI

1. Start the server: `cd apps/server && pnpm dev`
2. Open your browser to: `http://localhost:3000`
3. The chat UI will automatically create a demo session and connect
4. Try these example messages:
   - "I want to make a reservation"
   - "We are 4 people"
   - "Tomorrow at 7pm"
   - "My name is John Doe, phone 555-1234"
   - Add "(HANG ON)" to any message to trigger misclassification

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
REDIS_URL=redis://your-redis-host:6379
OPENAI_API_KEY=your-openai-key
PORT=3000
CORS_ORIGIN=https://your-frontend.com
```

### Docker Deployment

```yaml
# docker-compose.yml
version: "3.8"
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  fsm-server:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - redis
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

This is a staff-level engineering implementation showcasing advanced patterns for production conversational AI systems. The codebase demonstrates:

- Type-safe state machine design
- Distributed systems patterns (Redis locks, streams)
- Event-driven architecture
- Robust error handling and retry logic
- Comprehensive testing strategies

## 📄 License

MIT License - see LICENSE file for details.
