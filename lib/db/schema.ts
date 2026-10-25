import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { Item } from "../items/model";

// Better Auth core schema, matched to installed Better Auth 1.7.
const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_idx").on(table.userId)],
);
export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("account_user_idx").on(table.userId),
    uniqueIndex("account_provider_idx").on(table.providerId, table.accountId),
  ],
);
export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);
export const rateLimit = sqliteTable("rateLimit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});

export const clipsyConnection = sqliteTable("clipsy_connection", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  remoteOrigin: text("remote_origin").notNull(),
  encryptedToken: text("encrypted_token").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const clipsyPending = sqliteTable("clipsy_pending", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  remoteOrigin: text("remote_origin").notNull(),
  sessionId: text("session_id").notNull(),
  stateHash: text("state_hash").notNull().unique(),
  encryptedVerifier: text("encrypted_verifier").notNull(),
  expiresAt: integer("expires_at").notNull(),
  exchanging: integer("exchanging", { mode: "boolean" })
    .notNull()
    .default(false),
});

// Owner is deliberately separate from portable Item content. Never accept it from a client.
export const items = sqliteTable(
  "item",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    type: text("type").$type<Item["type"]>().notNull(),
    intent: text("intent").$type<Item["intent"]>().notNull(),
    status: text("status").$type<Item["status"]>().notNull(),
    title: text("title").notNull(),
    url: text("url"),
    content: text("content"),
    description: text("description"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
    source: text("source"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
    reminderAt: text("reminder_at"),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index("item_owner_saved_idx").on(table.userId, table.createdAt),
  ],
);
