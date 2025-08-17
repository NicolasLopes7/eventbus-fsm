import React, { useState, useEffect } from "react";
import { type Edge } from "@xyflow/react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  X,
  Plus,
  Trash2,
  MessageCircle,
  Wrench,
  GitBranch,
  Copy,
  ArrowRight,
} from "lucide-react";

interface TransitionPropertiesPanelProps {
  edge: Edge;
  onUpdate: (updates: Partial<Edge["data"]>) => void;
  onClose: () => void;
}

interface BranchCondition {
  condition: string;
  to: string;
}

export function TransitionPropertiesPanel({
  edge,
  onUpdate,
  onClose,
}: TransitionPropertiesPanelProps) {
  const [transitionType, setTransitionType] = useState<
    "intent" | "tool" | "branch"
  >("intent");
  const [intents, setIntents] = useState<string[]>([]);
  const [toolResult, setToolResult] = useState("");
  const [branches, setBranches] = useState<BranchCondition[]>([]);

  useEffect(() => {
    // Initialize based on existing data
    const edgeData = edge.data as any;
    if (edgeData?.onIntent) {
      setTransitionType("intent");
      const intentArray = Array.isArray(edgeData.onIntent)
        ? edgeData.onIntent
        : [edgeData.onIntent];
      setIntents(intentArray);
    } else if (edgeData?.onToolResult) {
      setTransitionType("tool");
      setToolResult(edgeData.onToolResult);
    } else if (edgeData?.branch) {
      setTransitionType("branch");
      setBranches(edgeData.branch);
    } else {
      // Default to intent
      setTransitionType("intent");
      setIntents(["user_input"]);
    }
  }, [edge]);

  const handleUpdate = () => {
    const updates: any = {};

    // Clear all fields first
    updates.onIntent = undefined;
    updates.onToolResult = undefined;
    updates.branch = undefined;

    // Set the appropriate field based on type
    switch (transitionType) {
      case "intent":
        updates.onIntent = intents.length === 1 ? intents[0] : intents;
        break;
      case "tool":
        updates.onToolResult = toolResult;
        break;
      case "branch":
        updates.branch = branches;
        break;
    }

    onUpdate(updates);
  };

  const addIntent = () => {
    setIntents([...intents, "new_intent"]);
  };

  const updateIntent = (index: number, value: string) => {
    const newIntents = [...intents];
    newIntents[index] = value;
    setIntents(newIntents);
  };

  const removeIntent = (index: number) => {
    setIntents(intents.filter((_, i) => i !== index));
  };

  const addBranch = () => {
    setBranches([...branches, { condition: 'ctx.field == "value"', to: "" }]);
  };

  const updateBranch = (index: number, updates: Partial<BranchCondition>) => {
    const newBranches = [...branches];
    newBranches[index] = { ...newBranches[index], ...updates };
    setBranches(newBranches);
  };

  const removeBranch = (index: number) => {
    setBranches(branches.filter((_, i) => i !== index));
  };

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 pb-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Transition Properties
        </h2>
        <Button onClick={onClose} variant="ghost" size="sm">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Connection Info */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Connection
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {edge.source}
          </span>
          <ArrowRight className="w-4 h-4" />
          <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {edge.target}
          </span>
        </div>
      </Card>

      {/* Transition Type */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Transition Type
        </h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              onClick={() => setTransitionType("intent")}
              variant={transitionType === "intent" ? "default" : "outline"}
              size="sm"
              className="flex-1"
            >
              <MessageCircle className="w-3 h-3 mr-1" />
              Intent
            </Button>
            <Button
              onClick={() => setTransitionType("tool")}
              variant={transitionType === "tool" ? "default" : "outline"}
              size="sm"
              className="flex-1"
            >
              <Wrench className="w-3 h-3 mr-1" />
              Tool Result
            </Button>
            <Button
              onClick={() => setTransitionType("branch")}
              variant={transitionType === "branch" ? "default" : "outline"}
              size="sm"
              className="flex-1"
            >
              <GitBranch className="w-3 h-3 mr-1" />
              Branch
            </Button>
          </div>
        </div>
      </Card>

      {/* Intent Configuration */}
      {transitionType === "intent" && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Intent Triggers
            </h3>
            <Button onClick={addIntent} size="sm" variant="outline">
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {intents.map((intent, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={intent}
                  onChange={(e) => updateIntent(index, e.target.value)}
                  onBlur={handleUpdate}
                  placeholder="Enter intent name"
                  className="flex-1"
                />
                <Button
                  onClick={() => removeIntent(index)}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {intents.length === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                No intents defined. Click "Add" to add intent triggers.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tool Result Configuration */}
      {transitionType === "tool" && (
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Tool Result Trigger
          </h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="tool-result">Tool Result Name</Label>
              <Input
                id="tool-result"
                value={toolResult}
                onChange={(e) => setToolResult(e.target.value)}
                onBlur={handleUpdate}
                placeholder="Enter tool result name (e.g., 'success', 'failure')"
              />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              This transition will trigger when the specified tool result is
              returned.
            </div>
          </div>
        </Card>
      )}

      {/* Branch Configuration */}
      {transitionType === "branch" && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Branch Conditions
            </h3>
            <Button onClick={addBranch} size="sm" variant="outline">
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-3">
            {branches.map((branch, index) => (
              <div
                key={index}
                className="border border-gray-200 dark:border-gray-600 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Condition {index + 1}
                  </span>
                  <Button
                    onClick={() => removeBranch(index)}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label>Condition</Label>
                    <Textarea
                      value={branch.condition}
                      onChange={(e) =>
                        updateBranch(index, { condition: e.target.value })
                      }
                      onBlur={handleUpdate}
                      placeholder="ctx.field == 'value' && other_condition"
                      rows={2}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label>Target State</Label>
                    <Input
                      value={branch.to}
                      onChange={(e) =>
                        updateBranch(index, { to: e.target.value })
                      }
                      onBlur={handleUpdate}
                      placeholder="target_state_id"
                    />
                  </div>
                </div>
              </div>
            ))}
            {branches.length === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                No branch conditions defined. Click "Add" to add conditional
                logic.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Transition Information */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Information
        </h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>Edge ID:</span>
            <span className="font-mono text-xs">{edge.id}</span>
          </div>
          <div className="flex justify-between">
            <span>Source:</span>
            <span className="font-mono text-xs">{edge.source}</span>
          </div>
          <div className="flex justify-between">
            <span>Target:</span>
            <span className="font-mono text-xs">{edge.target}</span>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Quick Actions
        </h3>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              navigator.clipboard.writeText(edge.id);
            }}
            size="sm"
            variant="outline"
            className="flex-1"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy ID
          </Button>
        </div>
      </Card>
    </div>
  );
}
