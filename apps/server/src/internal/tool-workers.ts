import type { ToolWorker } from './flow';

/**
 * HTTP-based tool worker that calls external HTTP endpoints
 */
export class HTTPToolWorker implements ToolWorker {
  private baseUrl: string;
  private timeout: number;
  private headers: Record<string, string>;

  constructor(baseUrl: string, timeout: number = 30000, headers: Record<string, string> = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
    this.headers = { 'Content-Type': 'application/json', ...headers };
  }

  async execute(sessionId: string, toolCallId: string, args: any): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/${sessionId}/${toolCallId}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          session_id: sessionId,
          tool_call_id: toolCallId,
          args
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.result || result;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Tool execution timeout after ${this.timeout}ms`);
      }

      throw error;
    }
  }
}

/**
 * Redis queue-based tool worker
 */
export class QueueToolWorker implements ToolWorker {
  private redis: any; // Redis client
  private queueName: string;
  private responseTimeout: number;

  constructor(redis: any, queueName: string, responseTimeout: number = 30000) {
    this.redis = redis;
    this.queueName = queueName;
    this.responseTimeout = responseTimeout;
  }

  async execute(sessionId: string, toolCallId: string, args: any): Promise<any> {
    // Push job to queue
    const job = {
      session_id: sessionId,
      tool_call_id: toolCallId,
      args,
      timestamp: Date.now()
    };

    await this.redis.lpush(this.queueName, JSON.stringify(job));

    // Wait for response
    const responseKey = `tool_response:${toolCallId}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Tool response timeout after ${this.responseTimeout}ms`));
      }, this.responseTimeout);

      // Poll for response (in production, use pub/sub or blocking operations)
      const checkResponse = async () => {
        try {
          const response = await this.redis.get(responseKey);
          if (response) {
            clearTimeout(timeout);
            await this.redis.del(responseKey); // Cleanup

            const result = JSON.parse(response);
            if (result.error) {
              reject(new Error(result.error));
            } else {
              resolve(result.result);
            }
          } else {
            setTimeout(checkResponse, 100); // Check again in 100ms
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      checkResponse();
    });
  }
}

/**
 * Reservation-specific tool workers for the demo
 */
export class ReservationToolWorkers {
  /**
 * CheckAvailability tool worker
 */
  static createCheckAvailabilityWorker(orchestrator?: any): ToolWorker {
    return {
      async execute(sessionId: string, toolCallId: string, args: any): Promise<any> {
        const { date, time, partySize } = args;

        // Simulate availability checking logic
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock logic: larger parties have lower availability
        // Weekends are busier
        const dateObj = new Date(date);
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        const hour = parseInt(time.split(':')[0], 10);
        const isPrimeTime = hour >= 18 && hour <= 20;

        let availability = 0.9; // Base 90% availability

        if (isWeekend) availability -= 0.2;
        if (isPrimeTime) availability -= 0.2;
        if (partySize > 6) availability -= 0.3;
        if (partySize > 10) availability -= 0.4;

        const isAvailable = Math.random() < availability;

        const result = {
          ok: isAvailable,
          message: isAvailable
            ? `Table available for ${partySize} on ${date} at ${time}`
            : `No availability for ${partySize} on ${date} at ${time}`,
          alternativeTimes: isAvailable ? [] : [
            { date, time: '17:30' },
            { date, time: '21:00' }
          ]
        };

        // Don't call back to orchestrator here to avoid deadlock
        // The FSM will handle the result via the promise return

        return result;
      }
    };
  }

  /**
   * CreateReservation tool worker
   */
  static createCreateReservationWorker(orchestrator?: any): ToolWorker {
    return {
      async execute(sessionId: string, toolCallId: string, args: any): Promise<any> {
        const { date, time, partySize, contact } = args;

        // Simulate reservation creation
        await new Promise(resolve => setTimeout(resolve, 800));

        // Generate reservation ID
        const reservationId = `BV${Date.now().toString().slice(-6)}`;

        // Store reservation (in production, this would go to a database)
        console.log('Created reservation:', {
          id: reservationId,
          date,
          time,
          partySize,
          contact,
          createdAt: new Date().toISOString()
        });

        const result = {
          reservationId,
          status: 'confirmed',
          details: {
            date,
            time,
            partySize,
            contact,
            restaurant: 'Bella Vista',
            confirmationNumber: reservationId
          }
        };

        // Don't call back to orchestrator here to avoid deadlock
        // The FSM will handle the result via the promise return

        return result;
      }
    };
  }
}

/**
 * Generic function-based tool worker
 */
export class FunctionToolWorker implements ToolWorker {
  private fn: (sessionId: string, toolCallId: string, args: any) => Promise<any>;

  constructor(fn: (sessionId: string, toolCallId: string, args: any) => Promise<any>) {
    this.fn = fn;
  }

  async execute(sessionId: string, toolCallId: string, args: any): Promise<any> {
    return await this.fn(sessionId, toolCallId, args);
  }
}

/**
 * Tool worker registry for managing multiple workers
 */
export class ToolWorkerRegistry {
  private workers: Map<string, ToolWorker> = new Map();

  register(name: string, worker: ToolWorker): void {
    this.workers.set(name, worker);
  }

  get(name: string): ToolWorker | undefined {
    return this.workers.get(name);
  }

  has(name: string): boolean {
    return this.workers.has(name);
  }

  remove(name: string): boolean {
    return this.workers.delete(name);
  }

  list(): string[] {
    return Array.from(this.workers.keys());
  }

  clear(): void {
    this.workers.clear();
  }
}

/**
 * Error handling wrapper for tool workers
 */
export class SafeToolWorker implements ToolWorker {
  private worker: ToolWorker;
  private maxRetries: number;
  private retryDelay: number;

  constructor(worker: ToolWorker, maxRetries: number = 3, retryDelay: number = 1000) {
    this.worker = worker;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  async execute(sessionId: string, toolCallId: string, args: any): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.worker.execute(sessionId, toolCallId, args);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        console.warn(`Tool execution attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    throw lastError || new Error('Tool execution failed after retries');
  }
}
