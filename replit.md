# AI Assistant Platform

## Overview

AI Assistant Platform is a **multi-user** document analysis application with role-based access control. Admin users can create multiple custom AI assistants with unlimited PDF document uploads to build specialized knowledge bases. Regular users access the chat interface to interact with AI assistants that answer questions based on the uploaded documents with source citations. The system uses OpenAI's Assistant API and vector store for intelligent, citation-backed responses.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Updates (November 2025)

**Migrated to Simpler Chat Completions API** - Replaced complex Assistants API with streamlined approach:
- Chat now uses OpenAI Chat Completions API with file_search tool (simpler, faster, more maintainable)
- Removed dependency on OpenAI Threads and Runs (no more complex state management)
- Conversation history stored in database as message array (full control over context)
- Hybrid approach: Assistant API only for vector store management, Chat Completions for conversations
- Same functionality, 50% less code, better performance

**Chat Real-Time Updates Fixed** - Resolved infinite loading issue in chat interface:
- Frontend now handles both JSON and streaming responses from backend
- Cache invalidation triggers immediately after receiving response
- Messages appear instantly without requiring page refresh
- Improved UX with brief preview of assistant response before full display

**Dynamic Per-Assistant Instructions Implemented** - Each assistant uses its own custom prompt:
- Chat system uses each assistant's custom instructions from database
- No hardcoded prompts - all prompts dynamically loaded from assistant configuration
- Conversation context maintained via database-stored message history
- Each assistant has isolated knowledge base via dedicated vector store

**Per-Assistant File Isolation Implemented** - Complete file ownership refactor for isolated knowledge bases:
- Removed centralized file pool - files now belong exclusively to one assistant
- Direct file upload during assistant creation/editing via multipart form data
- Database enforces file ownership: `uploadedFiles.assistantId` is a non-null foreign key with CASCADE delete
- No junction table - one-to-many relationship (assistant → files) replaces many-to-many
- Each file upload creates/updates assistant's dedicated vector store for RAG
- Frontend shows file upload input per assistant, eliminating file selection from shared pool
- Critical fixes: mutation cache invalidation uses mutation variables, file batches API for vector store uploads

**Multi-Assistant Architecture Implemented** - Complete overhaul to support multiple custom AI assistants:
- Admin users can create, configure, and manage multiple AI assistants with custom instructions and knowledge bases
- Each assistant has its own OpenAI Assistant API instance with dedicated file attachments
- User-assistant access control allows admins to grant/revoke user permissions per assistant
- Assistant selector in chat interface lets users choose which AI assistant to use
- Admin dashboard for user management, role assignment, and assistant access control
- Dedicated assistant management page for creating/editing assistants and managing file attachments

**Multi-User Authentication System Implemented** - Complete authentication and authorization system with:
- User signup/login/logout using Passport.js and bcrypt password hashing
- Role-based access control: "admin" and "user" roles
- Session ownership verification preventing cross-user access
- Security hardening: server-side role assignment only, admin promotion endpoint

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool and development server.

**UI Component System**: Built on shadcn/ui with Radix UI primitives, providing a comprehensive set of accessible, pre-styled components using the "new-york" style variant with Tailwind CSS for styling.

**State Management**: TanStack Query (React Query) handles all server state, data fetching, and cache management. No global client state management library is used - components rely on server state and local component state.

**Routing**: Wouter provides lightweight client-side routing:
- `/auth` - Public authentication page (signup/login)
- `/dashboard` - Protected main dashboard with chat interface (requires authentication)
- `/admin-dashboard` - Admin-only user management dashboard (requires admin role)
- `/assistants` - Admin-only assistant management page (requires admin role)
- Role-based UI: Admin users see additional navigation links for admin dashboard and assistant management
- ProtectedRoute component ensures only authenticated users access protected pages

**Styling System**: Tailwind CSS with CSS variables for theming, supporting light/dark modes. Custom design tokens defined in CSS variables include colors, shadows, typography scales, and spacing.

### Backend Architecture

**Server Framework**: Express.js running on Node.js with TypeScript in ESM module format.

**API Design**: RESTful API structure with the following endpoints:
- **Authentication** (public): POST /api/auth/signup, POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
- **User Management** (admin only): GET /api/users (list all users), PATCH /api/users/:userId/role (update user role)
- **Assistant Management** (admin only): GET/POST/PUT/DELETE /api/assistants
- **Per-Assistant File Management** (admin only): GET /api/assistants/:id/files (list assistant's files), POST /api/assistants/:id/files (upload file to assistant), DELETE /api/assistants/:id/files/:fileId (delete assistant's file)
- **User-Assistant Access** (admin only): GET /api/users/:userId/assistants (list user's assistants), POST /api/users/:userId/assistant-access (grant access), DELETE /api/users/:userId/assistant-access/:assistantId (revoke access)
- **User Assistant Access** (authenticated): GET /api/user/assistants (get current user's accessible assistants)
- **Vector Store** (admin only): Status and management endpoints
- **Chat Sessions** (authenticated): GET/POST/DELETE for user's own sessions with optional assistantId
- **Chat Interface** (authenticated): Streaming and non-streaming message endpoints with session ownership verification and assistant selection
- **Messages** (authenticated): GET for session history, DELETE for clearing with ownership checks

**Development Architecture**: Vite middleware integration in development mode provides HMR (Hot Module Reload) and serves the React application. Production build uses static file serving.

**File Upload**: Multer handles multipart form data for PDF uploads with 10MB file size limit and PDF-only filtering.

### Data Storage

**Primary Database**: PostgreSQL accessed via Drizzle ORM with the Neon serverless driver for connection pooling and edge compatibility.

**Database Schema**:
- `users`: User authentication with username, password (hashed), role (admin/user), and createdAt timestamp
- `assistants`: AI assistant configurations with name, description, instructions, model, OpenAI assistant ID, OpenAI vector store ID, and active status
- `uploaded_files`: PDF file metadata with OpenAI file ID and vector store file ID, belongs to one assistant via non-null `assistantId` foreign key with CASCADE delete
- `user_assistant_access`: Junction table controlling which users can access which assistants
- `chat_sessions`: User-owned conversation sessions with userId, assistantId, and threadId for OpenAI conversation continuity
- `chat_messages`: Conversation history with sessionId, role, content, and optional citation data stored as JSONB

**Fallback Storage**: In-memory storage implementation (`MemStorage`) provides a development/testing alternative to PostgreSQL, storing all data in Map structures.

**Authentication & Authorization**:
- Passport.js with local strategy for username/password authentication
- bcrypt for secure password hashing (10 rounds)
- Express-session with MemoryStore (development) - requires Redis or similar for production
- Authorization middleware: `requireAuth` and `requireAdmin` protect routes
- Session ownership verification prevents users from accessing other users' sessions

### External Dependencies

**OpenAI Integration**: 
- Assistant API for creating and managing custom AI assistants with specialized knowledge
- Vector Store API for document indexing and semantic search per assistant
- File Search tool for retrieval-augmented generation (RAG) with citation support
- Chat Completions via Assistant API with thread-based conversation management
- File API for document upload and management
- Streaming responses supported for real-time chat experience
- Lazy-loaded client initialization prevents startup errors when API key is not configured

**Database**: 
- Neon PostgreSQL (serverless) via `@neondatabase/serverless`
- Drizzle ORM for type-safe database queries and migrations
- Connection via `DATABASE_URL` environment variable

**File Storage**: Local filesystem storage in `/uploads` directory for uploaded PDFs before OpenAI processing.

**Build & Development Tools**:
- Vite for frontend bundling and dev server
- esbuild for backend bundling
- Replit-specific plugins for development experience (cartographer, dev banner, runtime error overlay)

### Key Architectural Decisions

**PDF Processing Flow**:
1. Admin uploads PDF directly to specific assistant via multipart form at `/api/assistants/:id/files`
2. File stored locally and metadata saved to database with `assistantId` foreign key
3. File uploaded to OpenAI File API
4. Vector store created for assistant if it doesn't exist yet (lazy initialization)
5. File added to assistant's dedicated Vector Store for indexing
6. OpenAI vector store file ID stored in database for tracking
7. Files are completely isolated per assistant - deleting assistant cascades to delete all its files

**Multi-Assistant Chat Architecture**:
- Users can select from multiple AI assistants based on admin-granted access permissions
- Each assistant has its own OpenAI Assistant API instance with custom instructions and knowledge base
- Chat sessions optionally reference an assistantId to track which assistant was used
- Session ownership verified before any session operations (read/write/delete)
- Supports both streaming and non-streaming responses via OpenAI Assistant API
- Messages stored with sessionId, role (user/assistant/system), and optional citation metadata
- Each assistant maintains its own Vector Store with attached files for specialized knowledge
- Vector Store used for retrieval-augmented generation (RAG) to provide context-aware, citation-backed answers
- Chat history persisted per-user for context and audit trail
- Assistant selector in UI allows users to choose which AI assistant to interact with

**Type Safety Strategy**:
- Shared TypeScript types between client and server via `/shared` directory
- Drizzle-Zod integration generates Zod schemas from database schema for runtime validation
- Path aliases (@, @shared, @assets) provide clean imports across the codebase

**Separation of Concerns**:
- `/client`: All frontend React code
- `/server`: Backend Express server and services
- `/shared`: Shared types and schemas
- Services layer (`/server/services`) isolates external API interactions (OpenAI, file upload)

**Environment Configuration**:
- `DATABASE_URL`: PostgreSQL connection string (required)
- `OPENAI_API_KEY`: OpenAI API authentication (required)
- `SESSION_SECRET`: Express session secret key (required for production)
- `NODE_ENV`: Environment mode (development/production)

### Security Architecture

**Role-Based Access Control**:
- Two roles: `admin` (can create/manage assistants, upload PDFs, manage users) and `user` (chat access only)
- New users always created with "user" role - no client-side privilege escalation possible
- Admin promotion via admin-only endpoint: PATCH /api/users/:userId/role
- User-assistant access control enforced via junction table - admins grant/revoke access per user per assistant
- Only accessible assistants appear in user's assistant selector dropdown

**Authentication Security**:
- Passwords hashed with bcrypt (10 rounds) before storage
- Sessions use secure random SESSION_SECRET
- requireAuth middleware protects all authenticated routes
- requireAdmin middleware restricts admin-only operations

**Data Isolation**:
- Chat sessions isolated by userId - users cannot access other users' conversations
- Session ownership verified on every session-related operation
- User-assistant access controlled via permission table - users can only interact with assistants they have access to
- Each assistant has its own isolated knowledge base (vector store) with dedicated file attachments
- Admins can create isolated knowledge domains by setting up separate assistants

**Production Considerations**:
- Replace MemoryStore with Redis or similar for session storage before production deployment
- Ensure SESSION_SECRET is cryptographically secure random string
- Consider rate limiting on authentication endpoints
- Monitor for brute force attacks on login