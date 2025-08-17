import type { IntentDefinition, NLUIntent } from './types';

/**
 * Mock classifier that uses pattern matching instead of OpenAI
 * Detects "(HANG ON)" at the end as incorrect classification signal
 */
export class MockClassifier {
  /**
   * Classify user input into intent with slots using pattern matching
   */
  async classifyIntent(
    userText: string,
    intents: Record<string, IntentDefinition>,
    context: Record<string, any> = {}
  ): Promise<NLUIntent<any>> {
    // Check if user wants to trigger incorrect classification
    const isIncorrect = userText.trim().endsWith('(HANG ON)');
    const cleanText = userText.replace(/\s*\(HANG ON\)\s*$/i, '').trim();

    // If incorrect flag, return a low-confidence misclassification
    if (isIncorrect) {
      const intentNames = Object.keys(intents);
      const randomIntent = intentNames[Math.floor(Math.random() * intentNames.length)];
      return {
        name: randomIntent,
        confidence: 0.3, // Low confidence
        slots: {}
      };
    }

    // Pattern matching for each intent
    for (const [intentName, definition] of Object.entries(intents)) {
      const match = this.matchIntent(cleanText, definition);
      if (match.confidence > 0.5) {
        return {
          name: intentName,
          confidence: match.confidence,
          slots: match.slots
        };
      }
    }

    // Fallback to first intent with low confidence
    const firstIntent = Object.keys(intents)[0];
    return {
      name: firstIntent,
      confidence: 0.2,
      slots: {}
    };
  }

  /**
   * Match user text against intent definition
   */
  private matchIntent(text: string, definition: IntentDefinition): { confidence: number; slots: Record<string, any> } {
    const lowerText = text.toLowerCase();
    let score = 0;
    const slots: Record<string, any> = {};

    // Check examples for keyword matches
    for (const example of definition.examples) {
      const exampleWords = example.toLowerCase().split(/\s+/);
      const matchedWords = exampleWords.filter(word =>
        lowerText.includes(word) && word.length > 2 // Ignore short words
      );
      score += (matchedWords.length / exampleWords.length) * 0.5;
    }

    // Extract slots
    for (const [slotName, slotType] of Object.entries(definition.slots)) {
      const extracted = this.extractSlot(text, slotType);
      if (extracted !== null) {
        slots[slotName] = extracted;
        score += 0.3; // Bonus for finding slots
      }
    }

    // Intent-specific patterns
    score += this.getIntentSpecificScore(lowerText, definition);

    return {
      confidence: Math.min(score, 0.95), // Cap at 95%
      slots
    };
  }

  /**
   * Extract slot value based on type
   */
  private extractSlot(text: string, slotType: string): any {
    switch (slotType) {
      case 'number':
        const numberMatch = text.match(/\b(\d+)\b/);
        return numberMatch ? parseInt(numberMatch[1], 10) : null;

      case 'date':
        // Simple date patterns
        const datePatterns = [
          /\b(tomorrow|today)\b/i,
          /\b(\d{4}-\d{2}-\d{2})\b/,
          /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
          /\b(next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
          /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
        ];

        for (const pattern of datePatterns) {
          const match = text.match(pattern);
          if (match) {
            return this.normalizeDate(match[1] || match[0]);
          }
        }
        return null;

      case 'time':
        const timePatterns = [
          /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i,
          /\b(\d{1,2})\s*(am|pm)\b/i,
          /\b(\d{1,2})(:\d{2})?\s*o'?clock\b/i
        ];

        for (const pattern of timePatterns) {
          const match = text.match(pattern);
          if (match) {
            return this.normalizeTime(match[0]);
          }
        }
        return null;

      case 'name':
        // Extract potential names (capitalized words)
        const nameMatch = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
        return nameMatch ? nameMatch[1] : null;

      case 'phone':
        const phonePatterns = [
          /\b(\d{3}[-.]?\d{3}[-.]?\d{4})\b/,
          /\b\((\d{3})\)\s*(\d{3})[-.]?(\d{4})\b/,
          /\b(\d{11})\b/
        ];

        for (const pattern of phonePatterns) {
          const match = text.match(pattern);
          if (match) {
            return match[1] || match[0];
          }
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Get intent-specific scoring based on keywords and context
   */
  private getIntentSpecificScore(text: string, definition: IntentDefinition): number {
    let score = 0;

    // Check for standalone number (likely party size if in right context)
    const standaloneNumber = text.match(/^\s*(\d+)\s*$/);
    if (standaloneNumber && definition.slots.partySize) {
      score += 0.8; // High score for standalone numbers when expecting party size
    }

    // Booking-related patterns
    if (text.includes('book') || text.includes('reservation') ||
      text.includes('table') || text.includes('reserve')) {
      score += 0.4;
    }

    // Question patterns
    if (text.includes('?') || text.startsWith('what') ||
      text.startsWith('how') || text.startsWith('do you')) {
      score += 0.3;
    }

    // Party size patterns
    if (text.includes('party') || text.includes('people') ||
      text.includes('person') || text.includes('we are')) {
      score += 0.3;
    }

    // Contact patterns - check for both name and phone patterns
    const hasName = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text);
    const hasPhone = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text);
    if (text.includes('name') || text.includes('phone') ||
      text.includes('contact') || text.includes('call me') ||
      hasName || hasPhone) {
      score += 0.3;
    }

    // Date/time patterns
    if (text.includes('tomorrow') || text.includes('today') ||
      text.includes('pm') || text.includes('am') ||
      text.includes(':') || text.includes('time') ||
      text.includes('monday') || text.includes('tuesday') ||
      text.includes('wednesday') || text.includes('thursday') ||
      text.includes('friday') || text.includes('saturday') ||
      text.includes('sunday')) {
      score += 0.3;
    }

    return score;
  }

  /**
   * Normalize date string to ISO format
   */
  private normalizeDate(dateStr: string): string {
    const lower = dateStr.toLowerCase();

    if (lower === 'today') {
      return new Date().toISOString().split('T')[0];
    }

    if (lower === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }

    if (lower.includes('next')) {
      const dayName = lower.replace('next ', '');
      const today = new Date();
      const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(dayName);

      if (targetDay !== -1) {
        const daysUntilTarget = (targetDay + 7 - today.getDay()) % 7 || 7;
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntilTarget);
        return targetDate.toISOString().split('T')[0];
      }
    }

    // Try to parse as regular date
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      // Ignore parsing errors
    }

    return dateStr;
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
    } catch (e) {
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
      },
      PROVIDE_DATETIME: {
        examples: ["tomorrow at 7pm", "Aug 20th 19:30"],
        slots: { date: "date", time: "time" }
      },
      PROVIDE_CONTACT: {
        examples: ["I'm Ana, 555-123", "name João phone 11987654321"],
        slots: { name: "name", phone: "phone" }
      }
    };

    const testCases = [
      "I want to make a reservation",
      "Table for 4 people please",
      "We are a party of 8",
      "Tomorrow at 7pm",
      "My name is John Doe, phone 555-1234",
      "I want a table (HANG ON)" // This should trigger incorrect classification
    ];

    console.log('Testing Mock Classifier:');
    for (const testCase of testCases) {
      const result = await this.classifyIntent(testCase, testIntents);
      console.log(`Input: "${testCase}"`);
      console.log(`Result:`, JSON.stringify(result, null, 2));
      console.log('---');
    }
  }
}
