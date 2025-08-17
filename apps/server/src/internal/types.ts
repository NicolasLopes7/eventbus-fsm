// ===============================
// Core generics for FSM
// ===============================

/** Intents -> shape of slots per intent */
export type IntentMap = Record<string, Record<string, unknown>>;

/** Tools -> args/result per tool */
export type ToolArgsMap = Record<string, Record<string, unknown>>;
export type ToolResultMap = Record<string, Record<string, unknown>>;

/** Intent detected by NLU/LLM (typed by map) */
export type NLUIntent<IM extends IntentMap, I extends keyof IM = keyof IM> = {
  name: I;
  confidence: number;
  slots: Partial<IM[I]>;
};

/** Actions executed when entering a state (or under event) */
export type Action<
  Ctx,
  TA extends ToolArgsMap,
  TR extends ToolResultMap
> =
  | { type: "ask"; prompt: string }                 // question (TTS)
  | { type: "say"; text: string }                   // speak/statement
  | { type: "transfer"; to: string }                // transfer call
  | { type: "hangup" }                              // end call
  | { type: "set"; patch: Partial<Ctx> }            // modify context
  | { type: "tool"; name: keyof TA; args: TA[keyof TA] } // call tool (typed)

/** Runtime events that can drive the FSM */
export type RuntimeEvent<
  IM extends IntentMap,
  TR extends ToolResultMap
> =
  | { type: "nlu.intent"; intent: NLUIntent<IM> }
  | { type: "tool.result"; tool: keyof TR; correlationId: string; result: TR[keyof TR] }
  | { type: "timeout"; key: string }
  | { type: "external"; name: string; payload?: unknown };

/** Edges (transitions). Can be by intent, guard or event. */
export type Edge<
  StateId extends string,
  Ctx,
  IM extends IntentMap,
  TA extends ToolArgsMap,
  TR extends ToolResultMap
> =
  // Transition driven by INTENT (optionally with guard)
  | {
    kind: "intent";
    match: keyof IM | Array<keyof IM>;
    when?: (ctx: Readonly<Ctx>, intent: NLUIntent<IM>) => boolean;
    assign?: (ctx: Ctx, intent: NLUIntent<IM>) => Partial<Ctx>;
    to: StateId;
  }
  // Transition by pure GUARD (without depending on intent)
  | {
    kind: "guard";
    when: (ctx: Readonly<Ctx>) => boolean;
    to: StateId;
  }
  // Transition by EVENT (tool result, timeout, etc.)
  | {
    kind: "event";
    match:
    | { type: "tool.result"; tool: keyof TR }
    | { type: "timeout"; key?: string }
    | { type: "external"; name: string };
    to: StateId;
  };

/** Node (state) of the FSM */
export type Node<
  StateId extends string,
  Ctx,
  IM extends IntentMap,
  TA extends ToolArgsMap,
  TR extends ToolResultMap
> = {
  id: StateId;
  onEnter?: Array<Action<Ctx, TA, TR>>;
  edges: Array<Edge<StateId, Ctx, IM, TA, TR>>;
};

/** Complete FSM graph */
export type FSM<
  StateId extends string,
  Ctx,
  IM extends IntentMap,
  TA extends ToolArgsMap,
  TR extends ToolResultMap
> = {
  start: StateId;
  nodes: Record<StateId, Node<StateId, Ctx, IM, TA, TR>>;
};

// ===============================
// FlowConfig JSON Schema Types
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

// ===============================
// Runtime Session Types
// ===============================

export interface SessionState {
  sessionId: string;
  currentState: string;
  context: Record<string, any>;
  lastIntent?: NLUIntent<any>;
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

export interface WSMessage {
  type: string;
  [key: string]: any;
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
  | { type: "error"; message: string };

// Client -> Server messages
export type ClientMessage =
  | { type: "user.text"; text: string }
  | { type: "user.dtmf"; digits: string }
  | { type: "client.cancel" };

// ===============================
// Concrete Example Types (Reservation)
// ===============================

export type ReservationStateId =
  | "InitialGreeting"
  | "ProvideAdditionalInformation"
  | "CollectPartySize"
  | "TransferToManager"
  | "CollectReservationDateTime"
  | "ConfirmAvailability"
  | "AltDateTime"
  | "CollectContactInformation"
  | "CreateBooking"
  | "Goodbye";

export type ReservationContext = {
  partySize?: number;
  date?: string;   // ISO "2025-08-15"
  time?: string;   // "19:30"
  contact?: { name?: string; phone?: string };
  notes?: string;
};

export type ReservationIntentMap = {
  ASK_QUESTION: {};
  OTHER_QUESTION: {};
  BOOK: {};
  PROVIDE_PARTY_SIZE: { partySize: number };
  PROVIDE_DATETIME: { date: string; time: string };
  PROVIDE_CONTACT: { name: string; phone: string };
};

export type ReservationToolArgs = {
  CheckAvailability: { date: string; time: string; partySize: number };
  CreateReservation: {
    date: string; time: string; partySize: number;
    contact: { name: string; phone: string };
  };
};

export type ReservationToolResults = {
  CheckAvailability: { ok: boolean };
  CreateReservation: { reservationId: string };
};

export type ReservationFSM = FSM<
  ReservationStateId,
  ReservationContext,
  ReservationIntentMap,
  ReservationToolArgs,
  ReservationToolResults
>;
