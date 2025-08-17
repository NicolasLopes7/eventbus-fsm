import { useState, useEffect, useCallback } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { apiClient } from "../../lib/api-client";
import { useWebSocket } from "../../hooks/useWebSocket";
import type {
  FlowVisualizationData,
  DebugEvent,
  ServerMessage,
} from "../../lib/types";
import { v4 as uuidv4 } from "uuid";
import {
  RefreshCw,
  ArrowRight,
  PlayCircle,
  Circle,
  Settings,
  X,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface FlowVisualizationProps {
  sessionId?: string;
}

export function FlowVisualization({
  sessionId: initialSessionId,
}: FlowVisualizationProps) {
  const [flowData, setFlowData] = useState<FlowVisualizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(initialSessionId || "");
  const [autoRefresh, setAutoRefresh] = useState(false); // Disabled by default since we have real-time updates
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(true);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const addDebugEvent = useCallback((type: string, data?: any) => {
    const event: DebugEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type,
      data,
    };

    setDebugEvents((prev) => {
      const newEvents = [...prev, event];
      // Keep only last 50 events
      return newEvents.slice(-50);
    });
  }, []);

  const handleServerMessage = useCallback(
    (message: ServerMessage) => {
      addDebugEvent(`Received: ${message.type}`, message);

      // Refresh flow info on state changes
      if (
        message.type === "fsm.transition" ||
        message.type === "state.updated"
      ) {
        setTimeout(() => loadFlowInfo(sessionId), 100);
      }
    },
    [sessionId, addDebugEvent]
  );

  // Use centralized WebSocket connection
  const { isConnected } = useWebSocket({
    sessionId: sessionId || undefined,
    onMessage: handleServerMessage,
    enabled: !!sessionId,
  });

  const loadFlowInfo = async (currentSessionId?: string) => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiClient.getFlowInfo(currentSessionId);
      setFlowData(data);

      // No localStorage - session managed globally
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load flow information";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSession = () => {
    if (sessionId.trim()) {
      loadFlowInfo(sessionId.trim());
    }
  };

  const handleRefresh = () => {
    loadFlowInfo(sessionId || undefined);
  };

  const clearDebugEvents = () => {
    setDebugEvents([]);
  };

  // Auto-refresh as fallback when WebSocket is disconnected
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (autoRefresh && sessionId && !isConnected) {
      console.log(
        "🔄 Starting auto-refresh for flow visualization (WebSocket not connected)"
      );
      interval = setInterval(() => {
        loadFlowInfo(sessionId);
      }, 3000);
    }

    return () => {
      if (interval) {
        console.log("🛑 Stopping auto-refresh for flow visualization");
        clearInterval(interval);
      }
    };
  }, [autoRefresh, sessionId, isConnected]);

  // Load initial data
  useEffect(() => {
    if (initialSessionId) {
      setSessionId(initialSessionId);
      loadFlowInfo(initialSessionId);
    } else {
      loadFlowInfo();
    }
  }, [initialSessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading flow visualization...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6 max-w-md mx-auto">
          <div className="text-center text-red-600">
            <X className="w-8 h-8 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Error Loading Flow</h3>
            <p className="text-sm">{error}</p>
            <Button onClick={handleRefresh} className="mt-4" size="sm">
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 dark:scrollbar-track-gray-800 dark:scrollbar-thumb-gray-600">
        <div className="p-4">
          {/* Clean minimal controls */}
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleRefresh}
                size="sm"
                variant="outline"
                className="h-8"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>

              <Button
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                size="sm"
                variant="outline"
                className="h-8"
              >
                <Settings className="w-3 h-3" />
              </Button>
            </div>

            {/* Session Info Compact */}
            {flowData?.session && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                State:{" "}
                <span className="font-mono">
                  {flowData.session.currentState}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={(checked) => setAutoRefresh(checked === true)}
              />
              <Label
                htmlFor="auto-refresh"
                className="text-xs text-gray-600 dark:text-gray-400"
              >
                Fallback Poll
              </Label>
            </div>
          </div>

          {flowData && (
            <>
              {/* Legend */}
              <Card className="p-4 mb-6">
                <h3 className="font-semibold mb-3">State Legend</h3>
                <div className="flex flex-wrap gap-4 text-sm">
                  <LegendItem
                    color="bg-green-100 border-green-500"
                    label="Start State"
                  />
                  <LegendItem
                    color="bg-yellow-100 border-yellow-500"
                    label="Current State"
                  />
                  <LegendItem
                    color="bg-blue-100 border-blue-500"
                    label="Tool States"
                  />
                  <LegendItem
                    color="bg-gray-100 border-gray-300"
                    label="Available States"
                  />
                </div>
              </Card>

              {/* Flow Diagram */}
              <Card className="p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4 text-center">
                  🗺️ State Flow - Click for details
                </h3>
                <FlowDiagram
                  states={flowData.states}
                  startState={flowData.start}
                  session={flowData.session}
                  onStateClick={setSelectedState}
                />
              </Card>

              {/* State Details */}
              {selectedState && (
                <StateDetails
                  stateName={selectedState}
                  state={flowData.states.find((s) => s.name === selectedState)}
                  session={flowData.session}
                  onClose={() => setSelectedState(null)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Debug Panel */}
      {showDebugPanel && (
        <DebugPanel
          events={debugEvents}
          onClear={clearDebugEvents}
          isConnected={isConnected}
        />
      )}
    </div>
  );
}

function SessionInfo({
  session,
}: {
  session: NonNullable<FlowVisualizationData["session"]>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div>
        <strong>Session ID:</strong> {session.sessionId.substring(0, 8)}...
        <br />
        <strong>Current State:</strong>{" "}
        <span className="text-yellow-700 dark:text-yellow-300 font-semibold">
          {session.currentState}
        </span>
      </div>
      <div>
        {session.lastIntent && (
          <>
            <strong>Last Intent:</strong> {session.lastIntent.name} (
            {Math.round(session.lastIntent.confidence * 100)}%)
            <br />
          </>
        )}
        {/* {session?.lastToolCall && (
          <strong>Last Tool:</strong> 
        )} */}
      </div>
      {Object.keys(session.context || {}).length > 0 && (
        <div className="col-span-full bg-white dark:bg-gray-800 rounded-lg p-3 border">
          <strong>📝 Context:</strong>
          <pre className="text-xs mt-2 text-gray-600 dark:text-gray-300 overflow-x-auto">
            {JSON.stringify(session.context, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 rounded-full border-2 ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function FlowDiagram({
  states,
  startState,
  session,
  onStateClick,
}: {
  states: FlowVisualizationData["states"];
  startState: string;
  session?: FlowVisualizationData["session"];
  onStateClick: (stateName: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center items-center gap-4 min-h-48">
      {states.map((state, index) => {
        const isStart = state.name === startState;
        const isCurrent = session && state.name === session.currentState;
        const hasToolAction = state.onEnter.some((action) => action.tool);

        let stateClass = "bg-gray-100 border-gray-300 text-gray-700";
        if (isStart)
          stateClass = "bg-green-100 border-green-500 text-green-800";
        else if (isCurrent)
          stateClass =
            "bg-yellow-100 border-yellow-500 text-yellow-800 animate-pulse";
        else if (hasToolAction)
          stateClass = "bg-blue-100 border-blue-500 text-blue-800";

        return (
          <div key={state.name} className="flex items-center">
            <StateNode
              state={state}
              className={stateClass}
              isStart={isStart}
              isCurrent={!!isCurrent}
              onClick={() => onStateClick(state.name)}
            />
            {index < states.length - 1 && (
              <ArrowRight className="w-6 h-6 text-gray-400 mx-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StateNode({
  state,
  className,
  isStart,
  isCurrent,
  onClick,
}: {
  state: FlowVisualizationData["states"][0];
  className: string;
  isStart: boolean;
  isCurrent: boolean;
  onClick: () => void;
}) {
  return (
    <div className="text-center">
      <button
        onClick={onClick}
        className={`
          w-24 h-24 rounded-full border-2 flex flex-col items-center justify-center
          text-xs font-semibold p-2 cursor-pointer hover:scale-105 transition-transform
          hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${className}
        `}
      >
        <span className="leading-tight">
          {state.name.replace(/([A-Z])/g, " $1").trim()}
        </span>
        {isCurrent && <div className="mt-1">📍</div>}
        {isStart && <div className="mt-1">🚀</div>}
      </button>
      <div className="text-xs text-gray-500 mt-1 max-w-24 truncate">
        {state.name}
      </div>
    </div>
  );
}

function StateDetails({
  stateName,
  state,
  session,
  onClose,
}: {
  stateName: string;
  state?: FlowVisualizationData["states"][0];
  session?: FlowVisualizationData["session"];
  onClose: () => void;
}) {
  if (!state) return null;

  const isCurrent = session && state.name === session.currentState;

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">State Details: {stateName}</h3>
        <Button onClick={onClose} size="sm" variant="outline">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* State Info */}
        <div className="space-y-3">
          <h4 className="font-medium text-blue-600 dark:text-blue-400">
            📋 State Information
          </h4>
          {isCurrent && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <strong>Status:</strong> 📍 Currently active
            </div>
          )}
          {state.name === "InitialGreeting" && (
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <strong>Type:</strong> 🚀 Start state
            </div>
          )}
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <strong>Actions:</strong> {state.onEnter.length} action
            {state.onEnter.length !== 1 ? "s" : ""}
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <strong>Transitions:</strong> {state.transitions.length} transition
            {state.transitions.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Actions */}
        {state.onEnter.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-blue-600 dark:text-blue-400">
              🎬 Actions on Enter
            </h4>
            {state.onEnter.map((action, index) => {
              const actionType = Object.keys(action).find((key) =>
                ["say", "ask", "tool", "transfer", "hangup"].includes(key)
              );
              const actionValue = actionType
                ? action[actionType as keyof typeof action]
                : "Unknown";

              return (
                <div
                  key={index}
                  className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border-l-4 border-blue-500"
                >
                  <strong>{actionType}:</strong>{" "}
                  {typeof actionValue === "string"
                    ? actionValue
                    : JSON.stringify(actionValue)}
                </div>
              );
            })}
          </div>
        )}

        {/* Transitions */}
        {state.transitions.length > 0 && (
          <div className="space-y-3 md:col-span-2">
            <h4 className="font-medium text-blue-600 dark:text-blue-400">
              🔄 Transitions
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {state.transitions.map((transition, index) => {
                let desc = "";
                if (transition.onIntent) {
                  desc = `Intent: ${
                    Array.isArray(transition.onIntent)
                      ? transition.onIntent.join(", ")
                      : transition.onIntent
                  }`;
                } else if (transition.onToolResult) {
                  desc = `Tool Result: ${transition.onToolResult}`;
                }

                if (transition.to) {
                  desc += ` → ${transition.to}`;
                } else if (transition.branch) {
                  desc += ` → Branching`;
                }

                return (
                  <div
                    key={index}
                    className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border"
                  >
                    {desc}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Current Context */}
        {session &&
          isCurrent &&
          Object.keys(session.context || {}).length > 0 && (
            <div className="md:col-span-2 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-3">
                📊 Current Context
              </h4>
              <div className="space-y-2">
                {Object.entries(session.context).map(([key, value]) => (
                  <div
                    key={key}
                    className="bg-white dark:bg-gray-800 p-2 rounded border"
                  >
                    <strong>{key}:</strong> {JSON.stringify(value)}
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </Card>
  );
}

function DebugPanel({
  events,
  onClear,
  isConnected,
}: {
  events: DebugEvent[];
  onClear: () => void;
  isConnected: boolean;
}) {
  return (
    <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-800 text-white">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Live Debug Events</h3>
          <Button
            onClick={onClear}
            size="sm"
            variant="outline"
            className="text-xs"
          >
            Clear
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2 text-sm">
          <Circle
            className={`w-2 h-2 ${
              isConnected
                ? "fill-green-400 text-green-400"
                : "fill-red-400 text-red-400"
            }`}
          />
          <span>{isConnected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 dark:scrollbar-track-gray-800 dark:scrollbar-thumb-gray-600 p-4 space-y-2">
        {events.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">
            {isConnected
              ? "Connected - waiting for events..."
              : "Connect to a session to see live events"}
          </div>
        ) : (
          events.map((event) => <DebugEventItem key={event.id} event={event} />)
        )}
      </div>
    </div>
  );
}

function DebugEventItem({ event }: { event: DebugEvent }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-blue-600 dark:text-blue-400">
          {event.type}
        </span>
        <span className="text-xs text-gray-500">
          {event.timestamp.toLocaleTimeString()}
        </span>
      </div>

      {event.data && (
        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono overflow-x-auto">
          <pre>{JSON.stringify(event.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
