import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import type { ChatMessage, ServerMessage } from '../lib/types';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { useWebSocket } from './useWebSocket';
import { useGlobalSession } from './useGlobalSession';

interface UseChatOptions {
  sessionId?: string;
  onSessionCreate?: (sessionId: string) => void;
}

let globalSessionPromise: Promise<string> | null = null; // Prevent duplicate session creation

export function useChat({ sessionId, onSessionCreate }: UseChatOptions = {}) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [context, setContext] = useState<Record<string, any>>({});

  // Query for the current session - manages session state globally
  const { data: currentSessionId } = useQuery({
    queryKey: ['chat-session', sessionId || 'new'],
    queryFn: async () => {
      // If sessionId prop is provided, use it
      if (sessionId) {
        console.log('📝 Using provided session ID:', sessionId);
        return sessionId;
      }

      // Prevent duplicate session creation across components
      if (globalSessionPromise) {
        console.log('⏳ Waiting for existing session creation...');
        return await globalSessionPromise;
      }

      // Create new session with global deduplication
      console.log('🚀 Creating new session via React Query...');
      globalSessionPromise = apiClient.createDemoReservation().then(response => {
        globalSessionPromise = null; // Reset after completion

        onSessionCreate?.(response.session_id);
        // Don't add duplicate session message - let WebSocket handle welcome

        return response.session_id;
      }).catch(error => {
        globalSessionPromise = null; // Reset on error
        throw error;
      });

      return await globalSessionPromise;
    },
    staleTime: Infinity, // Sessions don't expire
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    retry: 1, // Only retry once on failure
    enabled: !sessionId || !!sessionId, // Always enabled, but will use provided sessionId if available
  });

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const handleServerMessage = useCallback((message: ServerMessage) => {
    console.log('📨 Chat server message:', message.type);

    switch (message.type) {
      case 'session.started':
        // Add welcome message with helpful instructions
        setMessages((prev) => {
          // Only add if no bot messages exist yet
          const hasBotMessages = prev.some(msg => msg.type === 'bot');
          if (!hasBotMessages) {
            return [...prev, {
              id: uuidv4(),
              timestamp: new Date(),
              type: 'bot',
              content: `👋 Welcome to Bella Vista! How can I help you today?

💡 **Try these:**
• "I want to make a reservation"
• "Table for 4 people"
• "What's on the menu?"
• Add "(HANG ON)" to any message to trigger misclassification
• Watch the live flow visualization on the right →`,
            }];
          }
          return prev;
        });
        break;

      case 'say':
      case 'ask':
        addMessage({
          type: 'bot',
          content: message.text,
        });
        break;

      case 'state.updated':
        setContext(message.ctx);
        break;

      case 'fsm.transition':
        addMessage({
          type: 'system',
          content: `🔄 State: ${message.from} → ${message.to}`,
        });
        break;

      case 'tool.call':
        addMessage({
          type: 'system',
          content: `🔧 Calling tool: ${message.name}`,
        });
        break;

      case 'tool.result':
        addMessage({
          type: 'system',
          content: `✅ Tool completed: ${JSON.stringify(message.result)}`,
        });
        break;

      case 'hangup':
        addMessage({
          type: 'bot',
          content: 'Thank you for using our service! 👋',
        });
        break;

      case 'error':
        addMessage({
          type: 'error',
          content: message.message,
        });
        break;
    }
  }, [addMessage]);

  // Use centralized WebSocket connection
  const { isConnected, sendMessage: wsSendMessage } = useWebSocket({
    sessionId: currentSessionId,
    onMessage: handleServerMessage,
    enabled: !!currentSessionId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (text: string) => {
      if (!isConnected) {
        throw new Error('WebSocket not connected');
      }

      addMessage({
        type: 'user',
        content: text,
      });

      wsSendMessage({
        type: 'user.text',
        text: text,
      });

      return Promise.resolve();
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });

  // Handle sessionId prop changes
  useEffect(() => {
    if (sessionId && sessionId !== currentSessionId) {
      console.log('🔄 Session ID prop changed to:', sessionId);
      queryClient.setQueryData(['chat-session'], sessionId);
      // Don't add resuming message - let WebSocket handle session start
    }
  }, [sessionId, currentSessionId, queryClient]);

  const startNewSession = () => {
    console.log('🔄 Starting new session...');
    setMessages([]);
    setContext({});

    // Clear global session promise to allow new session creation
    globalSessionPromise = null;

    // Clear the current session and trigger a new one
    queryClient.removeQueries({ queryKey: ['chat-session'] });
    queryClient.invalidateQueries({ queryKey: ['chat-session'] });
  };

  return {
    // Data
    messages,
    context,
    currentSessionId,
    isConnected,

    // Actions
    sendMessage: (text: string) => sendMessageMutation.mutate(text),
    startNewSession,

    // Status
    isCreatingSession: !currentSessionId,
    isSendingMessage: sendMessageMutation.isPending,
  };
}
