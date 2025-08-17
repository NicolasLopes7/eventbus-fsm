// ===============================
// Types shared with server
// ===============================

export interface FlowConfigMeta {
  name: string;
  language?: string;
  voice?: string;
}

export interface IntentDefinition {
  examples: string[];
  slots: Record<string, string>; // slot_name -> type
}

export interface ToolDefinition {
  args: Record<string, any>;
  result: Record<string, any>;
  timeout_ms?: number;
}

export interface ActionConfig {
  say?: string;
  ask?: string;
  transfer?: string;
  hangup?: boolean;
  tool?: string;
  args?: Record<string, any>;
}

export interface TransitionConfig {
  onIntent?: string | string[];
  onToolResult?: string;
  assign?: Record<string, string>; // template strings
  when?: string; // simple expression
  to?: string;
  branch?: Array<{
    when: string;
    to: string;
  }>;
}

export interface StateConfig {
  onEnter?: ActionConfig[];
  transitions?: TransitionConfig[];
}

export interface FlowConfig {
  meta: FlowConfigMeta;
  start: string;
  intents: Record<string, IntentDefinition>;
  tools: Record<string, ToolDefinition>;
  states: Record<string, StateConfig>;
}

export interface SessionState {
  sessionId: string;
  currentState: string;
  context: Record<string, any>;
  lastIntent?: {
    name: string;
    confidence: number;
    slots: Record<string, any>;
  };
  lastToolCall?: {
    id: string;
    name: string;
    args: any;
    timestamp: number;
  };
  lastToolResult?: {
    callId: string;
    result: any;
    timestamp: number;
  };
}

// Server -> Client messages
export type ServerMessage =
  | { type: "session.started"; session_id: string }
  | { type: "ask"; text: string }
  | { type: "say"; text: string }
  | { type: "model.chunk"; delta: string }
  | { type: "tool.call"; tool_call_id: string; name: string; args: any }
  | { type: "tool.result"; tool_call_id: string; result: any }
  | { type: "fsm.transition"; from: string; to: string }
  | { type: "state.updated"; ctx: Record<string, any> }
  | { type: "model.done" }
  | { type: "error"; message: string }
  | { type: "hangup" }
  | { type: "intent.unhandled"; intent: string; confidence: number };

// Client -> Server messages  
export type ClientMessage =
  | { type: "user.text"; text: string }
  | { type: "user.dtmf"; digits: string }
  | { type: "client.cancel" };

// UI State types
export interface ChatMessage {
  id: string;
  type: 'user' | 'bot' | 'system' | 'error';
  content: string;
  timestamp: Date;
}

export interface FlowVisualizationData {
  meta: FlowConfigMeta;
  start: string;
  session?: {
    sessionId: string;
    currentState: string;
    context: Record<string, any>;
    lastIntent?: {
      name: string;
      confidence: number;
      slots: Record<string, any>;
    };
    lastToolCall?: {
      id: string;
      name: string;
      args: any;
      timestamp: number;
    };
    lastToolResult?: {
      callId: string;
      result: any;
      timestamp: number;
    };
  };
  states: Array<{
    name: string;
    onEnter: ActionConfig[];
    transitions: TransitionConfig[];
    isCurrent: boolean;
  }>;
  intents: Array<{
    name: string;
    examples: string[];
    slots: string[];
  }>;
  tools: Array<{
    name: string;
    args: string[];
    result: string[];
    timeout: number;
  }>;
}

export interface DebugEvent {
  id: string;
  timestamp: Date;
  type: string;
  data?: any;
}

// ========================================
// FLOW MANAGEMENT TYPES
// ========================================

export interface Flow {
  id: string;
  name: string;
  description?: string;
  version: number;
  status: 'draft' | 'testing' | 'published' | 'archived';
  definition: FlowConfig;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  usageCount: number;
  lastUsedAt?: string;
  categories: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface FlowCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
