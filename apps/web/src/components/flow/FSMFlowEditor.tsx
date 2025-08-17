import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  MiniMap,
  Panel,
  type NodeTypes,
  type EdgeTypes,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Play,
  Plus,
  Save,
  Download,
  Upload,
  Trash2,
  Settings,
  Zap,
  GitBranch,
  MessageSquare,
  Phone,
  Wrench,
  Eye,
  Copy,
} from "lucide-react";
import { FSMStateNode } from "./FSMStateNode";
import { FSMEdge } from "./FSMEdge";
import { StatePropertiesPanel } from "./StatePropertiesPanel";
import { TransitionPropertiesPanel } from "./TransitionPropertiesPanel";
import { ToolboxPanel } from "./ToolboxPanel";
import { apiClient } from "../../lib/api-client";

// Custom node and edge types
const nodeTypes = {
  fsmState: FSMStateNode,
};

const edgeTypes = {
  fsmTransition: FSMEdge,
};

export interface FSMState {
  id: string;
  name: string;
  type: "initial" | "normal" | "tool" | "terminal";
  onEnter: Array<{
    say?: string;
    ask?: string;
    tool?: string;
    transfer?: string;
    hangup?: boolean;
  }>;
  transitions: Array<{
    id: string;
    onIntent?: string | string[];
    onToolResult?: string;
    to?: string;
    branch?: Array<{
      condition: string;
      to: string;
    }>;
  }>;
  position: { x: number; y: number };
}

export interface FSMFlow {
  name: string;
  description: string;
  startState: string;
  states: FSMState[];
}

interface FSMFlowEditorProps {
  initialFlow?: FSMFlow;
  onSave?: (flow: FSMFlow) => void;
  onTest?: (flow: FSMFlow) => void;
}

function FSMFlowEditorContent({
  initialFlow,
  onSave,
  onTest,
}: FSMFlowEditorProps) {
  const reactFlowInstance = useReactFlow();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [showToolbox, setShowToolbox] = useState(true);
  const [flowName, setFlowName] = useState(initialFlow?.name || "New Flow");
  const [flowDescription, setFlowDescription] = useState(
    initialFlow?.description || ""
  );
  const [isLoading, setIsLoading] = useState(true);
  const [flowData, setFlowData] = useState<any>(null);

  // Fetch flow data from API
  useEffect(() => {
    const fetchFlowData = async () => {
      if (initialFlow) {
        setFlowData(initialFlow);
        setFlowName(initialFlow.name);
        setFlowDescription(initialFlow.description);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await apiClient.getFlowInfo();
        console.log("📊 Fetched flow data:", response);

        setFlowData(response);
        setFlowName(response.meta?.name || "Current Flow");
        setFlowDescription("Flow loaded from server");
      } catch (error) {
        console.error("Failed to fetch flow data:", error);
        // Fall back to a simple default
        setFlowData({
          states: [
            {
              id: "initial",
              name: "InitialGreeting",
              type: "initial",
              onEnter: [{ say: "Welcome! How can I help you today?" }],
              transitions: [],
              position: { x: 250, y: 100 },
            },
          ],
          start: "initial",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlowData();
  }, [initialFlow]);

  // Convert FSM states to React Flow nodes with smart positioning
  const initialNodes: Node[] = useMemo(() => {
    if (!flowData?.states) {
      return [];
    }

    // Build a flow graph to understand connections
    const stateGraph = new Map<string, string[]>();
    const incomingConnections = new Map<string, number>();

    // Initialize all states
    flowData.states.forEach((state: any) => {
      stateGraph.set(state.name, []);
      incomingConnections.set(state.name, 0);
    });

    // Build connections
    flowData.states.forEach((state: any) => {
      if (state.transitions) {
        state.transitions.forEach((transition: any) => {
          if (transition.to) {
            stateGraph.get(state.name)?.push(transition.to);
            incomingConnections.set(
              transition.to,
              (incomingConnections.get(transition.to) || 0) + 1
            );
          }
          // Handle branch transitions
          if (transition.branch) {
            transition.branch.forEach((branch: any) => {
              if (branch.to) {
                stateGraph.get(state.name)?.push(branch.to);
                incomingConnections.set(
                  branch.to,
                  (incomingConnections.get(branch.to) || 0) + 1
                );
              }
            });
          }
        });
      }
    });

    // Create a topological sort for better layout
    const positioned = new Set<string>();
    const positions = new Map<string, { x: number; y: number }>();

    // Start with the initial state
    let currentLevel = 0;
    let levelWidth = 0;
    const levelStates: string[][] = [];

    const queue = [flowData.start];
    positioned.add(flowData.start);
    positions.set(flowData.start, { x: 400, y: 100 });

    // Position states level by level
    while (queue.length > 0) {
      const currentLevelStates: string[] = [];
      const nextQueue: string[] = [];

      // Process current level
      queue.forEach((stateName) => {
        currentLevelStates.push(stateName);
        const connections = stateGraph.get(stateName) || [];
        connections.forEach((nextState) => {
          if (!positioned.has(nextState)) {
            positioned.add(nextState);
            nextQueue.push(nextState);
          }
        });
      });

      levelStates.push(currentLevelStates);
      currentLevel++;
      queue.length = 0;
      queue.push(...nextQueue);
    }

    // Position remaining unconnected states (like terminal states)
    const unpositioned = flowData.states.filter(
      (state: any) => !positioned.has(state.name)
    );
    if (unpositioned.length > 0) {
      levelStates.push(unpositioned.map((state: any) => state.name));
    }

    // Calculate positions for each level
    levelStates.forEach((states, level) => {
      const y = 100 + level * 200;
      const totalWidth = states.length * 300;
      const startX = 400 - totalWidth / 2 + 150;

      states.forEach((stateName, index) => {
        if (!positions.has(stateName)) {
          positions.set(stateName, {
            x: startX + index * 300,
            y: y,
          });
        }
      });
    });

    return flowData.states.map((state: any) => {
      // Determine state type based on flow structure
      let stateType = "normal";
      if (state.name === flowData.start) {
        stateType = "initial";
      } else if (state.onEnter?.some((action: any) => action.tool)) {
        stateType = "tool";
      } else if (
        state.onEnter?.some((action: any) => action.hangup || action.transfer)
      ) {
        stateType = "terminal";
      }

      const position = positions.get(state.name) || { x: 400, y: 100 };

      return {
        id: state.name,
        type: "fsmState",
        position,
        data: {
          name: state.name,
          type: stateType,
          onEnter: state.onEnter || [],
          transitions: state.transitions || [],
        },
      };
    });
  }, [flowData]);

  // Convert FSM transitions to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    if (!flowData?.states) return [];

    const edges: Edge[] = [];
    flowData.states.forEach((state: any) => {
      const stateId = state.name;
      if (state.transitions) {
        state.transitions.forEach((transition: any, index: number) => {
          // Handle direct transitions
          if (transition.to) {
            edges.push({
              id: `${stateId}-to-${transition.to}-${index}`,
              type: "fsmTransition",
              source: stateId,
              target: transition.to,
              data: {
                onIntent: transition.onIntent,
                onToolResult: transition.onToolResult,
                branch: transition.branch,
              },
            });
          }

          // Handle branch transitions (like party size > 8 → TransferToManager)
          if (transition.branch) {
            transition.branch.forEach((branch: any, branchIndex: number) => {
              if (branch.to) {
                edges.push({
                  id: `${stateId}-branch-${branch.to}-${index}-${branchIndex}`,
                  type: "fsmTransition",
                  source: stateId,
                  target: branch.to,
                  data: {
                    onIntent: transition.onIntent,
                    condition: branch.when,
                    branch: true,
                  },
                });
              }
            });
          }
        });
      }
    });

    return edges;
  }, [flowData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when flow data changes
  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
    }
  }, [initialNodes, setNodes]);

  useEffect(() => {
    if (initialEdges.length > 0) {
      setEdges(initialEdges);
    }
  }, [initialEdges, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: "source" in params ? params.source : "",
        target: "target" in params ? params.target : "",
        type: "fsmTransition",
        data: {
          onIntent: "user_input",
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
      setSelectedEdge(null);

      // Auto-open toolbox if not already open
      if (!showToolbox) {
        setShowToolbox(true);
      }
    },
    [showToolbox]
  );

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  // Add new state
  const addNewState = useCallback(
    (type: "normal" | "tool" | "terminal" = "normal") => {
      const position = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const newNode: Node = {
        id: `state-${Date.now()}`,
        type: "fsmState",
        position,
        data: {
          name: `NewState${nodes.length + 1}`,
          type,
          onEnter:
            type === "tool"
              ? [{ tool: "example_tool" }]
              : [{ ask: "What would you like to do?" }],
          transitions: [],
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance, nodes.length, setNodes]
  );

  // Delete selected node or edge
  const deleteSelected = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) =>
        eds.filter(
          (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
        )
      );
      setSelectedNode(null);
    } else if (selectedEdge) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
      setSelectedEdge(null);
    }
  }, [selectedNode, selectedEdge, setNodes, setEdges]);

  // Save flow
  const saveFlow = useCallback(() => {
    const flow: FSMFlow = {
      name: flowName,
      description: flowDescription,
      startState:
        nodes.find((n) => (n.data as any)?.type === "initial")?.id ||
        nodes[0]?.id ||
        "",
      states: nodes.map((node) => {
        const nodeData = node.data as any;
        return {
          id: node.id,
          name: nodeData?.name || "Unnamed",
          type: nodeData?.type || "normal",
          onEnter: nodeData?.onEnter || [],
          transitions: edges
            .filter((edge) => edge.source === node.id)
            .map((edge) => {
              const edgeData = edge.data as any;
              return {
                id: edge.id,
                onIntent: edgeData?.onIntent,
                onToolResult: edgeData?.onToolResult,
                to: edge.target,
                branch: edgeData?.branch,
              };
            }),
          position: node.position,
        };
      }),
    };

    onSave?.(flow);
  }, [flowName, flowDescription, nodes, edges, onSave]);

  // Test flow
  const testFlow = useCallback(() => {
    const flow: FSMFlow = {
      name: flowName,
      description: flowDescription,
      startState:
        nodes.find((n) => (n.data as any)?.type === "initial")?.id ||
        nodes[0]?.id ||
        "",
      states: nodes.map((node) => {
        const nodeData = node.data as any;
        return {
          id: node.id,
          name: nodeData?.name || "Unnamed",
          type: nodeData?.type || "normal",
          onEnter: nodeData?.onEnter || [],
          transitions: edges
            .filter((edge) => edge.source === node.id)
            .map((edge) => {
              const edgeData = edge.data as any;
              return {
                id: edge.id,
                onIntent: edgeData?.onIntent,
                onToolResult: edgeData?.onToolResult,
                to: edge.target,
                branch: edgeData?.branch,
              };
            }),
          position: node.position,
        };
      }),
    };

    onTest?.(flow);
  }, [flowName, flowDescription, nodes, edges, onTest]);

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading flow data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Top Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                FSM Flow Editor
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                className="w-48"
                placeholder="Flow name"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowToolbox(!showToolbox)}
              variant="outline"
              size="sm"
            >
              <Settings className="w-4 h-4 mr-2" />
              Toolbox
            </Button>
            <Button
              onClick={deleteSelected}
              variant="outline"
              size="sm"
              disabled={!selectedNode && !selectedEdge}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button onClick={saveFlow} variant="outline" size="sm">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button onClick={testFlow} size="sm">
              <Play className="w-4 h-4 mr-2" />
              Test Flow
            </Button>
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex">
        {/* Toolbox Panel */}
        {showToolbox && (
          <ToolboxPanel
            onAddState={addNewState}
            onClose={() => setShowToolbox(false)}
          />
        )}

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            minZoom={0.1}
            maxZoom={2}
            attributionPosition="bottom-left"
          >
            <Background gap={20} size={2} />
            <Controls position="bottom-right" />
            <MiniMap
              position="top-right"
              nodeStrokeColor="#374151"
              nodeColor="#f9fafb"
              nodeBorderRadius={8}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
          </ReactFlow>
        </div>

        {/* Properties Panel */}
        {(selectedNode || selectedEdge) && (
          <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
            {selectedNode && (
              <StatePropertiesPanel
                node={selectedNode}
                onUpdate={(updates) => {
                  setNodes((nds) =>
                    nds.map((n) =>
                      n.id === selectedNode.id
                        ? { ...n, data: { ...n.data, ...updates } }
                        : n
                    )
                  );
                }}
                onClose={() => setSelectedNode(null)}
              />
            )}
            {selectedEdge && (
              <TransitionPropertiesPanel
                edge={selectedEdge}
                onUpdate={(updates) => {
                  setEdges((eds) =>
                    eds.map((e) =>
                      e.id === selectedEdge.id
                        ? { ...e, data: { ...e.data, ...updates } }
                        : e
                    )
                  );
                }}
                onClose={() => setSelectedEdge(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function FSMFlowEditor(props: FSMFlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FSMFlowEditorContent {...props} />
    </ReactFlowProvider>
  );
}
