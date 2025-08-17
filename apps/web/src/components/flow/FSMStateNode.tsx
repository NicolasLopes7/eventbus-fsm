import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Play,
  MessageSquare,
  Wrench,
  Phone,
  CheckCircle,
  AlertCircle,
  Settings,
} from "lucide-react";

export const FSMStateNode = memo((props: NodeProps) => {
  const { data, selected } = props;

  // Safely access data properties
  const nodeData = data as any;
  const stateName = nodeData?.name || "Unnamed State";
  const stateType = nodeData?.type || "normal";
  const onEnter = nodeData?.onEnter || [];
  const transitions = nodeData?.transitions || [];

  const getStateIcon = () => {
    switch (stateType) {
      case "initial":
        return <Play className="w-4 h-4" />;
      case "tool":
        return <Wrench className="w-4 h-4" />;
      case "terminal":
        return <Phone className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getStateColor = () => {
    switch (stateType) {
      case "initial":
        return "from-green-400 to-green-600 text-white border-green-500";
      case "tool":
        return "from-blue-400 to-blue-600 text-white border-blue-500";
      case "terminal":
        return "from-red-400 to-red-600 text-white border-red-500";
      default:
        return "from-gray-100 to-gray-200 text-gray-800 border-gray-300 dark:from-gray-700 dark:to-gray-800 dark:text-gray-100 dark:border-gray-600";
    }
  };

  const getActionSummary = () => {
    if (onEnter.length === 0) return "No actions";

    const action = onEnter[0];
    if (action?.say)
      return `💬 "${action.say.substring(0, 30)}${
        action.say.length > 30 ? "..." : ""
      }"`;
    if (action?.ask)
      return `❓ "${action.ask.substring(0, 30)}${
        action.ask.length > 30 ? "..." : ""
      }"`;
    if (action?.tool) return `🔧 ${action.tool}`;
    if (action?.transfer) return `📞 ${action.transfer}`;
    if (action?.hangup) return `📴 Hangup`;
    return "Unknown action";
  };

  const transitionCount = transitions.length;

  return (
    <div
      className={`
      relative min-w-[180px] max-w-[250px] rounded-lg border-2 shadow-lg
      bg-gradient-to-br ${getStateColor()}
      ${selected ? "ring-4 ring-blue-300 ring-opacity-50" : ""}
      hover:shadow-xl transition-all duration-200
    `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* Node Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className={`
            p-1.5 rounded-full ${
              stateType === "initial" ||
              stateType === "tool" ||
              stateType === "terminal"
                ? "bg-white/20"
                : "bg-blue-100 dark:bg-blue-900"
            }
          `}
          >
            {getStateIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{stateName}</h3>
            <div className="text-xs opacity-75 capitalize">
              {stateType} State
            </div>
          </div>
        </div>

        {/* Action Preview */}
        <div
          className={`
          text-xs p-2 rounded mb-3 font-mono
          ${
            stateType === "initial" ||
            stateType === "tool" ||
            stateType === "terminal"
              ? "bg-white/10 text-white/90"
              : "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300"
          }
        `}
        >
          {getActionSummary()}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Settings className="w-3 h-3" />
            <span>
              {onEnter.length} action{onEnter.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>
              {transitionCount} transition{transitionCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Error indicator */}
        {transitionCount === 0 && stateType !== "terminal" && (
          <div className="flex items-center gap-1 mt-2 text-yellow-200 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>No transitions</span>
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* State Type Badge */}
      <div
        className={`
        absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 border-white
        flex items-center justify-center text-xs font-bold
        ${
          stateType === "initial"
            ? "bg-green-500 text-white"
            : stateType === "tool"
            ? "bg-blue-500 text-white"
            : stateType === "terminal"
            ? "bg-red-500 text-white"
            : "bg-gray-500 text-white"
        }
      `}
      >
        {stateType === "initial"
          ? "S"
          : stateType === "tool"
          ? "T"
          : stateType === "terminal"
          ? "E"
          : "N"}
      </div>
    </div>
  );
});
