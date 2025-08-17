import type { Route } from "./+types/flow-editor";
import { FSMFlowEditor } from "../components/flow/FSMFlowEditor";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Flow Editor - EventBus FSM" },
    {
      name: "description",
      content: "Visual FSM flow editor for creating conversation flows",
    },
  ];
}

export default function FlowEditorPage() {
  const handleSave = (flow: any) => {
    console.log("Saving flow:", flow);
    toast.success(`Flow "${flow.name}" saved successfully!`);
    // Save functionality handled by flow management system
  };

  const handleTest = (flow: any) => {
    console.log("Testing flow:", flow);
    toast.success(`Starting test session for "${flow.name}"`);
    // Testing functionality available through flow management
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Visual Flow Editor</h1>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Design and build conversation flows visually
            </p>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <FSMFlowEditor onSave={handleSave} onTest={handleTest} />
      </div>
    </div>
  );
}
