import type { FlowConfig, IntentDefinition, NLUIntent } from './types';

/**
 * LLM-based intent classifier and slot extractor
 */
export class LLMClassifier {
  private apiKey?: string;
  private baseUrl: string = 'https://api.openai.com/v1';

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY;
    if (baseUrl) this.baseUrl = baseUrl;
  }

  /**
   * Classify user input into intent with slots
   */
  async classifyIntent(
    userText: string,
    intents: Record<string, IntentDefinition>,
    context: Record<string, any> = {}
  ): Promise<NLUIntent<any>> {
    const intentNames = Object.keys(intents);

    const systemPrompt = this.buildSystemPrompt(intents);
    const userPrompt = this.buildUserPrompt(userText, context);

    try {
      const response = await this.callLLM(systemPrompt, userPrompt, intentNames);
      return this.parseClassificationResult(response, intentNames);
    } catch (error) {
      console.error('LLM classification failed:', error);

      // Fallback to simple keyword matching
      return this.fallbackClassification(userText, intents);
    }
  }

  /**
   * Build system prompt for intent classification
   */
  private buildSystemPrompt(intents: Record<string, IntentDefinition>): string {
    const intentDescriptions = Object.entries(intents)
      .map(([name, def]) => {
        const examples = def.examples.slice(0, 3).join('", "');
        const slots = Object.keys(def.slots).join(', ');
        return `- ${name}: Examples: "${examples}". Slots: ${slots || 'none'}`;
      })
      .join('\n');

    return `You are an intent classifier. Classify user input into one of these intents and extract slots.

Available intents:
${intentDescriptions}

Rules:
1. Return ONLY valid JSON in this exact schema
2. Choose the intent with highest confidence
3. Extract all mentioned slots based on the user text
4. If uncertain, return lower confidence (but still classify)
5. Do NOT invent slot values not mentioned by user

Response schema:
{
  "intent": "INTENT_NAME",
  "confidence": 0.95,
  "slots": {
    "slotName": "value"
  }
}`;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(userText: string, context: Record<string, any>): string {
    const contextStr = Object.keys(context).length > 0
      ? `\n\nCurrent context: ${JSON.stringify(context, null, 2)}`
      : '';

    return `User said: "${userText}"${contextStr}
    
Classify this input and extract slots:`;
  }

  /**
   * Call LLM API for classification
   */
  private async callLLM(systemPrompt: string, userPrompt: string, intentNames: string[]): Promise<any> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return JSON.parse(result.choices[0].message.content);
  }

  /**
   * Parse and validate LLM classification result
   */
  private parseClassificationResult(result: any, intentNames: string[]): NLUIntent<any> {
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid LLM response format');
    }

    const { intent, confidence, slots } = result;

    if (!intent || !intentNames.includes(intent)) {
      throw new Error(`Invalid intent: ${intent}`);
    }

    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      throw new Error(`Invalid confidence: ${confidence}`);
    }

    return {
      name: intent,
      confidence,
      slots: slots || {}
    };
  }

  /**
   * Fallback classification using simple keyword matching
   */
  private fallbackClassification(userText: string, intents: Record<string, IntentDefinition>): NLUIntent<any> {
    const text = userText.toLowerCase();
    let bestMatch = { intent: '', confidence: 0 };

    for (const [intentName, definition] of Object.entries(intents)) {
      let score = 0;

      for (const example of definition.examples) {
        const exampleWords = example.toLowerCase().split(/\s+/);
        const matchedWords = exampleWords.filter(word => text.includes(word));
        score += matchedWords.length / exampleWords.length;
      }

      const avgScore = score / definition.examples.length;
      if (avgScore > bestMatch.confidence) {
        bestMatch = { intent: intentName, confidence: avgScore };
      }
    }

    // Extract basic slots with simple patterns
    const slots = this.extractSlotsWithPatterns(userText, intents[bestMatch.intent]);

    return {
      name: bestMatch.intent || Object.keys(intents)[0],
      confidence: Math.max(bestMatch.confidence, 0.1),
      slots
    };
  }

  /**
   * Extract slots using simple regex patterns
   */
  private extractSlotsWithPatterns(text: string, intentDef?: IntentDefinition): Record<string, any> {
    if (!intentDef) return {};

    const slots: Record<string, any> = {};

    for (const [slotName, slotType] of Object.entries(intentDef.slots)) {
      switch (slotType) {
        case 'number':
          const numberMatch = text.match(/\b(\d+)\b/);
          if (numberMatch) slots[slotName] = parseInt(numberMatch[1], 10);
          break;

        case 'date':
          // Simple date patterns
          const datePatterns = [
            /\b(\d{4}-\d{2}-\d{2})\b/, // ISO date
            /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/, // MM/DD/YYYY
            /\b(tomorrow|today)\b/i
          ];
          for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
              slots[slotName] = this.normalizeDate(match[1]);
              break;
            }
          }
          break;

        case 'time':
          const timeMatch = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i) ||
            text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
          if (timeMatch) {
            slots[slotName] = this.normalizeTime(timeMatch[0]);
          }
          break;

        case 'name':
          // Extract capitalized words as potential names
          const nameMatch = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
          if (nameMatch) slots[slotName] = nameMatch[1];
          break;

        case 'phone':
          const phoneMatch = text.match(/\b(\d{3}[-.]?\d{3}[-.]?\d{4}|\(\d{3}\)\s*\d{3}[-.]?\d{4})\b/);
          if (phoneMatch) slots[slotName] = phoneMatch[1];
          break;
      }
    }

    return slots;
  }

  /**
   * Normalize date string to ISO format
   */
  private normalizeDate(dateStr: string): string {
    if (dateStr === 'today') {
      return new Date().toISOString().split('T')[0];
    }
    if (dateStr === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }

    // Try to parse and return ISO format
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  }

  /**
   * Normalize time string to HH:MM format
   */
  private normalizeTime(timeStr: string): string {
    try {
      const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
      if (!match) return timeStr;

      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2] || '0', 10);
      const period = match[3]?.toLowerCase();

      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } catch {
      return timeStr;
    }
  }

  /**
   * Test the classifier with sample inputs
   */
  async test(): Promise<void> {
    const testIntents = {
      BOOK: {
        examples: ["I'd like to book", "reservation", "table for two"],
        slots: {}
      },
      PROVIDE_PARTY_SIZE: {
        examples: ["we are 6", "party of 10"],
        slots: { partySize: "number" }
      }
    };

    const testCases = [
      "I want to make a reservation",
      "Table for 4 people please",
      "We are a party of 8"
    ];

    console.log('Testing LLM Classifier:');
    for (const testCase of testCases) {
      try {
        const result = await this.classifyIntent(testCase, testIntents);
        console.log(`Input: "${testCase}"`);
        console.log(`Result:`, JSON.stringify(result, null, 2));
        console.log('---');
      } catch (error) {
        console.error(`Failed to classify "${testCase}":`, error);
      }
    }
  }
}
