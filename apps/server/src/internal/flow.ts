import { v4 as uuidv4 } from 'uuid';
import type { FlowConfig, SessionState, TransitionConfig, ActionConfig, NLUIntent } from './types';
import { SessionManager } from './session-manager';
import { LLMClassifier } from './llm-classifier';
import { MockClassifier } from './mock-classifier';
import { TemplateResolver, ExpressionEvaluator } from './flow-parser';

/**
 * Core FSM Orchestrator - handles state transitions, actions, and tool calling
 */
export class FSMOrchestrator {
  private sessionManager: SessionManager;
  private classifier: LLMClassifier | MockClassifier;
  private toolRegistry: Map<string, ToolWorker> = new Map();

  constructor(redisUrl: string, apiKey?: string, useMockClassifier: boolean = true) {
    this.sessionManager = new SessionManager(redisUrl);

    // Use mock classifier by default, or if no API key provided
    if (useMockClassifier || !apiKey) {
      this.classifier = new MockClassifier();
    } else {
      this.classifier = new LLMClassifier(apiKey);
    }
  }

  /**
   * Register a tool worker
   */
  registerTool(name: string, worker: ToolWorker): void {
    this.toolRegistry.set(name, worker);
  }

  /**
   * Process user input through the FSM
   */
  async processUserInput(sessionId: string, userText: string): Promise<void> {
    await this.sessionManager.withLock(sessionId, async () => {
      const session = await this.sessionManager.getSessionState(sessionId);
      const flowConfig = await this.sessionManager.getFlowConfig(sessionId);

      if (!session || !flowConfig) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Classify user intent
      const intent = await this.classifier.classifyIntent(
        userText,
        flowConfig.intents,
        session.context
      );

      // Store the intent
      await this.sessionManager.storeIntent(sessionId, intent);

      // Process the intent through current state
      await this.processIntent(sessionId, intent, session, flowConfig);
    });
  }

  /**
 * Process tool result
 */
  async processToolResult(sessionId: string, toolCallId: string, result: any): Promise<void> {
    const session = await this.sessionManager.getSessionState(sessionId);
    const flowConfig = await this.sessionManager.getFlowConfig(sessionId);

    if (!session || !flowConfig) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Store tool result
    await this.sessionManager.storeToolResult(sessionId, toolCallId, result);

    // Process tool result transitions
    await this.processToolResultTransition(sessionId, session, flowConfig, toolCallId, result);
  }

  /**
   * Enter a new state and execute its onEnter actions
   */
  async enterState(sessionId: string, stateName: string): Promise<void> {
    const session = await this.sessionManager.getSessionState(sessionId);
    const flowConfig = await this.sessionManager.getFlowConfig(sessionId);

    if (!session || !flowConfig) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const state = flowConfig.states[stateName];
    if (!state) {
      throw new Error(`State ${stateName} not found in flow`);
    }

    // Transition to new state
    await this.sessionManager.transitionToState(sessionId, stateName);

    // Execute onEnter actions
    if (state.onEnter) {
      for (const action of state.onEnter) {
        await this.executeAction(sessionId, action, session, flowConfig);
      }
    }
  }

  /**
   * Process intent against current state transitions
   */
  private async processIntent(
    sessionId: string,
    intent: NLUIntent<any>,
    session: SessionState,
    flowConfig: FlowConfig
  ): Promise<void> {
    const currentState = flowConfig.states[session.currentState];
    if (!currentState?.transitions) return;

    for (const transition of currentState.transitions) {
      if (this.matchesIntentTransition(transition, intent, session)) {
        await this.executeTransition(sessionId, transition, session, flowConfig, intent);
        return;
      }
    }

    // No matching transition found - emit event and re-ask the question after delay
    await this.sessionManager.emitEvent(sessionId, {
      type: 'intent.unhandled',
      intent: intent.name,
      confidence: intent.confidence,
      currentState: session.currentState
    });

    // Wait 1 second then re-ask the current state's question
    setTimeout(async () => {
      await this.reAskCurrentQuestion(sessionId, session, flowConfig);
    }, 1000);
  }

  /**
   * Re-ask the current state's question when intent is unhandled
   */
  private async reAskCurrentQuestion(sessionId: string, session: SessionState, flowConfig: FlowConfig): Promise<void> {
    const currentState = flowConfig.states[session.currentState];
    if (!currentState?.onEnter) return;

    // Find the ask action in onEnter
    const askAction = currentState.onEnter.find(action => action.ask);
    if (askAction) {
      // Send a clarification message first
      await this.sessionManager.emitEvent(sessionId, {
        type: 'say',
        text: "I didn't quite understand that. Let me ask again:"
      });

      // Wait a moment then re-ask the original question
      setTimeout(async () => {
        const text = TemplateResolver.resolve(askAction.ask!, session.context, {}, session.lastToolResult?.result);
        await this.sessionManager.emitEvent(sessionId, {
          type: 'ask',
          text
        });
      }, 500);
    }
  }

  /**
   * Process tool result transitions
   */
  private async processToolResultTransition(
    sessionId: string,
    session: SessionState,
    flowConfig: FlowConfig,
    toolCallId: string,
    result: any
  ): Promise<void> {
    const currentState = flowConfig.states[session.currentState];
    if (!currentState?.transitions) return;

    // Find the tool name from the last tool call
    const toolName = session.lastToolCall?.name;
    if (!toolName) return;

    for (const transition of currentState.transitions) {
      if (this.matchesToolResultTransition(transition, toolName, result, session)) {
        await this.executeTransition(sessionId, transition, session, flowConfig, undefined, result);
        return;
      }
    }
  }

  /**
   * Check if transition matches intent
   */
  private matchesIntentTransition(transition: TransitionConfig, intent: NLUIntent<any>, session: SessionState): boolean {
    if (!transition.onIntent) return false;

    const intentMatches = Array.isArray(transition.onIntent)
      ? transition.onIntent.includes(intent.name as string)
      : transition.onIntent === intent.name;

    if (!intentMatches) return false;

    // Check when condition if present
    if (transition.when) {
      return ExpressionEvaluator.evaluate(transition.when, session.context);
    }

    return true;
  }

  /**
   * Check if transition matches tool result
   */
  private matchesToolResultTransition(
    transition: TransitionConfig,
    toolName: string,
    result: any,
    session: SessionState
  ): boolean {
    if (!transition.onToolResult) return false;

    if (transition.onToolResult !== toolName) return false;

    // Check when condition if present
    if (transition.when) {
      return ExpressionEvaluator.evaluate(transition.when, session.context, result);
    }

    return true;
  }

  /**
   * Execute a transition
   */
  private async executeTransition(
    sessionId: string,
    transition: TransitionConfig,
    session: SessionState,
    flowConfig: FlowConfig,
    intent?: NLUIntent<any>,
    toolResult?: any
  ): Promise<void> {
    // Apply context assignments
    if (transition.assign) {
      const updates: Record<string, any> = {};

      for (const [key, template] of Object.entries(transition.assign)) {
        updates[key] = TemplateResolver.resolve(
          template,
          session.context,
          intent?.slots,
          toolResult
        );
      }

      await this.sessionManager.updateContext(sessionId, updates);
    }

    // Handle branching
    if (transition.branch) {
      const updatedSession = await this.sessionManager.getSessionState(sessionId);
      if (!updatedSession) return;

      for (const branch of transition.branch) {
        if (ExpressionEvaluator.evaluate(branch.when, updatedSession.context, toolResult)) {
          await this.enterState(sessionId, branch.to);
          return;
        }
      }
    }

    // Direct transition
    if (transition.to) {
      await this.enterState(sessionId, transition.to);
    }
  }

  /**
   * Execute an action
   */
  private async executeAction(
    sessionId: string,
    action: ActionConfig,
    session: SessionState,
    flowConfig: FlowConfig
  ): Promise<void> {
    if (action.say) {
      const text = TemplateResolver.resolve(action.say, session.context, {}, session.lastToolResult?.result);
      await this.sessionManager.emitEvent(sessionId, {
        type: 'say',
        text
      });
    }

    if (action.ask) {
      const text = TemplateResolver.resolve(action.ask, session.context, {}, session.lastToolResult?.result);
      await this.sessionManager.emitEvent(sessionId, {
        type: 'ask',
        text
      });
    }

    if (action.transfer) {
      await this.sessionManager.emitEvent(sessionId, {
        type: 'transfer',
        to: action.transfer
      });
    }

    if (action.hangup) {
      await this.sessionManager.emitEvent(sessionId, {
        type: 'hangup'
      });
    }

    if (action.tool && action.args) {
      await this.executeTool(sessionId, action.tool, action.args, session, flowConfig);
    }
  }

  /**
   * Execute a tool call
   */
  private async executeTool(
    sessionId: string,
    toolName: string,
    argsTemplate: any,
    session: SessionState,
    flowConfig: FlowConfig
  ): Promise<void> {
    const toolCallId = uuidv4();

    // Resolve arguments from templates
    const args = this.resolveToolArgs(argsTemplate, session.context, {}, session.lastToolResult?.result);

    // Store tool call
    await this.sessionManager.storeToolCall(sessionId, toolCallId, toolName, args);

    // Get tool configuration
    const toolConfig = flowConfig.tools[toolName];
    const timeout = toolConfig?.timeout_ms || 30000;

    // Execute tool
    const worker = this.toolRegistry.get(toolName);
    if (!worker) {
      await this.sessionManager.emitEvent(sessionId, {
        type: 'tool.error',
        tool_call_id: toolCallId,
        error: `Tool ${toolName} not registered`
      });
      return;
    }

    try {
      // Set timeout for tool execution
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Tool ${toolName} timeout`)), timeout);
      });

      const resultPromise = worker.execute(sessionId, toolCallId, args);
      const result = await Promise.race([resultPromise, timeoutPromise]);

      // Process the tool result
      await this.processToolResult(sessionId, toolCallId, result);

    } catch (error) {
      await this.sessionManager.emitEvent(sessionId, {
        type: 'tool.error',
        tool_call_id: toolCallId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Resolve tool arguments from templates
   */
  private resolveToolArgs(argsTemplate: any, context: Record<string, any>, slots: Record<string, any> = {}, toolResult?: any): any {
    if (typeof argsTemplate === 'string') {
      return TemplateResolver.resolve(argsTemplate, context, slots, toolResult);
    }

    if (Array.isArray(argsTemplate)) {
      return argsTemplate.map(item => this.resolveToolArgs(item, context, slots, toolResult));
    }

    if (argsTemplate && typeof argsTemplate === 'object') {
      const resolved: any = {};
      for (const [key, value] of Object.entries(argsTemplate)) {
        resolved[key] = this.resolveToolArgs(value, context, slots, toolResult);
      }
      return resolved;
    }

    return argsTemplate;
  }

  /**
   * Get session manager for external access
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Get classifier for external access
   */
  getClassifier(): LLMClassifier | MockClassifier {
    return this.classifier;
  }

  /**
   * Get registered tool names for debugging
   */
  getToolRegistry(): string[] {
    return Array.from(this.toolRegistry.keys());
  }
}

/**
 * Interface for tool workers
 */
export interface ToolWorker {
  execute(sessionId: string, toolCallId: string, args: any): Promise<any>;
}

/**
 * Mock tool worker for testing
 */
export class MockToolWorker implements ToolWorker {
  private orchestrator: FSMOrchestrator;
  private mockResults: Record<string, any>;

  constructor(orchestrator: FSMOrchestrator, mockResults: Record<string, any> = {}) {
    this.orchestrator = orchestrator;
    this.mockResults = mockResults;
  }

  async execute(sessionId: string, toolCallId: string, args: any): Promise<any> {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Return mock result
    const result = this.mockResults.ok !== undefined
      ? { ok: this.mockResults.ok }
      : { success: true, ...this.mockResults };

    // Report result back to orchestrator
    await this.orchestrator.processToolResult(sessionId, toolCallId, result);

    return result;
  }
}
