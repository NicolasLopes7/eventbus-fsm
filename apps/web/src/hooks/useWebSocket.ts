import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect, useCallback } from 'react';
import type { ServerMessage } from '../lib/types';

interface UseWebSocketOptions {
  sessionId?: string;
  onMessage?: (message: ServerMessage) => void;
  enabled?: boolean;
}

// Global WebSocket management to prevent duplicate connections
let globalWs: WebSocket | null = null;
let globalSessionId: string | null = null;
let messageHandlers = new Set<(message: ServerMessage) => void>();

export function useWebSocket({ sessionId, onMessage, enabled = true }: UseWebSocketOptions) {
  const queryClient = useQueryClient();
  const handlerRef = useRef(onMessage);

  // Keep handler ref up to date
  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  // WebSocket connection query
  const { data: connectionState } = useQuery({
    queryKey: ['websocket', sessionId],
    queryFn: async () => {
      if (!sessionId || !enabled) {
        console.log('⏳ No session ID or WebSocket disabled');
        return { connected: false, sessionId: null };
      }

      // If we already have a connection for this session, reuse it
      if (globalWs && globalSessionId === sessionId && globalWs.readyState === WebSocket.OPEN) {
        console.log('♻️ Reusing existing WebSocket connection for session:', sessionId);
        return { connected: true, sessionId };
      }

      // Clean up any existing connection
      if (globalWs) {
        console.log('🧹 Cleaning up existing WebSocket connection');
        globalWs.close();
        globalWs = null;
        globalSessionId = null;
      }

      // Create new connection
      return new Promise<{ connected: boolean; sessionId: string | null }>((resolve, reject) => {
        const wsUrl = `ws://localhost:3001?id=${sessionId}`;
        console.log('🔌 Creating new WebSocket connection for session:', sessionId);

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('✅ WebSocket connected to session:', sessionId);
          globalWs = ws;
          globalSessionId = sessionId;
          resolve({ connected: true, sessionId });
        };

        ws.onmessage = (event) => {
          try {
            const message: ServerMessage = JSON.parse(event.data);
            console.log('📨 WebSocket message:', message.type);

            // Broadcast to all handlers
            messageHandlers.forEach(handler => {
              try {
                handler(message);
              } catch (error) {
                console.error('Error in message handler:', error);
              }
            });
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onclose = (event) => {
          console.log('❌ WebSocket disconnected from session:', sessionId, 'Code:', event.code);
          if (globalWs === ws) {
            globalWs = null;
            globalSessionId = null;
          }
          // Invalidate the connection query to trigger reconnection if needed
          queryClient.invalidateQueries({ queryKey: ['websocket'] });
        };

        ws.onerror = (error) => {
          console.error('WebSocket error for session:', sessionId, error);
          reject(error);
        };

        // Cleanup timeout
        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 5000);
      });
    },
    staleTime: Infinity, // Connection state doesn't become stale
    gcTime: 0, // Don't cache disconnected states
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    enabled: !!sessionId && enabled,
  });

  // Register/unregister message handler
  useEffect(() => {
    if (!handlerRef.current) return;

    const handler = handlerRef.current;
    messageHandlers.add(handler);

    return () => {
      messageHandlers.delete(handler);
    };
  }, [sessionId, enabled]);

  // Send message function
  const sendMessage = useCallback((message: any) => {
    if (!globalWs || globalWs.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    globalWs.send(JSON.stringify(message));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Only close if no other components are using the connection
      if (messageHandlers.size === 0 && globalWs) {
        console.log('🧹 No more handlers, closing WebSocket connection');
        globalWs.close();
        globalWs = null;
        globalSessionId = null;
      }
    };
  }, []);

  return {
    isConnected: connectionState?.connected ?? false,
    sessionId: connectionState?.sessionId ?? null,
    sendMessage,
  };
}
