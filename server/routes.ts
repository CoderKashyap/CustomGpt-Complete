import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { upload } from "./services/upload";
import { 
  createVectorStore, 
  uploadFileToVectorStore, 
  deleteFileFromVectorStore,
  streamChatResponse,
  getChatResponseWithCitations,
  getVectorStoreFileCount
} from "./services/openai";
import {
  createOpenAIAssistant,
  updateOpenAIAssistant,
  deleteOpenAIAssistant,
  attachFileToAssistant,
  removeFileFromAssistant,
  chatWithAssistant
} from "./services/assistant";
import { chatWithFilesearch } from "./services/openai-responses";
import { 
  insertFileSchema, 
  insertSessionSchema, 
  insertMessageSchema, 
  insertUserSchema, 
  loginSchema,
  insertAssistantSchema,
  insertUserAssistantAccessSchema
} from "@shared/schema";
import bcrypt from "bcrypt";
import passport from "./auth";
import { requireAuth, requireAdmin } from "./middleware/auth";
import type { User } from "@shared/schema";
import fs from "fs";
import path from "path";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper function to verify session ownership
async function verifySessionOwnership(sessionId: string, userId: string): Promise<boolean> {
  const session = await storage.getSession(sessionId);
  if (!session) return false;
  return session.userId === userId;
}

// Helper function to upload file to OpenAI Files API
async function uploadFileToOpenAI(filePath: string, filename: string): Promise<{ openaiFileId: string; vectorStoreFileId: string | null }> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
  
  const fileStream = fs.createReadStream(filePath);
  const file = await openai.files.create({
    file: fileStream,
    purpose: 'assistants',
  });
  
  return {
    openaiFileId: file.id,
    vectorStoreFileId: null, // Vector store file ID is created when attaching to assistant
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  // Regular public signup - always creates "user" accounts
  app.post("/api/auth/signup", async (req, res, next) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      // Regular signup always creates "user" accounts
      const user = await storage.createUser({
        username: validatedData.username,
        password: hashedPassword,
        role: "user",
      });

      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Secret admin signup - allows role selection (requires admin secret)
  app.post("/api/auth/admin-signup", async (req, res, next) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const { role, adminSecret } = req.body;
      
      // Verify admin secret
      const correctAdminSecret = process.env.ADMIN_SECRET;
      if (!correctAdminSecret) {
        return res.status(500).json({ message: "Admin secret not configured on server" });
      }
      
      if (adminSecret !== correctAdminSecret) {
        return res.status(403).json({ message: "Invalid admin secret" });
      }
      
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      // Admin signup allows role selection (admin or user)
      const userRole: "admin" | "user" = role === "admin" ? "admin" : "user";
      
      const user = await storage.createUser({
        username: validatedData.username,
        password: hashedPassword,
        role: userRole,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    try {
      loginSchema.parse(req.body);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Login failed" });

      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      const { password, ...userWithoutPassword } = req.user as any;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // User Management Routes (Admin only)
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/users/:userId/role", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!role || !["admin", "user"].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Must be 'admin' or 'user'" });
      }

      const updatedUser = await storage.updateUserRole(userId, role as "admin" | "user");
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/users/:userId/assistants", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const assistants = await storage.getUserAssistantAccess(userId);
      res.json(assistants);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/users/:userId/assistant-access", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { assistantId } = req.body;
      
      if (!assistantId) {
        return res.status(400).json({ message: "Assistant ID is required" });
      }

      const access = await storage.grantUserAssistantAccess({ userId, assistantId });
      res.json(access);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/users/:userId/assistant-access/:assistantId", requireAdmin, async (req, res) => {
    try {
      const { userId, assistantId } = req.params;
      await storage.revokeUserAssistantAccess(userId, assistantId);
      res.json({ message: "Access revoked successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Assistant Management Routes (Admin only)
  app.get("/api/assistants", requireAdmin, async (req, res) => {
    try {
      const includeInactive = req.query.includeInactive === "true";
      const assistants = await storage.getAssistants(includeInactive);
      res.json(assistants);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get a single assistant (for user chat page)
  app.get("/api/assistants/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const assistant = await storage.getAssistant(id);
      
      if (!assistant) {
        return res.status(404).json({ message: "Assistant not found" });
      }

      res.json(assistant);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/assistants", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertAssistantSchema.parse(req.body);
      
      const openaiAssistantId = await createOpenAIAssistant(
        validatedData.name,
        validatedData.instructions,
        validatedData.model
      );

      const assistant = await storage.createAssistant({
        ...validatedData,
        openaiAssistantId,
      });

      res.json(assistant);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/assistants/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, instructions, model, isActive } = req.body;

      const existingAssistant = await storage.getAssistant(id);
      if (!existingAssistant) {
        return res.status(404).json({ message: "Assistant not found" });
      }

      if (existingAssistant.openaiAssistantId && (name || instructions || model)) {
        await updateOpenAIAssistant(existingAssistant.openaiAssistantId, {
          name,
          instructions,
          model,
        });
      }

      // Prepare updates object with only valid fields
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (instructions !== undefined) updates.instructions = instructions;
      if (model !== undefined) updates.model = model;
      if (isActive !== undefined) {
        // Convert boolean to integer for database
        updates.isActive = isActive ? 1 : 0;
      }

      const updatedAssistant = await storage.updateAssistant(id, updates);
      res.json(updatedAssistant);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/assistants/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const assistant = await storage.getAssistant(id);
      if (!assistant) {
        return res.status(404).json({ message: "Assistant not found" });
      }

      if (assistant.openaiAssistantId) {
        await deleteOpenAIAssistant(assistant.openaiAssistantId);
      }

      await storage.deleteAssistant(id);
      res.json({ message: "Assistant deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get files for a specific assistant
  app.get("/api/assistants/:id/files", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const files = await storage.getAssistantFiles(id);
      res.json(files);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Upload file directly to an assistant's knowledge base
  app.post("/api/assistants/:id/files", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const assistant = await storage.getAssistant(id);
      if (!assistant) {
        return res.status(404).json({ message: "Assistant not found" });
      }

      if (!assistant.openaiAssistantId) {
        return res.status(400).json({ message: "Assistant not initialized with OpenAI" });
      }

      // Upload file to OpenAI and attach to this assistant's vector store
      const { openaiFileId, vectorStoreFileId } = await uploadFileToOpenAI(req.file.path, req.file.originalname);
      
      // Attach file to assistant (creates vector store if needed)
      await attachFileToAssistant(assistant.openaiAssistantId, openaiFileId);

      // Save file metadata with assistant reference
      const file = await storage.createFile({
        assistantId: id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        openaiFileId,
        openaiVectorStoreFileId: vectorStoreFileId,
        description: req.body.description || null,
      });

      res.json(file);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete file from assistant's knowledge base
  app.delete("/api/assistants/:id/files/:fileId", requireAdmin, async (req, res) => {
    try {
      const { id, fileId } = req.params;

      const assistant = await storage.getAssistant(id);
      if (!assistant) {
        return res.status(404).json({ message: "Assistant not found" });
      }

      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Verify file belongs to this assistant
      if (file.assistantId !== id) {
        return res.status(403).json({ message: "File does not belong to this assistant" });
      }

      // Remove from OpenAI assistant's vector store
      if (assistant.openaiAssistantId && file.openaiFileId) {
        await removeFileFromAssistant(assistant.openaiAssistantId, file.openaiFileId);
      }

      // Delete local file
      const filePath = path.join(uploadsDir, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete from database (cascade handled by FK constraint)
      await storage.deleteFile(fileId);
      
      res.json({ message: "File deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User Assistant Access Routes (For regular users)
  app.get("/api/my-assistants", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const assistants = await storage.getUserAssistantAccess(user.id);
      res.json(assistants);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });


  // Get vector store status (authenticated users only)
  app.get("/api/vector-store", requireAuth, async (req, res) => {
    try {
      const vectorStore = await storage.getVectorStore();
      if (!vectorStore) {
        return res.json(null);
      }

      const fileCount = await getVectorStoreFileCount(vectorStore.openaiVectorStoreId);
      await storage.updateVectorStore(vectorStore.id, { fileCount });

      res.json(vectorStore);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all sessions for the current user
  app.get("/api/sessions", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { assistantId, isTest } = req.query;
      
      const sessions = await storage.getSessions(
        user.id, 
        assistantId as string | undefined,
        isTest !== undefined ? parseInt(isTest as string) : undefined
      );
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new session for the current user
  app.post("/api/sessions", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { title, assistantId, isTest } = req.body;
      
      if (assistantId) {
        const hasAccess = await storage.hasUserAssistantAccess(user.id, assistantId);
        if (!hasAccess && user.role !== "admin") {
          return res.status(403).json({ message: "You don't have access to this assistant" });
        }
      }
      
      const session = await storage.createSession({
        title: title || "New Conversation",
        userId: user.id,
        assistantId: assistantId || null,
        isTest: isTest || 0,
      });
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update a session (authenticated users only)
  app.patch("/api/sessions/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const isOwner = await verifySessionOwnership(req.params.id, user.id);
      if (!isOwner) {
        return res.status(404).json({ message: "Session not found" });
      }

      const session = await storage.updateSession(req.params.id, {
        title: req.body.title,
      });
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a session (authenticated users only)
  app.delete("/api/sessions/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const isOwner = await verifySessionOwnership(req.params.id, user.id);
      if (!isOwner) {
        return res.status(404).json({ message: "Session not found" });
      }

      await storage.deleteSession(req.params.id);
      res.json({ message: "Session deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get messages for a session (authenticated users only)
  app.get("/api/sessions/:sessionId/messages", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const isOwner = await verifySessionOwnership(req.params.sessionId, user.id);
      if (!isOwner) {
        return res.status(404).json({ message: "Session not found" });
      }

      const messages = await storage.getMessages(req.params.sessionId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send a chat message (with streaming) - authenticated users only
  app.post("/api/sessions/:sessionId/chat", requireAuth, async (req, res) => {
    try {
      const { message } = req.body;
      const { sessionId } = req.params;
      const user = req.user as User;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }

      // Verify session ownership
      const isOwner = await verifySessionOwnership(sessionId, user.id);
      if (!isOwner) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Get the session to find which assistant to use
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (!session.assistantId) {
        return res.status(400).json({ message: "No assistant selected for this session" });
      }

      // Get the assistant to use its configuration
      const assistant = await storage.getAssistant(session.assistantId);
      if (!assistant) {
        return res.status(404).json({ message: "Assistant not found" });
      }

      // Save user message
      await storage.createMessage({
        sessionId,
        role: "user",
        content: message,
        citations: null,
      });

      // Use the Responses API with file search
      const result = await chatWithFilesearch(
        message,
        assistant.openaiVectorStoreId,
        session.responseId || undefined,
        assistant.instructions
      );

      // Always update session with latest response ID for conversation continuity
      if (result.responseId) {
        await storage.updateSession(sessionId, { responseId: result.responseId });
      }

      // Save assistant message with citations
      await storage.createMessage({
        sessionId,
        role: "assistant",
        content: result.content,
        citations: result.citations.length > 0 ? result.citations : null,
      });

      res.json({
        content: result.content,
        citations: result.citations || [],
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clear messages in a session (authenticated users only)
  app.delete("/api/sessions/:sessionId/messages", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const isOwner = await verifySessionOwnership(req.params.sessionId, user.id);
      if (!isOwner) {
        return res.status(404).json({ message: "Session not found" });
      }

      await storage.clearMessages(req.params.sessionId);
      res.json({ message: "Chat history cleared" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Export session as JSON or Markdown (authenticated users only)
  app.get("/api/sessions/:sessionId/export", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const format = (req.query.format as string) || "json";
      const user = req.user as User;

      // Verify session ownership
      const isOwner = await verifySessionOwnership(sessionId, user.id);
      if (!isOwner) {
        return res.status(404).json({ message: "Session not found" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const messages = await storage.getMessages(sessionId);

      if (format === "json") {
        const exportData = {
          session: {
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          },
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            citations: msg.citations,
            timestamp: msg.timestamp,
          })),
          exportedAt: new Date(),
        };

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="conversation-${sessionId}.json"`);
        res.json(exportData);
      } else if (format === "markdown" || format === "md") {
        let markdown = `# ${session.title}\n\n`;
        markdown += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n`;
        markdown += `**Last Updated:** ${new Date(session.updatedAt).toLocaleString()}\n\n`;
        markdown += `---\n\n`;

        for (const msg of messages) {
          const timestamp = new Date(msg.timestamp).toLocaleString();
          const role = msg.role === "user" ? "👤 User" : "🤖 Assistant";
          
          markdown += `### ${role} (${timestamp})\n\n`;
          markdown += `${msg.content}\n\n`;
          
          if (msg.citations) {
            markdown += `*Citations: ${JSON.stringify(msg.citations)}*\n\n`;
          }
          
          markdown += `---\n\n`;
        }

        markdown += `\n*Exported on ${new Date().toLocaleString()}*\n`;

        res.setHeader("Content-Type", "text/markdown");
        res.setHeader("Content-Disposition", `attachment; filename="conversation-${sessionId}.md"`);
        res.send(markdown);
      } else if (format === "txt" || format === "text") {
        let text = `${session.title}\n`;
        text += `${"=".repeat(session.title.length)}\n\n`;
        text += `Created: ${new Date(session.createdAt).toLocaleString()}\n`;
        text += `Last Updated: ${new Date(session.updatedAt).toLocaleString()}\n\n`;
        text += `${"-".repeat(60)}\n\n`;

        for (const msg of messages) {
          const timestamp = new Date(msg.timestamp).toLocaleString();
          const role = msg.role === "user" ? "USER" : "ASSISTANT";
          
          text += `[${role}] ${timestamp}\n`;
          text += `${msg.content}\n`;
          
          if (msg.citations) {
            text += `Citations: ${JSON.stringify(msg.citations)}\n`;
          }
          
          text += `\n${"-".repeat(60)}\n\n`;
        }

        text += `\nExported on ${new Date().toLocaleString()}\n`;

        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Content-Disposition", `attachment; filename="conversation-${sessionId}.txt"`);
        res.send(text);
      } else {
        res.status(400).json({ message: "Invalid format. Use 'json', 'markdown', or 'text'" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
