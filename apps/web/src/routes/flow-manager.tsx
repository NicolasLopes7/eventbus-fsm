import React, { useState } from "react";
import { FlowManager } from "../components/flow/FlowManager";
import { FSMFlowEditor } from "../components/flow/FSMFlowEditor";
import { Flow, FlowConfig } from "../lib/types";
import { apiClient } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { ArrowLeft, Database, Save, Play } from "lucide-react";
import { toast } from "sonner";

export default function FlowManagerPage() {
  const [currentView, setCurrentView] = useState<"manager" | "editor">(
    "manager"
  );
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleSelectFlow = (flow: Flow) => {
    setSelectedFlow(flow);
    setCurrentView("editor");
  };

  const handleEditFlow = (flow: Flow) => {
    setSelectedFlow(flow);
    setCurrentView("editor");
  };

  const handleBackToManager = () => {
    if (hasUnsavedChanges) {
      if (
        !confirm("You have unsaved changes. Are you sure you want to go back?")
      ) {
        return;
      }
    }
    setCurrentView("manager");
    setSelectedFlow(null);
    setHasUnsavedChanges(false);
  };

  const handleSaveFlow = async (flowDefinition: FlowConfig) => {
    if (!selectedFlow) {
      toast.error("No flow selected");
      return;
    }

    try {
      await apiClient.updateFlow(selectedFlow.id, {
        definition: flowDefinition,
      });

      setHasUnsavedChanges(false);
      toast.success("Flow saved successfully!");
    } catch (error) {
      console.error("Failed to save flow:", error);
      toast.error("Failed to save flow");
    }
  };

  const handleTestFlow = async (flowDefinition: FlowConfig) => {
    try {
      // Create a test session with the current flow definition
      const response = await apiClient.createSession(flowDefinition);
      toast.success("Test session created! Check the chat interface.");

      // You could also open a new window or redirect to the chat
      // window.open(`/chat?session=${response.session_id}`, '_blank');
    } catch (error) {
      console.error("Failed to test flow:", error);
      toast.error("Failed to create test session");
    }
  };

  if (currentView === "manager") {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Database className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Flow Database</h1>
            <p className="text-muted-foreground">
              Manage and edit your conversation flows
            </p>
          </div>
        </div>

        <FlowManager
          onSelectFlow={handleSelectFlow}
          onEditFlow={handleEditFlow}
        />
      </div>
    );
  }

  if (currentView === "editor" && selectedFlow) {
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
                  onClick={handleBackToManager}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Manager
                </Button>
                <div className="h-6 w-px bg-border" />
                <div>
                  <h1 className="text-xl font-semibold">{selectedFlow.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {selectedFlow.description || "No description"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {hasUnsavedChanges && (
                  <span className="text-sm text-orange-600 dark:text-orange-400">
                    Unsaved changes
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestFlow(selectedFlow.definition)}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Test Flow
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSaveFlow(selectedFlow.definition)}
                  className="flex items-center gap-2"
                  disabled={!hasUnsavedChanges}
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1">
          <FSMFlowEditor
            initialFlow={{
              name: selectedFlow.name,
              description: selectedFlow.description || "",
              definition: selectedFlow.definition,
            }}
            onSave={handleSaveFlow}
            onTest={handleTestFlow}
          />
        </div>
      </div>
    );
  }

  return null;
}
