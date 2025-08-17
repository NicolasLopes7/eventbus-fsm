import React, { useState, useEffect } from "react";
import { type Node } from "@xyflow/react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  X,
  Plus,
  Trash2,
  MessageSquare,
  HelpCircle,
  Wrench,
  Phone,
  Settings,
  Copy,
} from "lucide-react";

interface StatePropertiesPanelProps {
  node: Node;
  onUpdate: (updates: Partial<Node["data"]>) => void;
  onClose: () => void;
}

interface Action {
  say?: string;
  ask?: string;
  tool?: string;
  transfer?: string;
  hangup?: boolean;
}

export function StatePropertiesPanel({
  node,
  onUpdate,
  onClose,
}: StatePropertiesPanelProps) {
  const nodeData = node.data as any;
  const [name, setName] = useState(nodeData?.name || "");
  const [type, setType] = useState(nodeData?.type || "normal");
  const [actions, setActions] = useState<Action[]>(nodeData?.onEnter || []);
  const [activeTab, setActiveTab] = useState<
    "properties" | "actions" | "transitions"
  >("properties");

  useEffect(() => {
    const data = node.data as any;
    setName(data?.name || "");
    setType(data?.type || "normal");
    setActions(data?.onEnter || []);

    // Auto-select tab based on node type
    if (data?.type === "tool") {
      setActiveTab("actions");
    } else if (data?.transitions && data.transitions.length > 0) {
      setActiveTab("transitions");
    } else {
      setActiveTab("properties");
    }
  }, [node]);

  const handleUpdate = () => {
    onUpdate({
      name,
      type,
      onEnter: actions,
    });
  };

  const addAction = (
    actionType: "say" | "ask" | "tool" | "transfer" | "hangup"
  ) => {
    const newAction: Action = {};
    switch (actionType) {
      case "say":
        newAction.say = "Hello!";
        break;
      case "ask":
        newAction.ask = "What can I help you with?";
        break;
      case "tool":
        newAction.tool = "example_tool";
        break;
      case "transfer":
        newAction.transfer = "human_agent";
        break;
      case "hangup":
        newAction.hangup = true;
        break;
    }
    setActions([...actions, newAction]);
  };

  const updateAction = (index: number, updates: Partial<Action>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    setActions(newActions);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const getActionIcon = (action: Action) => {
    if (action.say) return <MessageSquare className="w-4 h-4" />;
    if (action.ask) return <HelpCircle className="w-4 h-4" />;
    if (action.tool) return <Wrench className="w-4 h-4" />;
    if (action.transfer) return <Phone className="w-4 h-4" />;
    if (action.hangup) return <Phone className="w-4 h-4" />;
    return <Settings className="w-4 h-4" />;
  };

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      <div className="sticky top-0 bg-white dark:bg-gray-800 pb-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            State Properties
          </h2>
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("properties")}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === "properties"
                ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            Properties
          </button>
          <button
            onClick={() => setActiveTab("actions")}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === "actions"
                ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            Actions ({actions.length})
          </button>
          <button
            onClick={() => setActiveTab("transitions")}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === "transitions"
                ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            Transitions ({nodeData?.transitions?.length || 0})
          </button>
        </div>
      </div>

      {/* Properties Tab */}
      {activeTab === "properties" && (
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Basic Properties
          </h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="state-name">State Name</Label>
              <Input
                id="state-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleUpdate}
                placeholder="Enter state name"
              />
            </div>
            <div>
              <Label htmlFor="state-type">State Type</Label>
              <select
                id="state-type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setTimeout(handleUpdate, 0);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="initial">Initial</option>
                <option value="normal">Normal</option>
                <option value="tool">Tool</option>
                <option value="terminal">Terminal</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Actions Tab */}
      {activeTab === "actions" && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Actions on Enter
            </h3>
            <div className="flex gap-1">
              <Button
                onClick={() => addAction("say")}
                size="sm"
                variant="outline"
                title="Add Say Action"
              >
                <MessageSquare className="w-3 h-3" />
              </Button>
              <Button
                onClick={() => addAction("ask")}
                size="sm"
                variant="outline"
                title="Add Ask Action"
              >
                <HelpCircle className="w-3 h-3" />
              </Button>
              <Button
                onClick={() => addAction("tool")}
                size="sm"
                variant="outline"
                title="Add Tool Action"
              >
                <Wrench className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {actions.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                No actions defined. Click the buttons above to add actions.
              </div>
            ) : (
              actions.map((action, index) => (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getActionIcon(action)}
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {action.say
                          ? "Say"
                          : action.ask
                          ? "Ask"
                          : action.tool
                          ? "Tool"
                          : action.transfer
                          ? "Transfer"
                          : action.hangup
                          ? "Hangup"
                          : "Unknown"}
                      </span>
                    </div>
                    <Button
                      onClick={() => removeAction(index)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {action.say !== undefined && (
                    <Textarea
                      value={action.say}
                      onChange={(e) =>
                        updateAction(index, { say: e.target.value })
                      }
                      onBlur={handleUpdate}
                      placeholder="Enter message to say"
                      className="text-sm"
                      rows={2}
                    />
                  )}

                  {action.ask !== undefined && (
                    <Textarea
                      value={action.ask}
                      onChange={(e) =>
                        updateAction(index, { ask: e.target.value })
                      }
                      onBlur={handleUpdate}
                      placeholder="Enter question to ask"
                      className="text-sm"
                      rows={2}
                    />
                  )}

                  {action.tool !== undefined && (
                    <Input
                      value={action.tool}
                      onChange={(e) =>
                        updateAction(index, { tool: e.target.value })
                      }
                      onBlur={handleUpdate}
                      placeholder="Enter tool name"
                      className="text-sm"
                    />
                  )}

                  {action.transfer !== undefined && (
                    <Input
                      value={action.transfer}
                      onChange={(e) =>
                        updateAction(index, { transfer: e.target.value })
                      }
                      onBlur={handleUpdate}
                      placeholder="Enter transfer destination"
                      className="text-sm"
                    />
                  )}

                  {action.hangup !== undefined && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      This action will terminate the conversation.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Transitions Tab */}
      {activeTab === "transitions" && (
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Transitions
          </h3>
          <div className="space-y-3">
            {nodeData?.transitions && nodeData.transitions.length > 0 ? (
              nodeData.transitions.map((transition: any, index: number) => (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-3"
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Transition {index + 1}
                  </div>
                  {transition.onIntent && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <strong>Intent:</strong>{" "}
                      {Array.isArray(transition.onIntent)
                        ? transition.onIntent.join(", ")
                        : transition.onIntent}
                    </div>
                  )}
                  {transition.onToolResult && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <strong>Tool Result:</strong> {transition.onToolResult}
                    </div>
                  )}
                  {transition.to && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <strong>Target:</strong> {transition.to}
                    </div>
                  )}
                  {transition.branch && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      <strong>Branches:</strong>
                      {transition.branch.map(
                        (branch: any, branchIndex: number) => (
                          <div key={branchIndex} className="ml-2 mt-1">
                            • {branch.when} → {branch.to}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                No transitions defined for this state.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* State Information */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Information
        </h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>State ID:</span>
            <span className="font-mono text-xs">{node.id}</span>
          </div>
          <div className="flex justify-between">
            <span>Position:</span>
            <span className="font-mono text-xs">
              ({Math.round(node.position.x)}, {Math.round(node.position.y)})
            </span>
          </div>
          <div className="flex justify-between">
            <span>Actions:</span>
            <span>{actions.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Transitions:</span>
            <span>{nodeData?.transitions?.length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Is Current:</span>
            <span>{nodeData?.isCurrent ? "Yes" : "No"}</span>
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
              navigator.clipboard.writeText(node.id);
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
