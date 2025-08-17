import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import type { FlowConfig, SessionState, ServerMessage, ClientMessage } from './types';
import { pub, sub } from './redis';

/**
 * Session manager handles Redis-based session state persistence and locking
 */
export class SessionManager {
  private redis: Redis;
  private lockTimeout = 10000; // 10 seconds

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  /**
   * Create a new session with initial state
   */
  async createSession(flowConfig: FlowConfig, sessionId?: string): Promise<string> {
    const id = sessionId || uuidv4();

    const initialState: SessionState = {
      sessionId: id,
      currentState: flowConfig.start,
      context: {},
      lastIntent: undefined,
      lastToolCall: undefined,
      lastToolResult: undefined
    };

    // Store session state
    await this.setSessionState(id, initialState);

    // Store flow config
    await this.redis.hset(`flow:${id}`, 'config', JSON.stringify(flowConfig));

    return id;
  }

  /**
   * Get session state from Redis
   */
  async getSessionState(sessionId: string): Promise<SessionState | null> {
    const stateStr = await this.redis.hget(`state:call:${sessionId}`, 'data');
    if (!stateStr) return null;

    try {
      return JSON.parse(stateStr) as SessionState;
    } catch {
      return null;
    }
  }

  /**
   * Set session state in Redis
   */
  async setSessionState(sessionId: string, state: SessionState): Promise<void> {
    await this.redis.hset(`state:call:${sessionId}`, 'data', JSON.stringify(state));
  }

  /**
   * Get flow config for session
   */
  async getFlowConfig(sessionId: string): Promise<FlowConfig | null> {
    const configStr = await this.redis.hget(`flow:${sessionId}`, 'config');
    if (!configStr) return null;

    try {
      return JSON.parse(configStr) as FlowConfig;
    } catch {
      return null;
    }
  }

  /**
   * Acquire distributed lock for session processing
   */
  async acquireLock(sessionId: string): Promise<string | null> {
    const lockKey = `lock:sess_${sessionId}`;
    const lockValue = uuidv4();

    const result = await this.redis.set(
      lockKey,
      lockValue,
      'PX',
      this.lockTimeout,
      'NX'
    );

    return result === 'OK' ? lockValue : null;
  }

  /**
   * Release distributed lock for session
   */
  async releaseLock(sessionId: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:sess_${sessionId}`;

    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, lockKey, lockValue);
    return result === 1;
  }

  /**
   * Execute function with session lock
   */
  async withLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const lockValue = await this.acquireLock(sessionId);
    if (!lockValue) {
      throw new Error(`Failed to acquire lock for session ${sessionId}`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(sessionId, lockValue);
    }
  }

  /**
   * Emit event to session stream and publish for real-time
   */
  async emitEvent(sessionId: string, event: Record<string, any>): Promise<void> {
    const seq = await this.redis.incr(`call:${sessionId}`);
    const eventData = { ...event, sessionId, seq, timestamp: Date.now() };
    const eventString = JSON.stringify(eventData);

    // Add to stream for replay/audit
    await this.redis.xadd(`stream:call:${sessionId}`, '*', "json", eventString);

    // Publish for real-time delivery
    await this.redis.publish(`pub:call:${sessionId}`, eventString);
  }

  /**
   * Get events from stream since sequence number
   */
  async getEventsSince(sessionId: string, sinceSeq?: number): Promise<any[]> {
    const startId = sinceSeq ? `${sinceSeq}-0` : '0-0';
    const result = await this.redis.xrange(`stream:call:${sessionId}`, startId, '+');

    return result.map(([id, fields]) => {
      const data = fields[1]; // fields is ['json', data]
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }

  /**
   * Subscribe to session events
   */
  async subscribeToSession(sessionId: string, callback: (event: any) => void): Promise<Redis> {
    const subscriber = new Redis(this.redis.options);
    const channel = `pub:call:${sessionId}`;

    await subscriber.subscribe(channel);

    subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const event = JSON.parse(message);
          callback(event);
        } catch (error) {
          console.error('Failed to parse event message:', error);
        }
      }
    });

    return subscriber;
  }

  /**
   * Clean up session data (for testing or cleanup)
   */
  async cleanupSession(sessionId: string): Promise<void> {
    const keys = [
      `state:call:${sessionId}`,
      `flow:${sessionId}`,
      `stream:call:${sessionId}`,
      `lock:sess_${sessionId}`,
      `call:${sessionId}`
    ];

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * List all active sessions
   */
  async getActiveSessions(): Promise<string[]> {
    const pattern = 'state:call:*';
    const keys = await this.redis.keys(pattern);
    return keys.map(key => key.replace('state:call:', ''));
  }

  /**
   * Update session context
   */
  async updateContext(sessionId: string, updates: Record<string, any>): Promise<void> {
    const state = await this.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }

    state.context = { ...state.context, ...updates };
    await this.setSessionState(sessionId, state);

    // Emit context update event
    await this.emitEvent(sessionId, {
      type: 'state.updated',
      ctx: state.context
    });
  }

  /**
   * Transition to new state
   */
  async transitionToState(sessionId: string, newState: string): Promise<void> {
    const state = await this.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const oldState = state.currentState;
    state.currentState = newState;
    await this.setSessionState(sessionId, state);

    // Emit transition event
    await this.emitEvent(sessionId, {
      type: 'fsm.transition',
      from: oldState,
      to: newState
    });
  }

  /**
   * Store tool call information
   */
  async storeToolCall(sessionId: string, toolCallId: string, toolName: string, args: any): Promise<void> {
    const state = await this.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }

    state.lastToolCall = {
      id: toolCallId,
      name: toolName,
      args,
      timestamp: Date.now()
    };

    await this.setSessionState(sessionId, state);

    // Emit tool call event
    await this.emitEvent(sessionId, {
      type: 'tool.call',
      tool_call_id: toolCallId,
      name: toolName,
      args
    });
  }

  /**
   * Store tool result
   */
  async storeToolResult(sessionId: string, toolCallId: string, result: any): Promise<void> {
    const state = await this.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }

    state.lastToolResult = {
      callId: toolCallId,
      result,
      timestamp: Date.now()
    };

    await this.setSessionState(sessionId, state);

    // Emit tool result event
    await this.emitEvent(sessionId, {
      type: 'tool.result',
      tool_call_id: toolCallId,
      result
    });
  }

  /**
   * Store last recognized intent
   */
  async storeIntent(sessionId: string, intent: any): Promise<void> {
    const state = await this.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }

    state.lastIntent = intent;
    await this.setSessionState(sessionId, state);
  }
}
