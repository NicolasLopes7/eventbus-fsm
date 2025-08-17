import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { apiClient } from "../../lib/api-client";
import { Flow, FlowCategory } from "../../lib/types";
import {
  Loader2,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Play,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface FlowManagerProps {
  onSelectFlow?: (flow: Flow) => void;
  onEditFlow?: (flow: Flow) => void;
}

export function FlowManager({ onSelectFlow, onEditFlow }: FlowManagerProps) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [categories, setCategories] = useState<FlowCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFlow, setNewFlow] = useState({
    name: "",
    description: "",
  });

  // Load flows and categories
  useEffect(() => {
    loadData();
  }, [searchTerm, statusFilter, categoryFilter]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Build filters
      const filters: any = {};
      if (statusFilter !== "all") filters.status = statusFilter;
      if (categoryFilter !== "all") filters.categoryId = categoryFilter;
      if (searchTerm) filters.search = searchTerm;

      const [flowsResponse, categoriesResponse] = await Promise.all([
        apiClient.getFlows(filters),
        apiClient.getFlowCategories(),
      ]);

      setFlows(flowsResponse.flows);
      setCategories(categoriesResponse.categories);
    } catch (error) {
      console.error("Failed to load flows:", error);
      toast.error("Failed to load flows");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFlow = async () => {
    if (!newFlow.name.trim()) {
      toast.error("Flow name is required");
      return;
    }

    try {
      // Create a basic flow definition
      const basicFlowDefinition = {
        meta: {
          name: newFlow.name,
          language: "en",
          voice: "alloy",
        },
        start: "InitialState",
        states: {
          InitialState: {
            onEnter: [{ say: "Welcome! This is a new flow." }],
            transitions: [],
          },
        },
        intents: {},
        tools: {},
      };

      const createdFlow = await apiClient.createFlow({
        name: newFlow.name,
        description: newFlow.description,
        definition: basicFlowDefinition,
      });

      setFlows((prev) => [createdFlow, ...prev]);
      setShowCreateForm(false);
      setNewFlow({ name: "", description: "" });
      toast.success("Flow created successfully!");

      // Optionally open the editor
      if (onEditFlow) {
        onEditFlow(createdFlow);
      }
    } catch (error) {
      console.error("Failed to create flow:", error);
      toast.error("Failed to create flow");
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm("Are you sure you want to delete this flow?")) {
      return;
    }

    try {
      await apiClient.deleteFlow(flowId);
      setFlows((prev) => prev.filter((f) => f.id !== flowId));
      toast.success("Flow deleted successfully");
    } catch (error) {
      console.error("Failed to delete flow:", error);
      toast.error("Failed to delete flow");
    }
  };

  const handlePublishFlow = async (flowId: string) => {
    try {
      const publishedFlow = await apiClient.publishFlow(flowId);
      setFlows((prev) =>
        prev.map((f) => (f.id === flowId ? publishedFlow : f))
      );
      toast.success("Flow published successfully!");
    } catch (error) {
      console.error("Failed to publish flow:", error);
      toast.error("Failed to publish flow");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "testing":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "draft":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case "archived":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading flows...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Flow Manager</h2>
          <p className="text-muted-foreground">
            Manage your conversation flows
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Flow
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search flows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="min-w-[150px]">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Flow Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Create New Flow</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="flowName">Flow Name</Label>
              <Input
                id="flowName"
                placeholder="Enter flow name..."
                value={newFlow.name}
                onChange={(e) =>
                  setNewFlow((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="flowDescription">Description (Optional)</Label>
              <Textarea
                id="flowDescription"
                placeholder="Describe what this flow does..."
                value={newFlow.description}
                onChange={(e) =>
                  setNewFlow((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateFlow}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Create Flow
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flows Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {flows.map((flow) => (
          <Card key={flow.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{flow.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {flow.description || "No description"}
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(flow.status)}>
                  {flow.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Categories */}
              {flow.categories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {flow.categories.map((category) => (
                    <Badge
                      key={category.id}
                      variant="outline"
                      style={{ borderColor: category.color || undefined }}
                    >
                      {category.name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Metadata */}
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Version: {flow.version}</div>
                <div>Usage: {flow.usageCount} times</div>
                <div>Updated: {formatDate(flow.updatedAt)}</div>
                {flow.createdByUser && <div>By: {flow.createdByUser.name}</div>}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {onSelectFlow && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectFlow(flow)}
                    className="flex items-center gap-1"
                  >
                    <Eye className="h-3 w-3" />
                    View
                  </Button>
                )}
                {onEditFlow && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditFlow(flow)}
                    className="flex items-center gap-1"
                  >
                    <Edit className="h-3 w-3" />
                    Edit
                  </Button>
                )}
                {flow.status === "draft" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePublishFlow(flow.id)}
                    className="flex items-center gap-1"
                  >
                    <Play className="h-3 w-3" />
                    Publish
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteFlow(flow.id)}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {flows.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="text-4xl">🤖</div>
              <div>
                <h3 className="text-lg font-semibold">No flows found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ||
                  statusFilter !== "all" ||
                  categoryFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Create your first conversation flow to get started"}
                </p>
              </div>
              {!searchTerm &&
                statusFilter === "all" &&
                categoryFilter === "all" && (
                  <Button
                    onClick={() => setShowCreateForm(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create Your First Flow
                  </Button>
                )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
