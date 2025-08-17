import React from "react";
import { FlowManager } from "../components/flow/FlowManager";
import { Database } from "lucide-react";

export default function FlowManagerPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Database className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Flow Database</h1>
          <p className="text-muted-foreground">
            Manage and edit your conversation flows
          </p>
        </div>
      </div>

      <FlowManager />
    </div>
  );
}
