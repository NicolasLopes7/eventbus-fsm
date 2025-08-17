import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/chat";
import { SimpleChatInterface } from "../components/chat/SimpleChatInterface";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import {
  ArrowLeft,
  MessageSquare,
  Play,
  Loader2,
  Database,
} from "lucide-react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import type { Flow } from "../lib/types";
import { toast } from "sonner";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chat - EventBus FSM" },
    {
      name: "description",
      content: "Interactive chat interface for EventBus FSM conversations",
    },
  ];
}

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const flowId = searchParams.get("flow");

  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [loadingFlows, setLoadingFlows] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);

  // Load available flows
  useEffect(() => {
    const loadFlows = async () => {
      try {
        setLoadingFlows(true);
        const response = await apiClient.getFlows({ status: "published" });
        setFlows(response.flows);

        // If flowId is in URL, select that flow
        if (flowId) {
          const flow = response.flows.find((f) => f.id === flowId);
          if (flow) {
            setSelectedFlow(flow);
          }
        }
      } catch (error) {
        console.error("Failed to load flows:", error);
        toast.error("Failed to load flows");
      } finally {
        setLoadingFlows(false);
      }
    };

    loadFlows();
  }, [flowId]);

  const handleFlowSelect = (flow: Flow) => {
    setSelectedFlow(flow);
    // Update URL to include selected flow
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("flow", flow.id);
    setSearchParams(newSearchParams);
  };

  const handleCreateSession = async (flow: Flow) => {
    try {
      setCreatingSession(true);
      const response = await apiClient.createSession(flow.definition);

      // Update URL with new session
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set("session", response.session_id);
      newSearchParams.set("flow", flow.id);
      setSearchParams(newSearchParams);

      toast.success("Session created successfully!");
    } catch (error) {
      console.error("Failed to create session:", error);
      toast.error("Failed to create session");
    } finally {
      setCreatingSession(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "testing":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "draft":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case "archived":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  // If no session, show flow selector
  if (!sessionId) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-xl font-semibold">Start New Chat</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select a flow to begin testing
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/flow-manager">
                <Database className="w-4 h-4 mr-2" />
                Manage Flows
              </Link>
            </Button>
          </div>
        </div>

        {/* Flow Selection */}
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Select a Flow to Test</CardTitle>
                <CardDescription>
                  Choose from your published flows to start a new chat session
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFlows ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading flows...
                  </div>
                ) : flows.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🤖</div>
                    <h3 className="text-lg font-semibold mb-2">
                      No Published Flows
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      You need to publish at least one flow to start testing
                    </p>
                    <Button asChild>
                      <Link to="/flow-manager">Create Your First Flow</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {flows.map((flow) => (
                      <Card
                        key={flow.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedFlow?.id === flow.id
                            ? "ring-2 ring-blue-500"
                            : ""
                        }`}
                        onClick={() => handleFlowSelect(flow)}
                      >
                        <CardHeader className="pb-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base">
                                {flow.name}
                              </CardTitle>
                              <CardDescription className="mt-1">
                                {flow.description || "No description"}
                              </CardDescription>
                            </div>
                            <Badge className={getStatusColor(flow.status)}>
                              {flow.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                              Version {flow.version} • {flow.usageCount} uses
                            </div>
                            {selectedFlow?.id === flow.id && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreateSession(flow);
                                }}
                                disabled={creatingSession}
                                className="flex items-center gap-2"
                              >
                                {creatingSession ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                                Start Chat
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Regular chat interface when session exists
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/chat">
              <ArrowLeft className="w-4 h-4 mr-2" />
              New Chat
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-semibold">
                {selectedFlow ? selectedFlow.name : "Chat Interface"}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Session: {sessionId.substring(0, 8)}...
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedFlow && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/flow/${selectedFlow.id}`}>View Flow Details</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link
              to={sessionId ? `/flow-info?session=${sessionId}` : "/flow-info"}
            >
              View Flow Info
            </Link>
          </Button>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 p-4">
        <SimpleChatInterface sessionId={sessionId} />
      </div>
    </div>
  );
}
