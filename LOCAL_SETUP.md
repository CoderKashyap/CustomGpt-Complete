# Local Development Setup

This guide will help you run the AI Assistant Platform on your local machine.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or cloud-based like Neon)
- OpenAI API key

## Environment Setup

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Configure your `.env` file:**
   ```env
   # OpenAI Configuration (REQUIRED)
   OPENAI_API_KEY=sk-your-actual-openai-api-key

   # Database Configuration (REQUIRED for production)
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname

   # Session Secret (REQUIRED for production)
   SESSION_SECRET=your-secure-random-string-at-least-32-characters

   # Server Port (OPTIONAL - defaults to 5000)
   PORT=5000
   ```

3. **Generate a secure session secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up the database:**
   ```bash
   npm run db:push
   ```

## Running the Application

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Access the application:**
   Open your browser to `http://localhost:5000`

## File Upload Directory

The application automatically creates an `uploads/` directory in the project root for storing uploaded PDF files temporarily before they are sent to OpenAI. This directory is created automatically when the server starts.

## Environment Variables Explained

### OPENAI_API_KEY (Required)
Your OpenAI API key for accessing GPT models and vector store features.
- Get your key from: https://platform.openai.com/api-keys

### DATABASE_URL (Required for production)
PostgreSQL connection string. If not set, the application will use in-memory storage (data will be lost on restart).
- Format: `postgresql://user:password@host:port/database`
- For local PostgreSQL: `postgresql://postgres:password@localhost:5432/ai_assistant`
- For Neon: Get from your Neon dashboard

### SESSION_SECRET (Required for production)
Secret key for encrypting session cookies. Must be a secure random string.
- Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Keep this secret and never commit it to version control

### PORT (Optional)
The port number the server will listen on. Defaults to 5000.

## Troubleshooting

### "No such file or directory" error for uploads
This error means the uploads directory doesn't exist. The application should create it automatically, but if you encounter this error:
```bash
mkdir uploads
```

### "DATABASE_URL environment variable is not set"
Make sure you have a `.env` file in the project root with the DATABASE_URL configured.

### "OPENAI_API_KEY is not set"
Make sure your `.env` file includes a valid OpenAI API key.

### TypeScript errors
If you encounter TypeScript errors during development:
```bash
npm run build
```

## Production Deployment

For production deployment:

1. Set all environment variables in your hosting platform
2. Use a production-grade PostgreSQL database
3. Use a secure, randomly generated SESSION_SECRET
4. Set NODE_ENV=production
5. Consider using Redis for session storage instead of MemoryStore

## Support

For issues or questions, refer to the main README.md or replit.md documentation.
