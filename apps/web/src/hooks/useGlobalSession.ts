import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

// Global key for the current active session
const GLOBAL_SESSION_KEY = ['global-session'];

export function useGlobalSession() {
  const queryClient = useQueryClient();

  // Query for the global current session - NO localStorage, always start fresh
  const { data: currentSessionId } = useQuery<string | null>({
    queryKey: GLOBAL_SESSION_KEY,
    queryFn: () => {
      // Always start with no session - create fresh every time
      return null;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Function to set the current session globally
  const setCurrentSession = useCallback((sessionId: string | null) => {
    console.log('🌍 Setting global session:', sessionId);

    // Update React Query cache only - NO localStorage persistence
    queryClient.setQueryData(GLOBAL_SESSION_KEY, sessionId);

    // Invalidate related queries to trigger updates
    queryClient.invalidateQueries({ queryKey: ['websocket'] });
    queryClient.invalidateQueries({ queryKey: ['flow-info'] });
  }, [queryClient]);

  return {
    currentSessionId,
    setGlobalSessionId: setCurrentSession,
  };
}
