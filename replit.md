# AI Assistant Platform

## Overview

The AI Assistant Platform is a multi-user document analysis application with role-based access control. It enables admin users to create custom AI assistants with unlimited PDF uploads, building specialized knowledge bases. Regular users interact with these AI assistants via a chat interface to get answers based on the uploaded documents, complete with source citations. The system leverages OpenAI's Assistant API and vector store for intelligent, citation-backed responses, and has been updated to use the OpenAI Responses API for streamlined conversations. The platform aims to provide a robust, scalable solution for creating and deploying specialized AI knowledge agents.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite.
- **UI Component System**: shadcn/ui with Radix UI primitives and Tailwind CSS for styling, using the "new-york" style variant.
- **State Management**: TanStack Query for server state, data fetching, and caching. No global client state management.
- **Routing**: Wouter for client-side routing, with protected routes for authentication and role-based access.
- **Styling**: Tailwind CSS with CSS variables for theming, supporting light/dark modes.

### Backend Architecture
- **Server Framework**: Express.js on Node.js with TypeScript (ESM).
- **API Design**: RESTful API for authentication, user management, assistant management (including per-assistant file management and user-assistant access), vector store management, and chat interactions.
- **Development Architecture**: Vite middleware for HMR in development; static file serving in production.
- **File Upload**: Multer handles multipart form data for PDF uploads (10MB limit, PDF-only).

### Data Storage
- **Primary Database**: PostgreSQL via Drizzle ORM and Neon serverless driver.
- **Database Schema**: Includes tables for users, assistants, uploaded files (one-to-many with assistants), user-assistant access, chat sessions, and chat messages (with JSONB for citations).
- **Fallback Storage**: In-memory storage (`MemStorage`) for development/testing.
- **Authentication & Authorization**: Passport.js with local strategy, bcrypt for password hashing, Express-session. Role-based access control (`admin`, `user`) with `requireAuth` and `requireAdmin` middleware.

### Key Architectural Decisions
- **PDF Processing Flow**: Admins upload PDFs directly to specific assistants. Files are stored locally, uploaded to OpenAI File API, and added to the assistant's dedicated OpenAI Vector Store for indexing and RAG. Files are isolated per assistant.
- **Multi-Assistant Chat Architecture**: Users select from accessible assistants. Each assistant has custom instructions, an isolated knowledge base via a dedicated vector store, and uses the OpenAI Responses API with `previous_response_id` for conversation continuity.
- **Type Safety Strategy**: Shared TypeScript types, Drizzle-Zod for runtime validation, and path aliases.
- **Separation of Concerns**: Clear division into `/client`, `/server`, and `/shared` directories.
- **Environment Configuration**: Uses `DATABASE_URL`, `OPENAI_API_KEY`, `SESSION_SECRET`, and `NODE_ENV`.

### Security Architecture
- **Role-Based Access Control**: `admin` for management, `user` for chat. New users default to `user`. Admin promotion via specific endpoint. User-assistant access controlled by junction table.
- **Authentication Security**: bcrypt for password hashing, secure session secret, authenticated and admin-only route protection.
- **Data Isolation**: Chat sessions isolated by `userId`. User-assistant access controlled. Each assistant has its own isolated knowledge base.

## External Dependencies

- **OpenAI Integration**:
    - Responses API for chat with `file_search` tool and citation-backed answers.
    - Vector Store API for document indexing and semantic search per assistant.
    - Assistant API (used only for vector store management).
    - File API for document upload and management.
- **Database**:
    - Neon PostgreSQL via `@neondatabase/serverless`.
    - Drizzle ORM for database interactions.
- **File Storage**: Local filesystem (`/uploads` directory) for temporary PDF storage before OpenAI processing.
- **Build & Development Tools**:
    - Vite for frontend bundling and development server.
    - esbuild for backend bundling.
```