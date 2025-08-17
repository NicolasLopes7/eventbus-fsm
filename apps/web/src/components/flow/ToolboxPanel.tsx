import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { X, Plus, MessageSquare, Wrench, Phone, Play } from "lucide-react";

interface ToolboxPanelProps {
  onAddState: (type: "normal" | "tool" | "terminal") => void;
  onClose: () => void;
}

export function ToolboxPanel({ onAddState, onClose }: ToolboxPanelProps) {
  const stateTypes = [
    {
      type: "normal" as const,
      label: "Normal State",
      description: "Standard conversation state with ask/say actions",
      icon: <MessageSquare className="w-5 h-5" />,
      color: "from-gray-400 to-gray-600",
      textColor: "text-white",
    },
    {
      type: "tool" as const,
      label: "Tool State",
      description: "Executes external tools and processes results",
      icon: <Wrench className="w-5 h-5" />,
      color: "from-blue-400 to-blue-600",
      textColor: "text-white",
    },
    {
      type: "terminal" as const,
      label: "Terminal State",
      description: "End state that terminates the conversation",
      icon: <Phone className="w-5 h-5" />,
      color: "from-red-400 to-red-600",
      textColor: "text-white",
    },
  ];

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Toolbox
        </h2>
        <Button onClick={onClose} variant="ghost" size="sm">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            State Types
          </h3>
          <div className="space-y-2">
            {stateTypes.map((stateType) => (
              <Card
                key={stateType.type}
                className="p-3 cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => onAddState(stateType.type)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`
                    p-2 rounded-lg bg-gradient-to-r ${stateType.color} ${stateType.textColor}
                    group-hover:scale-105 transition-transform
                  `}
                  >
                    {stateType.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {stateType.label}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      {stateType.description}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    Click to add
                  </span>
                  <Plus className="w-3 h-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => onAddState("normal")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Normal State
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => onAddState("tool")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tool State
            </Button>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Tips
          </h3>
          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
              💡 <strong>Drag</strong> states around to organize your flow
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800">
              🔗 <strong>Connect</strong> states by dragging from output to
              input handles
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded border border-purple-200 dark:border-purple-800">
              ⚙️ <strong>Select</strong> states or edges to edit their
              properties
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
