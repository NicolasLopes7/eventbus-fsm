import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useChat } from "../../hooks/useChat";
import type { ChatMessage } from "../../lib/types";
import { SendHorizontal } from "lucide-react";

interface SimpleChatInterfaceProps {
  sessionId?: string;
  onSessionCreate?: (sessionId: string) => void;
}

export function SimpleChatInterface({
  sessionId,
  onSessionCreate,
}: SimpleChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    context,
    currentSessionId,
    isConnected,
    sendMessage,
    startNewSession,
    isCreatingSession,
    isSendingMessage,
  } = useChat({ sessionId, onSessionCreate });

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      // Scroll the container to the bottom directly
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const handleSendMessage = () => {
    const text = inputValue.trim();
    if (!text || !isConnected) return;

    sendMessage(text);
    setInputValue("");
  };

  const handleInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={messagesContainerRef}
          className="h-full p-4 overflow-y-auto scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 dark:scrollbar-track-gray-800 dark:scrollbar-thumb-gray-600"
        >
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  💬 <strong>Start a conversation:</strong>
                  <br />
                  • Try: "I want to make a reservation"
                  <br />
                  • Say: "Table for 4 people"
                  <br />• Watch the live flow visualization on the right →
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {Object.keys(context).length > 0 && (
              <ContextDisplay context={context} />
            )}
          </div>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleInputKeyPress}
            placeholder={isConnected ? "Type your message..." : "Connecting..."}
            disabled={!isConnected || isSendingMessage}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!isConnected || !inputValue.trim() || isSendingMessage}
            size="sm"
            className="px-3"
          >
            <SendHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Simple message formatter for basic markdown-like formatting
function formatMessage(content: string) {
  return content.split("\n").map((line, index) => {
    // Handle bullet points
    if (line.startsWith("• ")) {
      return (
        <div key={index} className="flex items-start gap-2 my-1">
          <span className="text-blue-500 font-bold">•</span>
          <span>{line.substring(2)}</span>
        </div>
      );
    }

    // Handle bold text **text**
    const boldFormatted = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Handle empty lines
    if (line.trim() === "") {
      return <br key={index} />;
    }

    // Regular line
    return (
      <div key={index} dangerouslySetInnerHTML={{ __html: boldFormatted }} />
    );
  });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.type === "user";
  const isSystem = message.type === "system";
  const isError = message.type === "error";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`
          max-w-[70%] rounded-lg px-4 py-2 break-words
          ${
            isUser
              ? "bg-blue-600 text-white"
              : isSystem
              ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-l-4 border-blue-500 font-mono text-sm"
              : isError
              ? "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
              : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
          }
        `}
      >
        <div className="leading-relaxed">{formatMessage(message.content)}</div>
        <p
          className={`text-xs mt-2 opacity-70 ${
            isUser ? "text-blue-100" : "text-gray-500"
          }`}
        >
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

function ContextDisplay({ context }: { context: Record<string, any> }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
      <div className="text-blue-800 dark:text-blue-200 font-semibold text-sm mb-2">
        📝 Current Context:
      </div>
      <pre className="text-xs text-blue-700 dark:text-blue-300 overflow-x-auto">
        {JSON.stringify(context, null, 2)}
      </pre>
    </div>
  );
}
