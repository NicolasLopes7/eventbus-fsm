import express from 'express';
import type { FlowConfig, ClientMessage } from './types';
import { FlowConfigParser } from './flow-parser';
import { FSMOrchestrator, MockToolWorker } from './flow';
import { ReservationToolWorkers, SafeToolWorker } from './tool-workers';
import { config } from '../config';
import { FlowService, type FlowFilters } from './flow-service';
import { checkDatabaseConnection } from '../db/connection';

/**
 * Create API router with FSM endpoints
 */
export function createAPIRouter(orchestrator: FSMOrchestrator): express.Router {
  const router = express.Router();
  const flowService = new FlowService();

  /**
   * POST /sessions - Create new session with flow config
   * Body: { flow: FlowConfig, session_id?: string }
   * Response: { session_id: string, ws_url: string }
   */
  router.post('/sessions', async (req, res) => {
    try {
      const { flow, session_id } = req.body;

      // Validate flow config
      if (!flow) {
        return res.status(400).json({ error: 'Flow configuration is required' });
      }

      FlowConfigParser.validate(flow);

      // Create session
      const sessionId = await orchestrator.getSessionManager().createSession(flow, session_id);

      // Tools are now registered globally - no need to register per session
      console.log(`✅ Available tools:`, orchestrator.getToolRegistry());

      // Start initial state
      await orchestrator.enterState(sessionId, flow.start);

      // Return session info
      const wsUrl = `ws://localhost:3001?id=${sessionId}`;
      res.json({
        session_id: sessionId,
        ws_url: wsUrl
      });

    } catch (error) {
      console.error('Failed to create session:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /sessions/:id - Get session state
   */
  router.get('/sessions/:id', async (req, res) => {
    try {
      const sessionId = req.params.id;
      const session = await orchestrator.getSessionManager().getSessionState(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json(session);
    } catch (error) {
      console.error('Failed to get session:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /sessions/:id/input - Send user input to session
   * Body: { text: string }
   */
  router.post('/sessions/:id/input', async (req, res) => {
    try {
      const sessionId = req.params.id;
      const { text } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Text input is required' });
      }

      await orchestrator.processUserInput(sessionId, text);
      res.json({ ok: true });

    } catch (error) {
      console.error('Failed to process input:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /sessions/:id/events - Get session events since sequence
   * Query: ?since=<seq_number>
   */
  router.get('/sessions/:id/events', async (req, res) => {
    try {
      const sessionId = req.params.id;
      const since = req.query.since ? parseInt(req.query.since as string, 10) : undefined;

      const events = await orchestrator.getSessionManager().getEventsSince(sessionId, since);
      res.json({ events });

    } catch (error) {
      console.error('Failed to get events:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * DELETE /sessions/:id - Clean up session
   */
  router.delete('/sessions/:id', async (req, res) => {
    try {
      const sessionId = req.params.id;
      await orchestrator.getSessionManager().cleanupSession(sessionId);
      res.json({ ok: true });

    } catch (error) {
      console.error('Failed to cleanup session:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
 * GET /health - Health check
 */
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  /**
 * GET /flow-info - Get flow information for visualization
 * Query: ?session=<session_id> for live session data
 */
  // WebSocket connection monitoring endpoint
  router.get('/websocket-stats', async (req, res) => {
    try {
      const wsHandler = (req as any).wsHandler;
      if (!wsHandler) {
        return res.status(500).json({ error: "WebSocket handler not available" });
      }

      const stats = wsHandler.getConnectionManager().getStats();
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        websocket: stats,
        redis: {
          connected: true, // We could add Redis health check here
        }
      });
    } catch (error) {
      console.error('Failed to get WebSocket stats:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get flow information for UI
  router.get('/flow-info', async (req, res) => {
    try {
      const sessionId = req.query.session as string;
      const flow = FlowConfigParser.createReservationFlow();

      // Get session data if session ID provided
      let sessionData = null;
      if (sessionId) {
        try {
          sessionData = await orchestrator.getSessionManager().getSessionState(sessionId);
        } catch (error) {
          console.warn(`Failed to get session ${sessionId}:`, error);
        }
      }

      // Create a more UI-friendly format
      const flowInfo = {
        meta: flow.meta,
        start: flow.start,
        session: sessionData ? {
          sessionId: sessionData.sessionId,
          currentState: sessionData.currentState,
          context: sessionData.context,
          lastIntent: sessionData.lastIntent,
          lastToolCall: sessionData.lastToolCall,
          lastToolResult: sessionData.lastToolResult
        } : null,
        states: Object.entries(flow.states).map(([name, state]) => ({
          name,
          onEnter: state.onEnter || [],
          transitions: state.transitions || [],
          isCurrent: sessionData ? name === sessionData.currentState : false
        })),
        intents: Object.entries(flow.intents).map(([name, intent]) => ({
          name,
          examples: intent.examples,
          slots: Object.keys(intent.slots)
        })),
        tools: Object.entries(flow.tools).map(([name, tool]) => ({
          name,
          args: Object.keys(tool.args),
          result: Object.keys(tool.result),
          timeout: tool.timeout_ms || 30000
        }))
      };

      res.json(flowInfo);
    } catch (error) {
      console.error('Failed to get flow info:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /demo/reservation - Create demo reservation flow
   */
  router.post('/demo/reservation', async (req, res) => {
    try {
      const flow = FlowConfigParser.createReservationFlow();
      const sessionId = await orchestrator.getSessionManager().createSession(flow);

      // Tools are now registered globally - no need to register per session
      console.log(`✅ Available tools:`, orchestrator.getToolRegistry());

      // Start initial state
      await orchestrator.enterState(sessionId, flow.start);

      const wsUrl = `ws://localhost:3001?id=${sessionId}`;
      res.json({
        session_id: sessionId,
        ws_url: wsUrl,
        flow_name: flow.meta.name
      });

    } catch (error) {
      console.error('Failed to create demo session:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ========================================
  // FLOW MANAGEMENT API ENDPOINTS
  // ========================================

  /**
   * GET /flows - List all flows with optional filters
   * Query: ?status=published&search=reservation&category=restaurant
   */
  router.get('/flows', async (req, res) => {
    try {
      const filters: FlowFilters = {
        status: req.query.status as any,
        search: req.query.search as string,
        categoryId: req.query.category as string,
        createdBy: req.query.createdBy as string,
      };

      const flows = await flowService.listFlows(filters);
      res.json({ flows });
    } catch (error) {
      console.error('Failed to list flows:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /flows/:id - Get a specific flow by ID
   * Query: ?version=2 for specific version
   */
  router.get('/flows/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const version = req.query.version ? parseInt(req.query.version as string) : undefined;

      const flow = await flowService.getFlow(id, version);
      if (!flow) {
        return res.status(404).json({ error: 'Flow not found' });
      }

      res.json(flow);
    } catch (error) {
      console.error('Failed to get flow:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /flows - Create a new flow
   * Body: { name, description, definition, categoryIds? }
   */
  router.post('/flows', async (req, res) => {
    try {
      const { name, description, definition, categoryIds } = req.body;

      if (!name || !definition) {
        return res.status(400).json({ error: 'Name and definition are required' });
      }

      // For now, use a default user ID (in production, get from auth)
      const defaultUserId = '00000000-0000-0000-0000-000000000000'; // This should come from authentication

      const flow = await flowService.createFlow({
        name,
        description,
        definition,
        createdBy: defaultUserId,
        status: 'draft',
      });

      res.status(201).json(flow);
    } catch (error) {
      console.error('Failed to create flow:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * PUT /flows/:id - Update a flow
   * Body: { name?, description?, definition?, status? }
   */
  router.put('/flows/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const flow = await flowService.updateFlow(id, updates);
      res.json(flow);
    } catch (error) {
      console.error('Failed to update flow:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * DELETE /flows/:id - Delete a flow
   */
  router.delete('/flows/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await flowService.deleteFlow(id);
      res.json({ ok: true });
    } catch (error) {
      console.error('Failed to delete flow:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /flows/:id/publish - Publish a flow
   */
  router.post('/flows/:id/publish', async (req, res) => {
    try {
      const { id } = req.params;
      const flow = await flowService.publishFlow(id);
      res.json(flow);
    } catch (error) {
      console.error('Failed to publish flow:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /flows/:id/versions - Create a new version
   * Body: { changelog? }
   */
  router.post('/flows/:id/versions', async (req, res) => {
    try {
      const { id } = req.params;
      const { changelog } = req.body;

      // Get current flow to create version from
      const currentFlow = await flowService.getFlow(id);
      if (!currentFlow) {
        return res.status(404).json({ error: 'Flow not found' });
      }

      const newVersion = await flowService.createVersion(id, {
        version: currentFlow.version + 1,
        definition: currentFlow.definition,
        changelog: changelog || `Version ${currentFlow.version + 1}`,
        createdBy: currentFlow.createdBy,
      });

      res.status(201).json(newVersion);
    } catch (error) {
      console.error('Failed to create version:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /flows/:id/versions - Get version history
   */
  router.get('/flows/:id/versions', async (req, res) => {
    try {
      const { id } = req.params;
      const versions = await flowService.getVersionHistory(id);
      res.json({ versions });
    } catch (error) {
      console.error('Failed to get version history:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /flows/:id/rollback - Rollback to a specific version
   * Body: { version }
   */
  router.post('/flows/:id/rollback', async (req, res) => {
    try {
      const { id } = req.params;
      const { version } = req.body;

      if (!version) {
        return res.status(400).json({ error: 'Version number is required' });
      }

      const flow = await flowService.rollbackToVersion(id, version);
      res.json(flow);
    } catch (error) {
      console.error('Failed to rollback flow:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /flows/:id/validate - Validate a flow definition
   * Body: { definition }
   */
  router.post('/flows/:id/validate', async (req, res) => {
    try {
      const { definition } = req.body;

      if (!definition) {
        return res.status(400).json({ error: 'Definition is required' });
      }

      const validation = await flowService.validateFlow(definition);
      res.json(validation);
    } catch (error) {
      console.error('Failed to validate flow:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /flow-categories - Get all flow categories
   */
  router.get('/flow-categories', async (req, res) => {
    try {
      const categories = await flowService.getCategories();
      res.json({ categories });
    } catch (error) {
      console.error('Failed to get categories:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /flow-categories - Create a new category
   * Body: { name, description?, color? }
   */
  router.post('/flow-categories', async (req, res) => {
    try {
      const { name, description, color } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const category = await flowService.createCategory(name, description, color);
      res.status(201).json(category);
    } catch (error) {
      console.error('Failed to create category:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /database/health - Check database connection
   */
  router.get('/database/health', async (req, res) => {
    try {
      const isConnected = await checkDatabaseConnection();
      res.json({
        status: isConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

/**
 * Register tool workers for the session
 */
function registerMockTools(orchestrator: FSMOrchestrator, sessionId: string): void {
  // Use realistic reservation tool workers with safety wrapper
  const checkAvailabilityWorker = new SafeToolWorker(
    ReservationToolWorkers.createCheckAvailabilityWorker(orchestrator),
    3, // max retries
    1000 // retry delay
  );

  const createReservationWorker = new SafeToolWorker(
    ReservationToolWorkers.createCreateReservationWorker(orchestrator),
    3,
    1000
  );

  orchestrator.registerTool('CheckAvailability', checkAvailabilityWorker);
  orchestrator.registerTool('CreateReservation', createReservationWorker);
}

/**
 * WebSocket connection manager for horizontal scaling
 */
class WebSocketConnectionManager {
  private connections = new Map<string, Set<any>>();
  private subscribers = new Map<string, any>();
  private orchestrator: FSMOrchestrator;

  constructor(orchestrator: FSMOrchestrator) {
    this.orchestrator = orchestrator;
  }

  async addConnection(ws: any, sessionId: string) {
    // Initialize connection set for this session if it doesn't exist
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set());
    }

    // Add this WebSocket to the session's connections
    this.connections.get(sessionId)!.add(ws);

    // If this is the first connection for this session, start Redis subscription
    if (this.connections.get(sessionId)!.size === 1) {
      await this.startSessionSubscription(sessionId);
    }

    console.log(`📡 WebSocket connected for session ${sessionId} (${this.connections.get(sessionId)!.size} total connections)`);

    // Send session started event to the newly connected client
    ws.send(JSON.stringify({
      type: 'session.started',
      session_id: sessionId
    }));

    // Handle WebSocket closure
    ws.on('close', () => {
      this.removeConnection(ws, sessionId);
    });

    ws.on('error', (error: Error) => {
      console.error(`WebSocket error for session ${sessionId}:`, error);
      this.removeConnection(ws, sessionId);
    });
  }

  private removeConnection(ws: any, sessionId: string) {
    const sessionConnections = this.connections.get(sessionId);
    if (sessionConnections) {
      sessionConnections.delete(ws);

      // If no more connections for this session, cleanup Redis subscription
      if (sessionConnections.size === 0) {
        this.stopSessionSubscription(sessionId);
        this.connections.delete(sessionId);
      }

      console.log(`📡 WebSocket disconnected from session ${sessionId} (${sessionConnections.size} remaining)`);
    }
  }

  private async startSessionSubscription(sessionId: string) {
    try {
      const subscriber = await this.orchestrator.getSessionManager().subscribeToSession(sessionId, (event) => {
        this.broadcastToSession(sessionId, event);
      });

      this.subscribers.set(sessionId, subscriber);
      console.log(`🔌 Started Redis subscription for session ${sessionId}`);
    } catch (error) {
      console.error(`Failed to start Redis subscription for session ${sessionId}:`, error);
    }
  }

  private async stopSessionSubscription(sessionId: string) {
    const subscriber = this.subscribers.get(sessionId);
    if (subscriber) {
      try {
        await subscriber.disconnect();
        this.subscribers.delete(sessionId);
        console.log(`🔌 Stopped Redis subscription for session ${sessionId}`);
      } catch (error) {
        console.error(`Error stopping Redis subscription for session ${sessionId}:`, error);
      }
    }
  }

  private broadcastToSession(sessionId: string, event: any) {
    const sessionConnections = this.connections.get(sessionId);
    if (!sessionConnections || sessionConnections.size === 0) {
      return;
    }

    const message = JSON.stringify(event);
    const deadConnections: any[] = [];

    // Send to all active connections for this session
    for (const ws of sessionConnections) {
      try {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(message);
        } else {
          deadConnections.push(ws);
        }
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        deadConnections.push(ws);
      }
    }

    // Clean up dead connections
    deadConnections.forEach(ws => {
      sessionConnections.delete(ws);
    });

    // Log to terminal console for debugging
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 📡 ${event.type} → ${sessionConnections.size} clients`, event.text || event.message || '');

    if (event.type === 'state.updated') {
      console.log(`[${timestamp}] 📝 Context:`, JSON.stringify(event.ctx, null, 2));
    }

    if (event.type === 'fsm.transition') {
      console.log(`[${timestamp}] 🔄 ${event.from} → ${event.to}`);
    }

    if (event.type === 'tool.call') {
      console.log(`[${timestamp}] 🔧 Tool: ${event.name}`, JSON.stringify(event.args, null, 2));
    }

    if (event.type === 'tool.result') {
      console.log(`[${timestamp}] ✅ Tool Result:`, JSON.stringify(event.result, null, 2));
    }
  }

  // Get statistics for monitoring
  getStats() {
    const totalConnections = Array.from(this.connections.values())
      .reduce((sum, sessionConnections) => sum + sessionConnections.size, 0);

    return {
      totalSessions: this.connections.size,
      totalConnections,
      activeSubscriptions: this.subscribers.size
    };
  }
}

/**
 * Create WebSocket handler
 */
export function createWebSocketHandler(orchestrator: FSMOrchestrator) {
  const connectionManager = new WebSocketConnectionManager(orchestrator);

  return {
    handleConnection: async (ws: any, sessionId: string) => {
      await connectionManager.addConnection(ws, sessionId);

      // Handle incoming messages
      ws.on('message', async (message: Buffer) => {
        try {
          const data: ClientMessage = JSON.parse(message.toString());

          if (data.type === 'user.text') {
            await orchestrator.processUserInput(sessionId, data.text);
          }
        } catch (error) {
          console.error('Failed to process WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process message'
          }));
        }
      });
    },

    // Expose connection manager for monitoring
    getConnectionManager: () => connectionManager
  };
}
