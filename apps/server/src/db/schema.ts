import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, pgEnum, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const flowStatusEnum = pgEnum('flow_status', ['draft', 'testing', 'published', 'archived']);

// Users table (simplified for now)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Flow definitions table
export const flows = pgTable('flows', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  version: integer('version').notNull().default(1),
  status: flowStatusEnum('status').notNull().default('draft'),

  // JSON column for the actual flow definition
  definition: jsonb('definition').notNull(),

  // Metadata
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  publishedAt: timestamp('published_at'),

  // Usage tracking
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
});

// Flow versions for history/rollback
export const flowVersions = pgTable('flow_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  flowId: uuid('flow_id').references(() => flows.id, { onDelete: 'cascade' }).notNull(),
  version: integer('version').notNull(),
  definition: jsonb('definition').notNull(),
  changelog: text('changelog'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
});

// Flow categories/tags
export const flowCategories = pgTable('flow_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  color: varchar('color', { length: 7 }), // hex color
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Many-to-many relationship between flows and categories
export const flowCategoryMappings = pgTable('flow_category_mappings', {
  flowId: uuid('flow_id').references(() => flows.id, { onDelete: 'cascade' }).notNull(),
  categoryId: uuid('category_id').references(() => flowCategories.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.flowId, table.categoryId] }),
}));

// Flow execution sessions (link to existing session system)
export const flowSessions = pgTable('flow_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: varchar('session_id', { length: 255 }).notNull().unique(), // Links to Redis session
  flowId: uuid('flow_id').references(() => flows.id).notNull(),
  flowVersion: integer('flow_version').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('active'), // active, completed, failed
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  currentState: varchar('current_state', { length: 255 }),
  context: jsonb('context'),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  flows: many(flows),
  flowVersions: many(flowVersions),
}));

export const flowsRelations = relations(flows, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [flows.createdBy],
    references: [users.id],
  }),
  versions: many(flowVersions),
  categories: many(flowCategoryMappings),
  sessions: many(flowSessions),
}));

export const flowVersionsRelations = relations(flowVersions, ({ one }) => ({
  flow: one(flows, {
    fields: [flowVersions.flowId],
    references: [flows.id],
  }),
  createdBy: one(users, {
    fields: [flowVersions.createdBy],
    references: [users.id],
  }),
}));

export const flowCategoriesRelations = relations(flowCategories, ({ many }) => ({
  flows: many(flowCategoryMappings),
}));

export const flowCategoryMappingsRelations = relations(flowCategoryMappings, ({ one }) => ({
  flow: one(flows, {
    fields: [flowCategoryMappings.flowId],
    references: [flows.id],
  }),
  category: one(flowCategories, {
    fields: [flowCategoryMappings.categoryId],
    references: [flowCategories.id],
  }),
}));

export const flowSessionsRelations = relations(flowSessions, ({ one }) => ({
  flow: one(flows, {
    fields: [flowSessions.flowId],
    references: [flows.id],
  }),
}));

// Type exports for use in the application
export type Flow = typeof flows.$inferSelect;
export type NewFlow = typeof flows.$inferInsert;
export type FlowVersion = typeof flowVersions.$inferSelect;
export type NewFlowVersion = typeof flowVersions.$inferInsert;
export type FlowCategory = typeof flowCategories.$inferSelect;
export type NewFlowCategory = typeof flowCategories.$inferInsert;
export type FlowSession = typeof flowSessions.$inferSelect;
export type NewFlowSession = typeof flowSessions.$inferInsert;
