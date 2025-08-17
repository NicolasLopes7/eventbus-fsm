import React from "react";
import {
  type EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
} from "@xyflow/react";
import { GitBranch, MessageCircle, Wrench } from "lucide-react";

export function FSMEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Safely access data properties
  const edgeData = data as any;

  const getTransitionLabel = () => {
    // Handle branch conditions (like party size > 8)
    if (edgeData?.condition) {
      const condition = edgeData.condition.replace(/{{ctx\.(\w+)}}/g, "$1");
      return condition.length > 20
        ? `${condition.substring(0, 20)}...`
        : condition;
    }
    if (edgeData?.onIntent) {
      const intents = Array.isArray(edgeData.onIntent)
        ? edgeData.onIntent
        : [edgeData.onIntent];
      return intents.join(", ");
    }
    if (edgeData?.onToolResult) {
      return `Tool: ${edgeData.onToolResult}`;
    }
    if (edgeData?.branch && !edgeData?.condition) {
      return `Branch (${edgeData.branch.length} conditions)`;
    }
    return "Transition";
  };

  const getTransitionIcon = () => {
    if (edgeData?.condition || edgeData?.branch) {
      return <GitBranch className="w-3 h-3" />;
    }
    if (edgeData?.onIntent) {
      return <MessageCircle className="w-3 h-3" />;
    }
    if (edgeData?.onToolResult) {
      return <Wrench className="w-3 h-3" />;
    }
    return null;
  };

  const getEdgeColor = () => {
    if (edgeData?.condition || edgeData?.branch) return "#8B5CF6"; // Purple for branches/conditions
    if (edgeData?.onToolResult) return "#3B82F6"; // Blue for tool results
    return "#6B7280"; // Gray for intents
  };

  return (
    <>
      <path
        id={id as string}
        className="react-flow__edge-path"
        d={edgePath}
        stroke={selected ? "#F59E0B" : getEdgeColor()}
        strokeWidth={selected ? 3 : 2}
        fill="none"
        markerEnd="url(#react-flow__arrowclosed)"
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className={`
            flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
            border shadow-sm cursor-pointer transition-all
            ${
              selected
                ? "bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-100"
                : "bg-white border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
            }
            hover:shadow-md hover:scale-105
          `}
        >
          {getTransitionIcon()}
          <span className="max-w-[120px] truncate">{getTransitionLabel()}</span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
