import { useSearchParams } from "react-router";
import type { Route } from "./+types/chat";
import { SimpleChatInterface } from "../components/chat/SimpleChatInterface";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

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
            <h1 className="text-xl font-semibold">Chat Interface</h1>
            {sessionId && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Session: {sessionId.substring(0, 8)}...
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              to={sessionId ? `/flow-info?session=${sessionId}` : "/flow-info"}
            >
              View Flow
            </Link>
          </Button>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 p-4">
        <SimpleChatInterface sessionId={sessionId || undefined} />
      </div>
    </div>
  );
}
