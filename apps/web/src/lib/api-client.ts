import type { FlowConfig, SessionState, FlowVisualizationData, Flow, FlowCategory, ValidationResult } from './types';

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3000';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      mode: 'cors',
      credentials: 'omit', // Don't send credentials for now to avoid CORS issues
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`
        }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      // Handle network errors, CORS errors, etc.
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Network error: Unable to connect to server at ${this.baseUrl}. Please ensure the server is running and CORS is configured.`);
      }
      throw error;
    }
  }

  // Health check
  async health(): Promise<{ status: string; timestamp: string; uptime: number }> {
    return this.request('/api/health');
  }

  // Session management
  async createSession(flow: FlowConfig, sessionId?: string): Promise<{
    session_id: string;
    ws_url: string;
  }> {
    return this.request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ flow, session_id: sessionId }),
    });
  }

  async getSession(sessionId: string): Promise<SessionState> {
    return this.request(`/api/sessions/${sessionId}`);
  }

  async sendInput(sessionId: string, text: string): Promise<{ ok: boolean }> {
    return this.request(`/api/sessions/${sessionId}/input`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async getEvents(sessionId: string, since?: number): Promise<{
    events: Array<{
      type: string;
      [key: string]: any;
    }>;
  }> {
    const query = since ? `?since=${since}` : '';
    return this.request(`/api/sessions/${sessionId}/events${query}`);
  }

  async deleteSession(sessionId: string): Promise<{ ok: boolean }> {
    return this.request(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  // Demo flows
  async createDemoReservation(): Promise<{
    session_id: string;
    ws_url: string;
    flow_name: string;
  }> {
    return this.request('/api/demo/reservation', {
      method: 'POST',
    });
  }

  // Flow information
  async getFlowInfo(sessionId?: string): Promise<FlowVisualizationData> {
    const query = sessionId ? `?session=${sessionId}` : '';
    return this.request(`/api/flow-info${query}`);
  }

  // ========================================
  // FLOW MANAGEMENT API
  // ========================================

  async getFlows(filters?: {
    status?: 'draft' | 'testing' | 'published' | 'archived';
    search?: string;
    categoryId?: string;
    createdBy?: string;
  }): Promise<{ flows: Flow[] }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.categoryId) params.append('category', filters.categoryId);
    if (filters?.createdBy) params.append('createdBy', filters.createdBy);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/flows${query}`);
  }

  async getFlow(id: string, version?: number): Promise<Flow> {
    const query = version ? `?version=${version}` : '';
    return this.request(`/api/flows/${id}${query}`);
  }

  async createFlow(flowData: {
    name: string;
    description?: string;
    definition: any;
  }): Promise<Flow> {
    return this.request('/api/flows', {
      method: 'POST',
      body: JSON.stringify(flowData),
    });
  }

  async updateFlow(id: string, updates: {
    name?: string;
    description?: string;
    definition?: any;
    status?: 'draft' | 'testing' | 'published' | 'archived';
  }): Promise<Flow> {
    return this.request(`/api/flows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteFlow(id: string): Promise<void> {
    return this.request(`/api/flows/${id}`, {
      method: 'DELETE',
    });
  }

  async publishFlow(id: string): Promise<Flow> {
    return this.request(`/api/flows/${id}/publish`, {
      method: 'POST',
    });
  }

  async validateFlow(definition: any): Promise<ValidationResult> {
    return this.request('/api/flows/validate/temp', {
      method: 'POST',
      body: JSON.stringify({ definition }),
    });
  }

  async getFlowCategories(): Promise<{ categories: FlowCategory[] }> {
    return this.request('/api/flow-categories');
  }

  async createFlowCategory(categoryData: {
    name: string;
    description?: string;
    color?: string;
  }): Promise<FlowCategory> {
    return this.request('/api/flow-categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  }

  async getDatabaseHealth(): Promise<{ status: string; timestamp: string }> {
    return this.request('/api/database/health');
  }
}

// Default instance
export const apiClient = new ApiClient();
