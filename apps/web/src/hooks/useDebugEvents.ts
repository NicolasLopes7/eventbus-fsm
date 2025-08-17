import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { DebugEvent, ServerMessage } from '../lib/types';

// Global debug events state
let globalDebugEvents: DebugEvent[] = [];
let subscribers = new Set<(events: DebugEvent[]) => void>();

export function useDebugEvents() {
  const [events, setEvents] = useState<DebugEvent[]>(globalDebugEvents);

  // Subscribe to global events
  useState(() => {
    const updateEvents = (newEvents: DebugEvent[]) => {
      setEvents([...newEvents]);
    };

    subscribers.add(updateEvents);

    return () => {
      subscribers.delete(updateEvents);
    };
  });

  const addDebugEvent = useCallback((type: string, data?: any) => {
    const event: DebugEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type,
      data,
    };

    // Add to global state
    globalDebugEvents = [...globalDebugEvents, event].slice(-50); // Keep only last 50 events

    // Notify all subscribers
    subscribers.forEach(callback => callback(globalDebugEvents));
  }, []);

  const clearDebugEvents = useCallback(() => {
    globalDebugEvents = [];
    subscribers.forEach(callback => callback(globalDebugEvents));
  }, []);

  const createServerMessageHandler = useCallback(() => {
    return (message: ServerMessage) => {
      addDebugEvent(`Received: ${message.type}`, message);
    };
  }, [addDebugEvent]);

  return {
    events,
    addDebugEvent,
    clearDebugEvents,
    createServerMessageHandler,
  };
}
