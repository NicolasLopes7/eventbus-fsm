import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { FlowVisualization } from "../components/flow/FlowVisualization";
import { FSMFlowEditor } from "../components/flow/FSMFlowEditor";
import type { Flow, FlowConfig, FlowVisualizationData } from "../lib/types";
import { apiClient } from "../lib/api-client";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  ArrowLeft,
  Edit,
  Eye,
  Play,
  Save,
  Loader2,
  Database,
  MessageSquare,
  Calendar,
  User,
  BarChart,
} from "lucide-react";
import { toast } from "sonner";

type ViewMode = "view" | "edit";

export default function FlowDetailPage() {
  const { flowId } = useParams();
  const navigate = useNavigate();

  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("view");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [flowVizData, setFlowVizData] = useState<FlowVisualizationData | null>(
    null
  );

  // Load flow data
  useEffect(() => {
    if (!flowId) return;

    const loadFlow = async () => {
      try {
        setLoading(true);
        const flowData = await apiClient.getFlow(flowId);
        setFlow(flowData);

        // Convert Flow to FlowVisualizationData format
        const vizData: FlowVisualizationData = {
          meta: flowData.definition.meta,
          start: flowData.definition.start,
          states: Object.entries(flowData.definition.states).map(
            ([name, config]) => ({
              name,
              onEnter: config.onEnter || [],
              transitions: config.transitions || [],
              isCurrent: false, // No active session for viewing
            })
          ),
          intents: Object.entries(flowData.definition.intents).map(
            ([name, config]) => ({
              name,
              examples: config.examples,
              slots: Object.keys(config.slots),
            })
          ),
          tools: Object.entries(flowData.definition.tools).map(
            ([name, config]) => ({
              name,
              args: Object.keys(config.args),
              result: Object.keys(config.result),
              timeout: config.timeout_ms || 30000,
            })
          ),
        };
        setFlowVizData(vizData);
      } catch (error) {
        console.error("Failed to load flow:", error);
        toast.error("Failed to load flow");
        navigate("/flow-manager");
      } finally {
        setLoading(false);
      }
    };

    loadFlow();
  }, [flowId, navigate]);

  const handleSaveFlow = async (flowDefinition: FlowConfig) => {
    if (!flow) return;

    try {
      setSaving(true);
      const updatedFlow = await apiClient.updateFlow(flow.id, {
        definition: flowDefinition,
      });

      setFlow(updatedFlow);
      setHasUnsavedChanges(false);
      toast.success("Flow saved successfully!");
    } catch (error) {
      console.error("Failed to save flow:", error);
      toast.error("Failed to save flow");
    } finally {
      setSaving(false);
    }
  };

  const handleTestFlow = async (flowDefinition: FlowConfig) => {
    try {
      const response = await apiClient.createSession(flowDefinition);
      toast.success("Test session created!");

      // Navigate to chat with the new session
      window.open(`/chat?session=${response.session_id}`, "_blank");
    } catch (error) {
      console.error("Failed to test flow:", error);
      toast.error("Failed to create test session");
    }
  };

  const handleModeSwitch = (newMode: ViewMode) => {
    if (viewMode === "edit" && hasUnsavedChanges) {
      if (
        !confirm(
          "You have unsaved changes. Are you sure you want to switch modes?"
        )
      ) {
        return;
      }
      setHasUnsavedChanges(false);
    }
    setViewMode(newMode);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading flow...</span>
        </div>
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Flow not found</h2>
          <p className="text-muted-foreground mb-4">
            The requested flow could not be found.
          </p>
          <Button onClick={() => navigate("/flow-manager")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Flow Manager
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/flow-manager")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Manager
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <Database className="h-6 w-6 text-blue-600" />
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold">{flow.name}</h1>
                    <Badge className={getStatusColor(flow.status)}>
                      {flow.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {flow.description || "No description"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {viewMode === "edit" && hasUnsavedChanges && (
                <span className="text-sm text-orange-600 dark:text-orange-400">
                  Unsaved changes
                </span>
              )}

              {viewMode === "view" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleModeSwitch("edit")}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Flow
                </Button>
              )}

              {viewMode === "edit" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleModeSwitch("view")}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View Mode
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestFlow(flow.definition)}
                className="flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Test in Chat
              </Button>

              {viewMode === "edit" && (
                <Button
                  size="sm"
                  onClick={() => handleSaveFlow(flow.definition)}
                  disabled={!hasUnsavedChanges || saving}
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "view" ? (
          <div className="h-full flex">
            {/* Flow Visualization */}
            <div className="flex-1">
              {flowVizData && <FlowVisualization data={flowVizData} />}
            </div>

            {/* Sidebar with Flow Info */}
            <div className="w-80 border-l bg-muted/30 p-6 overflow-y-auto">
              <div className="space-y-6">
                {/* Basic Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Flow Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <BarChart className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Version:</span>
                      <span className="font-medium">{flow.version}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Play className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Usage:</span>
                      <span className="font-medium">
                        {flow.usageCount} times
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Updated:</span>
                      <span className="font-medium">
                        {formatDate(flow.updatedAt)}
                      </span>
                    </div>
                    {flow.createdByUser && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Created by:
                        </span>
                        <span className="font-medium">
                          {flow.createdByUser.name}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Categories */}
                {flow.categories.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Categories</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {flow.categories.map((category) => (
                          <Badge
                            key={category.id}
                            variant="outline"
                            style={{ borderColor: category.color || undefined }}
                          >
                            {category.name}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Flow Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Flow Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">States:</span>
                      <span className="font-medium">
                        {Object.keys(flow.definition.states).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Intents:</span>
                      <span className="font-medium">
                        {Object.keys(flow.definition.intents).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tools:</span>
                      <span className="font-medium">
                        {Object.keys(flow.definition.tools).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Start State:
                      </span>
                      <span className="font-medium">
                        {flow.definition.start}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          /* Edit Mode */
          <FSMFlowEditor
            initialFlow={{
              name: flow.name,
              description: flow.description || "",
              definition: flow.definition,
            }}
            onSave={handleSaveFlow}
            onTest={handleTestFlow}
          />
        )}
      </div>
    </div>
  );
}
