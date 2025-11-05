import { 
  type User, 
  type InsertUser, 
  type UploadedFile, 
  type InsertFile,
  type VectorStore,
  type InsertVectorStore,
  type Assistant,
  type InsertAssistant,
  type UserAssistantAccess,
  type InsertUserAssistantAccess,
  type ChatSession,
  type InsertSession,
  type ChatMessage,
  type InsertMessage,
  users,
  uploadedFiles,
  vectorStores,
  assistants,
  userAssistantAccess,
  chatSessions,
  chatMessages
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, desc, and, isNull } from "drizzle-orm";
import postgres from "postgres";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(userId: string, role: "admin" | "user"): Promise<User | undefined>;
  getUserCount(): Promise<number>;
  
  // File methods (scoped to assistant)
  getFile(id: string): Promise<UploadedFile | undefined>;
  getAssistantFiles(assistantId: string): Promise<UploadedFile[]>;
  createFile(file: InsertFile): Promise<UploadedFile>;
  deleteFile(id: string): Promise<void>;
  
  // Vector store methods
  getVectorStore(): Promise<VectorStore | undefined>;
  createVectorStore(store: InsertVectorStore): Promise<VectorStore>;
  updateVectorStore(id: string, updates: Partial<VectorStore>): Promise<VectorStore | undefined>;
  
  // Assistant methods
  getAssistant(id: string): Promise<Assistant | undefined>;
  getAssistants(includeInactive?: boolean): Promise<Assistant[]>;
  createAssistant(assistant: InsertAssistant): Promise<Assistant>;
  updateAssistant(id: string, updates: Partial<Assistant>): Promise<Assistant | undefined>;
  deleteAssistant(id: string): Promise<void>;
  
  // User assistant access methods
  getUserAssistantAccess(userId: string): Promise<Assistant[]>;
  grantUserAssistantAccess(access: InsertUserAssistantAccess): Promise<UserAssistantAccess>;
  revokeUserAssistantAccess(userId: string, assistantId: string): Promise<void>;
  hasUserAssistantAccess(userId: string, assistantId: string): Promise<boolean>;
  
  // Session methods
  getSessions(userId?: string, assistantId?: string | null, isTest?: number): Promise<ChatSession[]>;
  getSession(id: string): Promise<ChatSession | undefined>;
  createSession(session: InsertSession): Promise<ChatSession>;
  updateSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined>;
  deleteSession(id: string): Promise<void>;
  
  // Message methods
  getMessages(sessionId: string): Promise<ChatMessage[]>;
  createMessage(message: InsertMessage): Promise<ChatMessage>;
  clearMessages(sessionId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private files: Map<string, UploadedFile>;
  private vectorStores: Map<string, VectorStore>;
  private assistants: Map<string, Assistant>;
  private userAssistantAccess: Map<string, UserAssistantAccess>;
  private sessions: Map<string, ChatSession>;
  private messages: Map<string, ChatMessage>;

  constructor() {
    this.users = new Map();
    this.files = new Map();
    this.vectorStores = new Map();
    this.assistants = new Map();
    this.userAssistantAccess = new Map();
    this.sessions = new Map();
    this.messages = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser & {role?: string}): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || "user",
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserRole(userId: string, role: "admin" | "user"): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    user.role = role;
    this.users.set(userId, user);
    return user;
  }

  async getUserCount(): Promise<number> {
    return this.users.size;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  // File methods
  async getFile(id: string): Promise<UploadedFile | undefined> {
    return this.files.get(id);
  }

  async getAssistantFiles(assistantId: string): Promise<UploadedFile[]> {
    return Array.from(this.files.values())
      .filter(file => file.assistantId === assistantId)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async createFile(insertFile: InsertFile): Promise<UploadedFile> {
    const id = randomUUID();
    const file: UploadedFile = {
      ...insertFile,
      id,
      description: insertFile.description ?? null,
      openaiFileId: insertFile.openaiFileId ?? null,
      openaiVectorStoreFileId: insertFile.openaiVectorStoreFileId ?? null,
      uploadedAt: new Date(),
    };
    this.files.set(id, file);
    return file;
  }

  async deleteFile(id: string): Promise<void> {
    this.files.delete(id);
  }

  // Vector store methods
  async getVectorStore(): Promise<VectorStore | undefined> {
    const stores = Array.from(this.vectorStores.values());
    return stores[0]; // Return the first/only vector store
  }

  async createVectorStore(insertStore: InsertVectorStore): Promise<VectorStore> {
    const id = randomUUID();
    const now = new Date();
    const store: VectorStore = {
      ...insertStore,
      id,
      status: insertStore.status ?? "active",
      fileCount: insertStore.fileCount ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.vectorStores.set(id, store);
    return store;
  }

  async updateVectorStore(id: string, updates: Partial<VectorStore>): Promise<VectorStore | undefined> {
    const store = this.vectorStores.get(id);
    if (!store) return undefined;
    
    const updated: VectorStore = {
      ...store,
      ...updates,
      updatedAt: new Date(),
    };
    this.vectorStores.set(id, updated);
    return updated;
  }

  // Assistant methods
  async getAssistant(id: string): Promise<Assistant | undefined> {
    return this.assistants.get(id);
  }

  async getAssistants(includeInactive?: boolean): Promise<Assistant[]> {
    let result = Array.from(this.assistants.values());
    if (!includeInactive) {
      result = result.filter(a => a.isActive === 1);
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createAssistant(insertAssistant: InsertAssistant): Promise<Assistant> {
    const id = randomUUID();
    const now = new Date();
    const assistant: Assistant = {
      ...insertAssistant,
      id,
      description: insertAssistant.description ?? null,
      openaiAssistantId: insertAssistant.openaiAssistantId ?? null,
      openaiVectorStoreId: insertAssistant.openaiVectorStoreId ?? null,
      model: insertAssistant.model ?? "gpt-4o",
      isActive: insertAssistant.isActive ?? 1,
      createdAt: now,
      updatedAt: now,
    };
    this.assistants.set(id, assistant);
    return assistant;
  }

  async updateAssistant(id: string, updates: Partial<Assistant>): Promise<Assistant | undefined> {
    const assistant = this.assistants.get(id);
    if (!assistant) return undefined;
    
    const updated: Assistant = {
      ...assistant,
      ...updates,
      updatedAt: new Date(),
    };
    this.assistants.set(id, updated);
    return updated;
  }

  async deleteAssistant(id: string): Promise<void> {
    this.assistants.delete(id);
    
    // Delete all files associated with this assistant (cascade)
    const filesToDelete = Array.from(this.files.entries())
      .filter(([_, file]) => file.assistantId === id)
      .map(([fileId]) => fileId);
    filesToDelete.forEach(fileId => this.files.delete(fileId));
    
    const accessToDelete = Array.from(this.userAssistantAccess.entries())
      .filter(([_, access]) => access.assistantId === id)
      .map(([accessId]) => accessId);
    accessToDelete.forEach(accessId => this.userAssistantAccess.delete(accessId));
  }

  // User assistant access methods
  async getUserAssistantAccess(userId: string): Promise<Assistant[]> {
    const accessibleAssistantIds = Array.from(this.userAssistantAccess.values())
      .filter(access => access.userId === userId)
      .map(access => access.assistantId);
    
    return Array.from(this.assistants.values())
      .filter(assistant => accessibleAssistantIds.includes(assistant.id) && assistant.isActive === 1);
  }

  async grantUserAssistantAccess(insertAccess: InsertUserAssistantAccess): Promise<UserAssistantAccess> {
    const id = randomUUID();
    const access: UserAssistantAccess = {
      ...insertAccess,
      id,
      createdAt: new Date(),
    };
    this.userAssistantAccess.set(id, access);
    return access;
  }

  async revokeUserAssistantAccess(userId: string, assistantId: string): Promise<void> {
    for (const [id, access] of Array.from(this.userAssistantAccess.entries())) {
      if (access.userId === userId && access.assistantId === assistantId) {
        this.userAssistantAccess.delete(id);
        break;
      }
    }
  }

  async hasUserAssistantAccess(userId: string, assistantId: string): Promise<boolean> {
    for (const access of Array.from(this.userAssistantAccess.values())) {
      if (access.userId === userId && access.assistantId === assistantId) {
        return true;
      }
    }
    return false;
  }

  // Session methods
  async getSessions(userId?: string, assistantId?: string | null, isTest?: number): Promise<ChatSession[]> {
    let sessions = Array.from(this.sessions.values());
    if (userId) {
      sessions = sessions.filter(s => s.userId === userId);
    }
    if (assistantId !== undefined) {
      sessions = sessions.filter(s => s.assistantId === assistantId);
    }
    if (isTest !== undefined) {
      sessions = sessions.filter(s => s.isTest === isTest);
    }
    return sessions.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  async getSession(id: string): Promise<ChatSession | undefined> {
    return this.sessions.get(id);
  }

  async createSession(insertSession: InsertSession): Promise<ChatSession> {
    const id = randomUUID();
    const now = new Date();
    const session: ChatSession = {
      ...insertSession,
      id,
      userId: insertSession.userId || null,
      assistantId: insertSession.assistantId || null,
      title: insertSession.title ?? "New Conversation",
      isTest: insertSession.isTest ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, session);
    return session;
  }

  async updateSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    
    const updated: ChatSession = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };
    this.sessions.set(id, updated);
    return updated;
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
    // Delete all messages in this session
    for (const [msgId, msg] of Array.from(this.messages.entries())) {
      if (msg.sessionId === id) {
        this.messages.delete(msgId);
      }
    }
  }

  // Message methods
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = {
      ...insertMessage,
      id,
      citations: insertMessage.citations ?? null,
      timestamp: new Date(),
    };
    this.messages.set(id, message);
    
    // Update session's updatedAt
    const session = this.sessions.get(insertMessage.sessionId);
    if (session) {
      session.updatedAt = new Date();
    }
    
    return message;
  }

  async clearMessages(sessionId: string): Promise<void> {
    for (const [id, msg] of Array.from(this.messages.entries())) {
      if (msg.sessionId === sessionId) {
        this.messages.delete(id);
      }
    }
  }
}

export class DbStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;

  constructor(connectionString: string) {
    // Configure postgres client for Supabase pooler
    // prepare: false is required for Supabase transaction pooling mode
    const client = postgres(connectionString, { 
      prepare: false,
      max: 10
    });
    this.db = drizzle(client);
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUserRole(userId: string, role: "admin" | "user"): Promise<User | undefined> {
    const result = await this.db
      .update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async getUserCount(): Promise<number> {
    const result = await this.db.select().from(users);
    return result.length;
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users).orderBy(desc(users.createdAt));
  }

  // File methods
  async getFile(id: string): Promise<UploadedFile | undefined> {
    const result = await this.db.select().from(uploadedFiles).where(eq(uploadedFiles.id, id)).limit(1);
    return result[0];
  }

  async getAssistantFiles(assistantId: string): Promise<UploadedFile[]> {
    return await this.db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.assistantId, assistantId))
      .orderBy(desc(uploadedFiles.uploadedAt));
  }

  async createFile(insertFile: InsertFile): Promise<UploadedFile> {
    const result = await this.db.insert(uploadedFiles).values(insertFile).returning();
    return result[0];
  }

  async deleteFile(id: string): Promise<void> {
    await this.db.delete(uploadedFiles).where(eq(uploadedFiles.id, id));
  }

  // Vector store methods
  async getVectorStore(): Promise<VectorStore | undefined> {
    const result = await this.db.select().from(vectorStores).limit(1);
    return result[0];
  }

  async createVectorStore(insertStore: InsertVectorStore): Promise<VectorStore> {
    const result = await this.db.insert(vectorStores).values(insertStore).returning();
    return result[0];
  }

  async updateVectorStore(id: string, updates: Partial<VectorStore>): Promise<VectorStore | undefined> {
    const result = await this.db
      .update(vectorStores)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vectorStores.id, id))
      .returning();
    return result[0];
  }

  // Assistant methods
  async getAssistant(id: string): Promise<Assistant | undefined> {
    const result = await this.db.select().from(assistants).where(eq(assistants.id, id)).limit(1);
    return result[0];
  }

  async getAssistants(includeInactive?: boolean): Promise<Assistant[]> {
    if (includeInactive) {
      return await this.db.select().from(assistants).orderBy(desc(assistants.createdAt));
    }
    return await this.db.select().from(assistants).where(eq(assistants.isActive, 1)).orderBy(desc(assistants.createdAt));
  }

  async createAssistant(insertAssistant: InsertAssistant): Promise<Assistant> {
    const result = await this.db.insert(assistants).values(insertAssistant).returning();
    return result[0];
  }

  async updateAssistant(id: string, updates: Partial<Assistant>): Promise<Assistant | undefined> {
    const result = await this.db
      .update(assistants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(assistants.id, id))
      .returning();
    return result[0];
  }

  async deleteAssistant(id: string): Promise<void> {
    // Files will be cascade-deleted by the database foreign key constraint
    await this.db.delete(assistants).where(eq(assistants.id, id));
  }

  // User assistant access methods
  async getUserAssistantAccess(userId: string): Promise<Assistant[]> {
    const result = await this.db
      .select({
        id: assistants.id,
        name: assistants.name,
        description: assistants.description,
        instructions: assistants.instructions,
        openaiAssistantId: assistants.openaiAssistantId,
        openaiVectorStoreId: assistants.openaiVectorStoreId,
        model: assistants.model,
        isActive: assistants.isActive,
        createdAt: assistants.createdAt,
        updatedAt: assistants.updatedAt,
      })
      .from(userAssistantAccess)
      .innerJoin(assistants, eq(userAssistantAccess.assistantId, assistants.id))
      .where(and(
        eq(userAssistantAccess.userId, userId),
        eq(assistants.isActive, 1)
      ));
    return result;
  }

  async grantUserAssistantAccess(insertAccess: InsertUserAssistantAccess): Promise<UserAssistantAccess> {
    const result = await this.db.insert(userAssistantAccess).values(insertAccess).returning();
    return result[0];
  }

  async revokeUserAssistantAccess(userId: string, assistantId: string): Promise<void> {
    await this.db.delete(userAssistantAccess)
      .where(and(
        eq(userAssistantAccess.userId, userId),
        eq(userAssistantAccess.assistantId, assistantId)
      ));
  }

  async hasUserAssistantAccess(userId: string, assistantId: string): Promise<boolean> {
    const result = await this.db.select().from(userAssistantAccess)
      .where(and(
        eq(userAssistantAccess.userId, userId),
        eq(userAssistantAccess.assistantId, assistantId)
      ))
      .limit(1);
    return result.length > 0;
  }

  // Session methods
  async getSessions(userId?: string, assistantId?: string | null, isTest?: number): Promise<ChatSession[]> {
    const conditions = [];
    if (userId) {
      conditions.push(eq(chatSessions.userId, userId));
    }
    if (assistantId !== undefined) {
      if (assistantId === null) {
        conditions.push(isNull(chatSessions.assistantId));
      } else {
        conditions.push(eq(chatSessions.assistantId, assistantId));
      }
    }
    if (isTest !== undefined) {
      conditions.push(eq(chatSessions.isTest, isTest));
    }
    
    if (conditions.length > 0) {
      return await this.db.select().from(chatSessions).where(and(...conditions)).orderBy(desc(chatSessions.updatedAt));
    }
    return await this.db.select().from(chatSessions).orderBy(desc(chatSessions.updatedAt));
  }

  async getSession(id: string): Promise<ChatSession | undefined> {
    const result = await this.db.select().from(chatSessions).where(eq(chatSessions.id, id)).limit(1);
    return result[0];
  }

  async createSession(insertSession: InsertSession): Promise<ChatSession> {
    const result = await this.db.insert(chatSessions).values(insertSession).returning();
    return result[0];
  }

  async updateSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const result = await this.db
      .update(chatSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(chatSessions.id, id))
      .returning();
    return result[0];
  }

  async deleteSession(id: string): Promise<void> {
    // Cascade delete is handled by the database foreign key constraint
    await this.db.delete(chatSessions).where(eq(chatSessions.id, id));
  }

  // Message methods
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    return await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.timestamp);
  }

  async createMessage(insertMessage: InsertMessage): Promise<ChatMessage> {
    const result = await this.db.insert(chatMessages).values(insertMessage).returning();
    
    // Update session's updatedAt
    await this.db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, insertMessage.sessionId));
    
    return result[0];
  }

  async clearMessages(sessionId: string): Promise<void> {
    await this.db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  }
}

// Use database storage if DATABASE_URL is available, otherwise fall back to memory
export const storage = process.env.DATABASE_URL 
  ? new DbStorage(process.env.DATABASE_URL)
  : new MemStorage();
