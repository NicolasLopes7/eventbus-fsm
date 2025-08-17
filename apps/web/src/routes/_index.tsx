import { useState, useEffect } from "react";
import type { Route } from "./+types/_index";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { SimpleChatInterface } from "../components/chat/SimpleChatInterface";
import { FlowVisualization } from "../components/flow/FlowVisualization";
import { useGlobalSession } from "../hooks/useGlobalSession";
import { apiClient } from "../lib/api-client";

import {
  MessageCircle,
  GitBranch,
  Activity,
  CheckCircle,
  XCircle,
  Edit3,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "EventBus FSM - Intelligent Conversations" },
    {
      name: "description",
      content: "Real-time FSM conversations with live flow visualization",
    },
  ];
}

export default function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">(
    "checking"
  );
  const { currentSessionId, setGlobalSessionId } = useGlobalSession();

  // Clear any old localStorage on load - always start fresh!
  useEffect(() => {
    localStorage.removeItem("fsm_session_id");
  }, []);

  const checkApiHealth = async () => {
    try {
      await apiClient.health();
      setApiStatus("online");
    } catch (error) {
      setApiStatus("offline");
      console.error("API health check failed:", error);

      if (error instanceof Error && error.message.includes("Network error")) {
        toast.error(
          "Cannot connect to server. Please ensure the EventBus FSM server is running on port 3000."
        );
      }
    }
  };

  // Auto-create session if none exists
  useEffect(() => {
    if (apiStatus === "online" && !currentSessionId) {
      const createSession = async () => {
        try {
          const response = await apiClient.createDemoReservation();
          setGlobalSessionId(response.session_id);
          toast.success("Session created automatically");
        } catch (error) {
          console.error("Failed to create session:", error);
          toast.error("Failed to create session");
        }
      };
      createSession();
    }
  }, [apiStatus, currentSessionId, setGlobalSessionId]);

  useEffect(() => {
    checkApiHealth();
    const interval = setInterval(checkApiHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNewSession = async () => {
    try {
      const response = await apiClient.createDemoReservation();
      setGlobalSessionId(response.session_id);
      toast.success("New session created");
    } catch (error) {
      console.error("Failed to create new session:", error);
      toast.error("Failed to create new session");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              EventBus FSM
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Real-time conversation flows with live state visualization
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* API Status */}
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-600" />
              {apiStatus === "checking" && (
                <>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                  <span className="text-sm text-yellow-600">Checking...</span>
                </>
              )}
              {apiStatus === "online" && (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600">Online</span>
                </>
              )}
              {apiStatus === "offline" && (
                <>
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-600">Offline</span>
                </>
              )}
            </div>

            {/* Session Info */}
            {currentSessionId && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <MessageCircle className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-mono text-blue-700 dark:text-blue-300">
                  {currentSessionId?.substring(0, 8)}...
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleNewSession}
                size="sm"
                variant="outline"
                disabled={apiStatus !== "online"}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                New Session
              </Button>

              <Button asChild size="sm" variant="outline">
                <a
                  href="/flow-editor"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Flow Editor
                </a>
              </Button>

              <Button asChild size="sm" variant="outline">
                <a
                  href="/flow-manager"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Flow Database
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="flex-shrink-0 bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Conversation
              </h2>
              {currentSessionId && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Session: {currentSessionId?.substring(0, 8)}...
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-gray-800 overflow-hidden">
            {currentSessionId ? (
              <SimpleChatInterface
                sessionId={currentSessionId}
                onSessionCreate={(sessionId) => setGlobalSessionId(sessionId)}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Creating session...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Flow Visualization Panel */}
        <div className="w-1/2 flex flex-col">
          <div className="flex-shrink-0 bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Flow Visualization
                </h2>
                <div className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                    Live
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-gray-800 overflow-hidden">
            {currentSessionId ? (
              <FlowVisualization sessionId={currentSessionId} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Waiting for session...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-2">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span>EventBus FSM v1.0.0</span>
            <span>•</span>
            <span>Real-time WebSocket connected</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Built with React + TypeScript</span>
          </div>
        </div>
      </div>
    </div>
  );
}
