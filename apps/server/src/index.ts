import "dotenv/config";
import cors from "cors";
import express from "express";
import { config } from "./config";
import { WebSocketServer } from "ws";
import http from "http";
import { FSMOrchestrator } from "./internal/flow";
import { createAPIRouter, createWebSocketHandler } from "./internal/api-routes";

// Initialize FSM orchestrator
const orchestrator = new FSMOrchestrator(config.redisURL, process.env.OPENAI_API_KEY);

// Register global tools once
import { ReservationToolWorkers, SafeToolWorker } from "./internal/tool-workers";

const checkAvailabilityWorker = new SafeToolWorker(
  ReservationToolWorkers.createCheckAvailabilityWorker(orchestrator),
  3,
  1000
);

const createReservationWorker = new SafeToolWorker(
  ReservationToolWorkers.createCreateReservationWorker(orchestrator),
  3,
  1000
);

orchestrator.registerTool('CheckAvailability', checkAvailabilityWorker);
orchestrator.registerTool('CreateReservation', createReservationWorker);
console.log('🔧 Registered global tools:', orchestrator.getToolRegistry());

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ port: 3001 });

// Configure middleware with more permissive CORS for development
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production'
      ? process.env.CORS_ORIGIN
      : true, // Allow all origins in development
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
    preflightContinue: false,
    optionsSuccessStatus: 200
  })
);

app.use(express.json({ limit: '10mb' }));

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

// Basic health check
app.get("/", (_req, res) => {
  res.status(200).json({
    status: "EventBus FSM Server",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// Serve flow-info page
app.get("/flow-info", (_req, res) => {
  res.sendFile('flow-info.html', { root: 'public' });
});

// Legacy endpoint for compatibility (before mounting API routes)
app.post("/api/:id", async (req, res) => {
  try {
    const sessionId = req.params.id;
    const text = req.body?.text || "";

    if (text) {
      await orchestrator.processUserInput(sessionId, text);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Legacy API error:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// WebSocket connection handler
const wsHandler = createWebSocketHandler(orchestrator);

// Create API router with WebSocket handler for monitoring
const apiRouter = createAPIRouter(orchestrator);

// Middleware to attach wsHandler to req for monitoring endpoint
app.use("/api", (req, _res, next) => {
  (req as any).wsHandler = wsHandler;
  next();
}, apiRouter);

wss.on("connection", async (ws, req) => {
  try {
    const url = new URL(req?.url || "", `http://${req.headers.host}`);
    const sessionId = url.searchParams.get("id");

    if (!sessionId) {
      ws.close(1008, "Session ID required");
      return;
    }

    // Check if session exists
    const session = await orchestrator.getSessionManager().getSessionState(sessionId);
    if (!session) {
      ws.close(1008, "Session not found");
      return;
    }

    // Handle the connection
    await wsHandler.handleConnection(ws, sessionId);

  } catch (error) {
    console.error('WebSocket connection error:', error);
    ws.close(1011, "Internal server error");
  }
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');

  // Close WebSocket server
  wss.close(() => {
    console.log('WebSocket server closed');
  });

  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Start the server
app.listen(config.port, () => {
  console.log(`🚀 EventBus FSM Server running on port ${config.port}`);
  console.log(`📡 WebSocket server running on port 3001`);
  console.log(`📝 API endpoints available at http://localhost:${config.port}/api`);
  console.log(`🔧 Demo reservation flow: POST /api/demo/reservation`);
});