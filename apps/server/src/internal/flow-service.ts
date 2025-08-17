import { db } from '../db/connection';
import { flows, flowVersions, flowCategories, flowCategoryMappings, users, type Flow, type NewFlow, type FlowVersion, type NewFlowVersion } from '../db/schema';
import { eq, desc, and, like, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface FlowFilters {
  status?: 'draft' | 'testing' | 'published' | 'archived';
  categoryId?: string;
  search?: string;
  createdBy?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FlowWithCategories extends Flow {
  categories: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
  };
}

export class FlowService {
  /**
   * Create a new flow
   */
  async createFlow(flowData: Omit<NewFlow, 'id' | 'createdAt' | 'updatedAt'>): Promise<Flow> {
    // Validate the flow definition
    const validation = await this.validateFlow(flowData.definition as any);
    if (!validation.isValid) {
      throw new Error(`Flow validation failed: ${validation.errors.join(', ')}`);
    }

    const [newFlow] = await db.insert(flows).values({
      ...flowData,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Create initial version
    await this.createVersion(newFlow.id, {
      version: 1,
      definition: flowData.definition,
      changelog: 'Initial version',
      createdBy: flowData.createdBy,
    });

    return newFlow;
  }

  /**
   * Get a flow by ID with optional version
   */
  async getFlow(id: string, version?: number): Promise<FlowWithCategories | null> {
    let flowQuery = db
      .select({
        flow: flows,
        category: {
          id: flowCategories.id,
          name: flowCategories.name,
          color: flowCategories.color,
        },
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(flows)
      .leftJoin(flowCategoryMappings, eq(flows.id, flowCategoryMappings.flowId))
      .leftJoin(flowCategories, eq(flowCategoryMappings.categoryId, flowCategories.id))
      .leftJoin(users, eq(flows.createdBy, users.id))
      .where(eq(flows.id, id));

    const results = await flowQuery;

    if (results.length === 0) {
      return null;
    }

    // If specific version requested, get it from flow_versions
    let flowDefinition = results[0].flow.definition;
    if (version && version !== results[0].flow.version) {
      const versionResult = await db
        .select()
        .from(flowVersions)
        .where(and(eq(flowVersions.flowId, id), eq(flowVersions.version, version)))
        .limit(1);

      if (versionResult.length > 0) {
        flowDefinition = versionResult[0].definition;
      }
    }

    // Group categories
    const categories = results
      .filter(r => r.category?.id)
      .map(r => r.category!)
      .filter((cat, index, self) => self.findIndex(c => c?.id === cat.id) === index);

    return {
      ...results[0].flow,
      definition: flowDefinition,
      categories,
      createdByUser: results[0].user || undefined,
    };
  }

  /**
   * Update a flow
   */
  async updateFlow(id: string, updates: Partial<Omit<NewFlow, 'id' | 'createdAt'>>): Promise<Flow> {
    // If definition is being updated, validate it
    if (updates.definition) {
      const validation = await this.validateFlow(updates.definition as any);
      if (!validation.isValid) {
        throw new Error(`Flow validation failed: ${validation.errors.join(', ')}`);
      }
    }

    const [updatedFlow] = await db
      .update(flows)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(flows.id, id))
      .returning();

    return updatedFlow;
  }

  /**
   * Delete a flow
   */
  async deleteFlow(id: string): Promise<void> {
    await db.delete(flows).where(eq(flows.id, id));
  }

  /**
   * List flows with filters
   */
  async listFlows(filters: FlowFilters = {}): Promise<FlowWithCategories[]> {
    let query = db
      .select({
        flow: flows,
        category: {
          id: flowCategories.id,
          name: flowCategories.name,
          color: flowCategories.color,
        },
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(flows)
      .leftJoin(flowCategoryMappings, eq(flows.id, flowCategoryMappings.flowId))
      .leftJoin(flowCategories, eq(flowCategoryMappings.categoryId, flowCategories.id))
      .leftJoin(users, eq(flows.createdBy, users.id));

    // Apply filters
    const conditions = [];

    if (filters.status) {
      conditions.push(eq(flows.status, filters.status));
    }

    if (filters.search) {
      conditions.push(like(flows.name, `%${filters.search}%`));
    }

    if (filters.createdBy) {
      conditions.push(eq(flows.createdBy, filters.createdBy));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(flows.updatedAt)) as any;

    const results = await query;

    // Group by flow ID and aggregate categories
    const flowMap = new Map<string, FlowWithCategories>();

    for (const result of results) {
      if (!flowMap.has(result.flow.id)) {
        flowMap.set(result.flow.id, {
          ...result.flow,
          categories: [],
          createdByUser: result.user || undefined,
        });
      }

      const flow = flowMap.get(result.flow.id)!;
      if (result.category?.id && !flow.categories.find(c => c.id === result.category!.id)) {
        flow.categories.push(result.category);
      }
    }

    return Array.from(flowMap.values());
  }

  /**
   * Publish a flow
   */
  async publishFlow(id: string): Promise<Flow> {
    const [publishedFlow] = await db
      .update(flows)
      .set({
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(flows.id, id))
      .returning();

    return publishedFlow;
  }

  /**
   * Create a new version of a flow
   */
  async createVersion(flowId: string, versionData: Omit<NewFlowVersion, 'id' | 'flowId' | 'createdAt'>): Promise<FlowVersion> {
    const [newVersion] = await db.insert(flowVersions).values({
      ...versionData,
      flowId,
      createdAt: new Date(),
    }).returning();

    return newVersion;
  }

  /**
   * Get version history for a flow
   */
  async getVersionHistory(flowId: string): Promise<FlowVersion[]> {
    return await db
      .select()
      .from(flowVersions)
      .where(eq(flowVersions.flowId, flowId))
      .orderBy(desc(flowVersions.version));
  }

  /**
   * Rollback to a specific version
   */
  async rollbackToVersion(flowId: string, version: number): Promise<Flow> {
    // Get the version data
    const [versionData] = await db
      .select()
      .from(flowVersions)
      .where(and(eq(flowVersions.flowId, flowId), eq(flowVersions.version, version)))
      .limit(1);

    if (!versionData) {
      throw new Error(`Version ${version} not found for flow ${flowId}`);
    }

    // Update the main flow with the version data
    const [updatedFlow] = await db
      .update(flows)
      .set({
        definition: versionData.definition,
        updatedAt: new Date(),
      })
      .where(eq(flows.id, flowId))
      .returning();

    return updatedFlow;
  }

  /**
   * Validate a flow definition
   */
  async validateFlow(definition: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic structure validation
      if (!definition.meta) {
        errors.push('Flow must have meta information');
      }

      if (!definition.start) {
        errors.push('Flow must have a start state');
      }

      if (!definition.states || Object.keys(definition.states).length === 0) {
        errors.push('Flow must have at least one state');
      }

      // Validate start state exists
      if (definition.start && definition.states && !definition.states[definition.start]) {
        errors.push(`Start state '${definition.start}' does not exist in states`);
      }

      // Validate state transitions
      if (definition.states) {
        for (const [stateName, state] of Object.entries(definition.states)) {
          const stateObj = state as any;

          if (stateObj.transitions) {
            for (const transition of stateObj.transitions) {
              if (transition.to && !definition.states[transition.to]) {
                errors.push(`State '${stateName}' has transition to non-existent state '${transition.to}'`);
              }

              if (transition.branch) {
                for (const branch of transition.branch) {
                  if (branch.to && !definition.states[branch.to]) {
                    errors.push(`State '${stateName}' has branch transition to non-existent state '${branch.to}'`);
                  }
                }
              }
            }
          }
        }
      }

      // Validate intents referenced in transitions exist
      if (definition.states && definition.intents) {
        for (const [stateName, state] of Object.entries(definition.states)) {
          const stateObj = state as any;

          if (stateObj.transitions) {
            for (const transition of stateObj.transitions) {
              if (transition.onIntent) {
                const intents = Array.isArray(transition.onIntent) ? transition.onIntent : [transition.onIntent];
                for (const intent of intents) {
                  if (!definition.intents[intent]) {
                    errors.push(`State '${stateName}' references non-existent intent '${intent}'`);
                  }
                }
              }
            }
          }
        }
      }

      // Validate tools referenced in actions exist
      if (definition.states && definition.tools) {
        for (const [stateName, state] of Object.entries(definition.states)) {
          const stateObj = state as any;

          if (stateObj.onEnter) {
            for (const action of stateObj.onEnter) {
              if (action.tool && !definition.tools[action.tool]) {
                errors.push(`State '${stateName}' references non-existent tool '${action.tool}'`);
              }
            }
          }
        }
      }

      // Check for unreachable states (warnings)
      if (definition.states && definition.start) {
        const reachableStates = new Set([definition.start]);
        const queue = [definition.start];

        while (queue.length > 0) {
          const currentState = queue.shift()!;
          const state = definition.states[currentState];

          if (state?.transitions) {
            for (const transition of state.transitions) {
              if (transition.to && !reachableStates.has(transition.to)) {
                reachableStates.add(transition.to);
                queue.push(transition.to);
              }

              if (transition.branch) {
                for (const branch of transition.branch) {
                  if (branch.to && !reachableStates.has(branch.to)) {
                    reachableStates.add(branch.to);
                    queue.push(branch.to);
                  }
                }
              }
            }
          }
        }

        for (const stateName of Object.keys(definition.states)) {
          if (!reachableStates.has(stateName)) {
            warnings.push(`State '${stateName}' is unreachable from the start state`);
          }
        }
      }

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Increment usage count for a flow
   */
  async incrementUsage(flowId: string): Promise<void> {
    // Get current usage count first
    const [currentFlow] = await db
      .select({ usageCount: flows.usageCount })
      .from(flows)
      .where(eq(flows.id, flowId))
      .limit(1);

    const newUsageCount = (currentFlow?.usageCount || 0) + 1;

    await db
      .update(flows)
      .set({
        usageCount: newUsageCount,
        lastUsedAt: new Date(),
      })
      .where(eq(flows.id, flowId));
  }

  /**
   * Get flow categories
   */
  async getCategories() {
    return await db.select().from(flowCategories).orderBy(flowCategories.name);
  }

  /**
   * Create a flow category
   */
  async createCategory(name: string, description?: string, color?: string) {
    const [category] = await db.insert(flowCategories).values({
      name,
      description,
      color,
    }).returning();

    return category;
  }
}
