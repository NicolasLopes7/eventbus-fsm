import type { FlowConfig, FlowConfigMeta, IntentDefinition, ToolDefinition, StateConfig, ActionConfig, TransitionConfig } from './types';

/**
 * Template string resolver for context and slot interpolation
 */
export class TemplateResolver {
  static resolve(template: string, context: Record<string, any>, slots?: Record<string, any>, toolResult?: any): any {
    // Handle non-string templates
    if (typeof template !== 'string') return template;

    // Replace {{ctx.*}} patterns
    let resolved = template.replace(/\{\{ctx\.([^}]+)\}\}/g, (_, path) => {
      return this.getNestedProperty(context, path) ?? '';
    });

    // Replace {{slot.*}} patterns
    if (slots) {
      resolved = resolved.replace(/\{\{slot\.([^}]+)\}\}/g, (_, path) => {
        return this.getNestedProperty(slots, path) ?? '';
      });
    }

    // Replace {{tool.*}} patterns
    if (toolResult) {
      resolved = resolved.replace(/\{\{tool\.([^}]+)\}\}/g, (_, path) => {
        return this.getNestedProperty(toolResult, path) ?? '';
      });
    }

    // Try to parse as JSON for objects, otherwise return as string
    try {
      return JSON.parse(resolved);
    } catch {
      // Handle numeric conversion
      if (/^\d+$/.test(resolved)) return parseInt(resolved, 10);
      if (/^\d+\.\d+$/.test(resolved)) return parseFloat(resolved);
      return resolved;
    }
  }

  private static getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }
}

/**
 * Simple expression evaluator for when conditions
 */
export class ExpressionEvaluator {
  static evaluate(expression: string, context: Record<string, any>, toolResult?: any): boolean {
    if (expression === 'else') return true;

    // Resolve templates first
    const resolved = TemplateResolver.resolve(expression, context, {}, toolResult);
    if (typeof resolved === 'boolean') return resolved;

    // Handle simple comparisons
    const operators = ['>=', '<=', '==', '!=', '>', '<', '&&', '||'];

    for (const op of operators) {
      if (expression.includes(op)) {
        const [left, right] = expression.split(op).map(s => s.trim());
        const leftVal = TemplateResolver.resolve(left, context, {}, toolResult);
        const rightVal = TemplateResolver.resolve(right, context, {}, toolResult);

        switch (op) {
          case '>=': return leftVal >= rightVal;
          case '<=': return leftVal <= rightVal;
          case '==': return leftVal == rightVal;
          case '!=': return leftVal != rightVal;
          case '>': return leftVal > rightVal;
          case '<': return leftVal < rightVal;
          case '&&': return leftVal && rightVal;
          case '||': return leftVal || rightVal;
        }
      }
    }

    // Fallback to truthy evaluation
    return Boolean(resolved);
  }
}

/**
 * FlowConfig validator and parser
 */
export class FlowConfigParser {
  static validate(config: any): config is FlowConfig {
    if (!config || typeof config !== 'object') {
      throw new Error('FlowConfig must be an object');
    }

    // Validate meta
    if (!config.meta || typeof config.meta !== 'object') {
      throw new Error('FlowConfig.meta is required');
    }
    if (!config.meta.name || typeof config.meta.name !== 'string') {
      throw new Error('FlowConfig.meta.name is required and must be a string');
    }

    // Validate start state
    if (!config.start || typeof config.start !== 'string') {
      throw new Error('FlowConfig.start is required and must be a string');
    }

    // Validate intents
    if (!config.intents || typeof config.intents !== 'object') {
      throw new Error('FlowConfig.intents is required');
    }

    for (const [intentName, intent] of Object.entries(config.intents)) {
      this.validateIntent(intentName, intent as any);
    }

    // Validate tools
    if (!config.tools || typeof config.tools !== 'object') {
      throw new Error('FlowConfig.tools is required');
    }

    for (const [toolName, tool] of Object.entries(config.tools)) {
      this.validateTool(toolName, tool as any);
    }

    // Validate states
    if (!config.states || typeof config.states !== 'object') {
      throw new Error('FlowConfig.states is required');
    }

    for (const [stateName, state] of Object.entries(config.states)) {
      this.validateState(stateName, state as any);
    }

    // Validate start state exists
    if (!config.states[config.start]) {
      throw new Error(`Start state '${config.start}' not found in states`);
    }

    return true;
  }

  private static validateIntent(name: string, intent: any): void {
    if (!intent || typeof intent !== 'object') {
      throw new Error(`Intent '${name}' must be an object`);
    }

    if (!Array.isArray(intent.examples)) {
      throw new Error(`Intent '${name}' must have examples array`);
    }

    if (!intent.slots || typeof intent.slots !== 'object') {
      throw new Error(`Intent '${name}' must have slots object`);
    }
  }

  private static validateTool(name: string, tool: any): void {
    if (!tool || typeof tool !== 'object') {
      throw new Error(`Tool '${name}' must be an object`);
    }

    if (!tool.args || typeof tool.args !== 'object') {
      throw new Error(`Tool '${name}' must have args object`);
    }

    if (!tool.result || typeof tool.result !== 'object') {
      throw new Error(`Tool '${name}' must have result object`);
    }

    if (tool.timeout_ms !== undefined && typeof tool.timeout_ms !== 'number') {
      throw new Error(`Tool '${name}' timeout_ms must be a number`);
    }
  }

  private static validateState(name: string, state: any): void {
    if (!state || typeof state !== 'object') {
      throw new Error(`State '${name}' must be an object`);
    }

    if (state.onEnter && !Array.isArray(state.onEnter)) {
      throw new Error(`State '${name}' onEnter must be an array`);
    }

    if (state.transitions && !Array.isArray(state.transitions)) {
      throw new Error(`State '${name}' transitions must be an array`);
    }

    // Validate actions
    if (state.onEnter) {
      for (const action of state.onEnter) {
        this.validateAction(name, action);
      }
    }

    // Validate transitions
    if (state.transitions) {
      for (const transition of state.transitions) {
        this.validateTransition(name, transition);
      }
    }
  }

  private static validateAction(stateName: string, action: any): void {
    if (!action || typeof action !== 'object') {
      throw new Error(`Action in state '${stateName}' must be an object`);
    }

    const validTypes = ['say', 'ask', 'transfer', 'hangup', 'tool'];
    const actionTypes = Object.keys(action).filter(key => validTypes.includes(key));

    if (actionTypes.length === 0) {
      throw new Error(`Action in state '${stateName}' must have one of: ${validTypes.join(', ')}`);
    }

    if (actionTypes.length > 1) {
      throw new Error(`Action in state '${stateName}' can only have one action type`);
    }
  }

  private static validateTransition(stateName: string, transition: any): void {
    if (!transition || typeof transition !== 'object') {
      throw new Error(`Transition in state '${stateName}' must be an object`);
    }

    const hasOnIntent = transition.onIntent !== undefined;
    const hasOnToolResult = transition.onToolResult !== undefined;
    const hasBranch = transition.branch !== undefined;

    if (!hasOnIntent && !hasOnToolResult && !hasBranch) {
      throw new Error(`Transition in state '${stateName}' must have onIntent, onToolResult, or branch`);
    }

    // Allow branch to be used with onIntent/onToolResult - this enables conditional transitions

    if (hasBranch && !Array.isArray(transition.branch)) {
      throw new Error(`Transition branch in state '${stateName}' must be an array`);
    }

    // Only require 'to' field if there's no branch
    if (!hasBranch && !transition.to) {
      throw new Error(`Transition in state '${stateName}' must have 'to' field when not using branch`);
    }
  }

  /**
   * Create the default reservation flow config for testing
   */
  static createReservationFlow(): FlowConfig {
    return {
      meta: {
        name: "Bella Vista Reservations",
        language: "en-US",
        voice: "alloy"
      },
      start: "InitialGreeting",

      intents: {
        BOOK: {
          examples: ["I'd like to book", "reservation", "table for two"],
          slots: {}
        },
        ASK_QUESTION: {
          examples: ["what's on the menu", "do you have vegan options?"],
          slots: {}
        },
        PROVIDE_PARTY_SIZE: {
          examples: ["we are 6", "party of 10"],
          slots: { partySize: "number" }
        },
        PROVIDE_DATETIME: {
          examples: ["tomorrow at 7pm", "Aug 20th 19:30"],
          slots: { date: "date", time: "time" }
        },
        PROVIDE_CONTACT: {
          examples: ["I'm Ana, 555-123", "name João phone 11987654321", "I'm nicolas, 84998995717"],
          slots: { name: "name", phone: "phone" }
        }
      },

      tools: {
        CheckAvailability: {
          args: { date: "string", time: "string", partySize: "number" },
          result: { ok: "boolean" },
          timeout_ms: 4000
        },
        CreateReservation: {
          args: {
            date: "string", time: "string", partySize: "number",
            contact: { name: "string", phone: "string" }
          },
          result: { reservationId: "string" },
          timeout_ms: 6000
        }
      },

      states: {
        InitialGreeting: {
          onEnter: [{ say: "Welcome to Bella Vista! How can I help?" }],
          transitions: [
            { onIntent: ["BOOK"], to: "CollectPartySize" },
            { onIntent: ["ASK_QUESTION"], to: "ProvideAdditionalInformation" }
          ]
        },

        ProvideAdditionalInformation: {
          onEnter: [{ ask: "Sure — what would you like to know?" }],
          transitions: [
            { onIntent: ["BOOK"], to: "CollectPartySize" },
            { onIntent: ["ASK_QUESTION"], to: "ProvideAdditionalInformation" }
          ]
        },

        CollectPartySize: {
          onEnter: [{ ask: "Great. How many people are in your party?" }],
          transitions: [
            {
              onIntent: ["PROVIDE_PARTY_SIZE"],
              assign: { partySize: "{{slot.partySize}}" },
              branch: [
                { when: "{{ctx.partySize}} > 8", to: "TransferToManager" },
                { when: "else", to: "CollectReservationDateTime" }
              ]
            }
          ]
        },

        TransferToManager: {
          onEnter: [
            { say: "For parties larger than eight, I'll transfer you to our manager." },
            { transfer: "+15551234567" }
          ]
        },

        CollectReservationDateTime: {
          onEnter: [{ ask: "What date and time would you like?" }],
          transitions: [
            {
              onIntent: ["PROVIDE_DATETIME"],
              assign: { date: "{{slot.date}}", time: "{{slot.time}}" },
              to: "ConfirmAvailability"
            }
          ]
        },

        ConfirmAvailability: {
          onEnter: [
            {
              tool: "CheckAvailability",
              args: { date: "{{ctx.date}}", time: "{{ctx.time}}", partySize: "{{ctx.partySize}}" }
            }
          ],
          transitions: [
            { onToolResult: "CheckAvailability", when: "{{tool.ok}} == true", to: "CollectContactInformation" },
            { onToolResult: "CheckAvailability", when: "else", to: "AltDateTime" }
          ]
        },

        AltDateTime: {
          onEnter: [{ say: "That time is unavailable." }, { ask: "Another date/time?" }],
          transitions: [
            {
              onIntent: ["PROVIDE_DATETIME"],
              assign: { date: "{{slot.date}}", time: "{{slot.time}}" },
              to: "ConfirmAvailability"
            }
          ]
        },

        CollectContactInformation: {
          onEnter: [{ ask: "Got it. Your name and phone?" }],
          transitions: [
            {
              onIntent: ["PROVIDE_CONTACT"],
              assign: {
                "contact.name": "{{slot.name}}",
                "contact.phone": "{{slot.phone}}"
              },
              to: "CreateBooking"
            }
          ]
        },

        CreateBooking: {
          onEnter: [
            {
              tool: "CreateReservation",
              args: {
                date: "{{ctx.date}}",
                time: "{{ctx.time}}",
                partySize: "{{ctx.partySize}}",
                contact: "{{ctx.contact}}"
              }
            }
          ],
          transitions: [
            { onToolResult: "CreateReservation", to: "Goodbye" }
          ]
        },

        Goodbye: {
          onEnter: [
            { say: "All set! Reservation {{tool.reservationId}}. See you soon!" },
            { hangup: true }
          ]
        }
      }
    };
  }
}
