import { useSearchParams } from "react-router";
import type { Route } from "./+types/flow-info";
import { FlowVisualization } from "../components/flow/FlowVisualization";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Flow Visualization - EventBus FSM" },
    {
      name: "description",
      content: "Real-time flow visualization for EventBus FSM state machines",
    },
  ];
}

export default function FlowInfoPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");

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
          <div>
            <h1 className="text-xl font-semibold">Flow Visualization</h1>
            {sessionId && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Session: {sessionId.substring(0, 8)}...
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={sessionId ? `/chat?session=${sessionId}` : "/chat"}>
              Open Chat
            </Link>
          </Button>
        </div>
      </div>

      {/* Flow Visualization */}
      <div className="flex-1">
        <FlowVisualization sessionId={sessionId || undefined} />
      </div>
    </div>
  );
}
