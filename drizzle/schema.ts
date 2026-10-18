import { index, int, mysqlEnum, mysqlTable, mediumtext, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing the supplied Manus OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Private, owner-scoped project records. */
export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: mediumtext("description"),
    status: mysqlEnum("status", [
      "draft", "planning", "ready", "running", "paused", "awaiting_approval", "failed", "completed", "cancelled", "archived",
    ]).default("draft").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({ ownerUpdatedIdx: index("projects_owner_updated_idx").on(table.userId, table.updatedAt) }),
);

export type Project = typeof projects.$inferSelect;

/** One or more conversations can belong to a project. */
export const conversations = mysqlTable(
  "conversations",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["open", "archived"]).default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({ ownerProjectIdx: index("conversations_owner_project_idx").on(table.userId, table.projectId) }),
);

export type Conversation = typeof conversations.$inferSelect;

/** Conversation messages are persisted as content, not as executed AI actions. */
export const messages = mysqlTable(
  "messages",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    conversationId: int("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["user", "supervisor", "worker", "system"]).notNull(),
    content: mediumtext("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ conversationCreatedIdx: index("messages_conversation_created_idx").on(table.conversationId, table.createdAt) }),
);

export type Message = typeof messages.$inferSelect;

/** Per-user provider keys, encrypted by the application before they reach this table. */
export const providerCredentials = mysqlTable(
  "provider_credentials",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    providerId: varchar("providerId", { length: 64 }).notNull(),
    encryptedKey: text("encryptedKey").notNull(),
    keyLastFour: varchar("keyLastFour", { length: 4 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    ownerProviderUnique: uniqueIndex("provider_credentials_owner_provider_unique").on(table.userId, table.providerId),
  }),
);

export type ProviderCredential = typeof providerCredentials.$inferSelect;
