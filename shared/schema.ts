import { pgTable, text, varchar, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'admin' | 'user'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const assistants = pgTable("assistants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  instructions: text("instructions").notNull(),
  openaiAssistantId: text("openai_assistant_id"),
  openaiVectorStoreId: text("openai_vector_store_id"),
  model: text("model").notNull().default("gpt-4o"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const uploadedFiles = pgTable("uploaded_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assistantId: varchar("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type").notNull(),
  openaiFileId: text("openai_file_id"),
  openaiVectorStoreFileId: text("openai_vector_store_file_id"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  description: text("description"),
});

export const vectorStores = pgTable("vector_stores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  openaiVectorStoreId: text("openai_vector_store_id").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  fileCount: integer("file_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userAssistantAccess = pgTable("user_assistant_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assistantId: varchar("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  assistantId: varchar("assistant_id").references(() => assistants.id, { onDelete: "set null" }),
  responseId: text("response_id"),
  title: text("title").notNull().default("New Conversation"),
  isTest: integer("is_test").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  citations: jsonb("citations"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const insertFileSchema = createInsertSchema(uploadedFiles).omit({
  id: true,
  uploadedAt: true,
});

export const insertVectorStoreSchema = createInsertSchema(vectorStores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertAssistantSchema = createInsertSchema(assistants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserAssistantAccessSchema = createInsertSchema(userAssistantAccess).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;
export type User = typeof users.$inferSelect;
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type VectorStore = typeof vectorStores.$inferSelect;
export type InsertVectorStore = z.infer<typeof insertVectorStoreSchema>;
export type Assistant = typeof assistants.$inferSelect;
export type InsertAssistant = z.infer<typeof insertAssistantSchema>;
export type UserAssistantAccess = typeof userAssistantAccess.$inferSelect;
export type InsertUserAssistantAccess = z.infer<typeof insertUserAssistantAccessSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
