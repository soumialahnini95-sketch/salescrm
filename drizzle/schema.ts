import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing the Manus OAuth flow.
 * Extend this file with product tables as the CRM grows.
 */
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

export const prospectStages = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

export type ProspectStage = (typeof prospectStages)[number];

export const prospects = mysqlTable(
  "prospects",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    firstName: varchar("firstName", { length: 120 }),
    lastName: varchar("lastName", { length: 120 }),
    company: varchar("company", { length: 180 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 80 }),
    source: varchar("source", { length: 120 }),
    stage: mysqlEnum("stage", prospectStages).default("new").notNull(),
    estimatedValueCents: int("estimatedValueCents").default(0).notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => ({
    ownerUpdatedIdx: index("prospects_owner_updated_idx").on(
      table.ownerId,
      table.updatedAt,
    ),
    ownerStageIdx: index("prospects_owner_stage_idx").on(
      table.ownerId,
      table.stage,
    ),
  }),
);

export const activities = mysqlTable(
  "activities",
  {
    id: int("id").autoincrement().primaryKey(),
    prospectId: int("prospectId")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", ["note", "call", "email", "meeting", "stage_change"])
      .default("note")
      .notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    prospectCreatedIdx: index("activities_prospect_created_idx").on(
      table.prospectId,
      table.createdAt,
    ),
  }),
);

export const followUps = mysqlTable(
  "followUps",
  {
    id: int("id").autoincrement().primaryKey(),
    prospectId: int("prospectId")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    ownerId: int("ownerId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    dueAt: timestamp("dueAt").notNull(),
    priority: mysqlEnum("priority", ["low", "medium", "high"])
      .default("medium")
      .notNull(),
    status: mysqlEnum("status", ["open", "completed"])
      .default("open")
      .notNull(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    ownerDueIdx: index("followups_owner_due_idx").on(
      table.ownerId,
      table.dueAt,
      table.status,
    ),
  }),
);

export const importBatches = mysqlTable("importBatches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  totalRows: int("totalRows").default(0).notNull(),
  importedRows: int("importedRows").default(0).notNull(),
  duplicateRows: int("duplicateRows").default(0).notNull(),
  errorRows: int("errorRows").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Prospect = typeof prospects.$inferSelect;
export type NewProspect = typeof prospects.$inferInsert;
export type FollowUp = typeof followUps.$inferSelect;
