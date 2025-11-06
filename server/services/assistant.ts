import OpenAI from "openai";
// import type { Assistant } from "@shared/schema";
import dotenv from 'dotenv';
dotenv.config();

let openaiClient: OpenAI | null = null;

// Centralized chunking strategy configuration
// Larger chunks (2000 tokens) provide better context retention for complex documents
// 400 token overlap ensures continuity between chunks
// export const CHUNKING_STRATEGY = {
//   type: "static" as const,
//   static: {
//     max_chunk_size_tokens: 2000,
//     chunk_overlap_tokens: 400
//   }
// };

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

export async function createOpenAIAssistant(
  name: string,
  instructions: string,
  model: string = "gpt-4o"
): Promise<string> {
  const openai = getOpenAIClient();

  const assistant = await openai.beta.assistants.create({
    name,
    instructions,
    model,
    tools: [{ type: "file_search" }],
  });

  return assistant.id;
}

export async function updateOpenAIAssistant(
  assistantId: string,
  updates: {
    name?: string;
    instructions?: string;
    model?: string;
  }
): Promise<void> {
  const openai = getOpenAIClient();
  await openai.beta.assistants.update(assistantId, updates);
}

export async function deleteOpenAIAssistant(assistantId: string): Promise<void> {
  const openai = getOpenAIClient();
  await openai.beta.assistants.delete(assistantId);
}

export async function attachFileToAssistant(
  assistantId: string,
  openaiFileId: string
): Promise<void> {
  const openai = getOpenAIClient();

  // Retrieve the assistant to get existing vector store
  const assistant = await openai.beta.assistants.retrieve(assistantId);
  let vectorStoreId = assistant.tool_resources?.file_search?.vector_store_ids?.[0];

  // Create a vector store if one doesn't exist
  if (!vectorStoreId) {
    console.log(`Creating new vector store for assistant ${assistantId}`);

    // Create vector store - vectorStores is at the root level, not under beta
    // @ts-ignore - vectorStores is available but not in type definitions
    const vectorStore = await (openai as any).vectorStores.create({
      name: `${assistant.name} Knowledge Base`,
      chunking_strategy: {
        type: "static",
        static: {
          max_chunk_size_tokens: 2000,
          chunk_overlap_tokens: 400
        }
      }
    });

    vectorStoreId = vectorStore.id;

    if (!vectorStoreId) {
      throw new Error("Failed to create vector store: No ID returned");
    }

    // Link the vector store to the assistant
    await openai.beta.assistants.update(assistantId, {
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStoreId],
        },
      },
    });

    console.log(`Created vector store ${vectorStoreId} for assistant ${assistantId}`);
  }

  // Add the file to the vector store using file batches API
  // @ts-ignore - vectorStores is available but not in type definitions
  const fileBatch = await (openai as any).vectorStores.fileBatches.createAndPoll(vectorStoreId, {
    file_ids: [openaiFileId],
    chunking_strategy: {
      type: "static",
      static: {
        max_chunk_size_tokens: 2000,
        chunk_overlap_tokens: 400
      }
    }
  });

  console.log(`Added file ${openaiFileId} to vector store ${vectorStoreId}, batch status: ${fileBatch.status}`);
}

export async function removeFileFromAssistant(
  assistantId: string,
  openaiFileId: string
): Promise<void> {
  const openai = getOpenAIClient();
  const assistant = await openai.beta.assistants.retrieve(assistantId);
  const vectorStoreIds = assistant.tool_resources?.file_search?.vector_store_ids || [];

  // Find and delete the file from the vector store
  for (const vectorStoreId of vectorStoreIds) {
    try {
      // @ts-ignore - vectorStores is available but not in type definitions
      const files = await (openai as any).vectorStores.files.list(vectorStoreId);

      const fileToDelete = files.data.find((f: any) => f.id === openaiFileId);

      if (fileToDelete) {
        // @ts-ignore - vectorStores is available but not in type definitions
        await (openai as any).vectorStores.files.del(vectorStoreId, fileToDelete.id);
        console.log(`Removed file ${openaiFileId} from vector store ${vectorStoreId}`);
        break;
      }
    } catch (error) {
      console.error(`Error removing file from vector store ${vectorStoreId}:`, error);
    }
  }
}

export async function chatWithAssistant(
  assistantId: string,
  message: string,
  threadId?: string
): Promise<{ response: string; threadId: string; citations?: any[] }> {
  const openai = getOpenAIClient();
  let currentThreadId = threadId;

  if (!currentThreadId) {
    const thread = await openai.beta.threads.create();
    currentThreadId = thread.id;
  }

  await openai.beta.threads.messages.create(currentThreadId, {
    role: "user",
    content: message,
  });

  const run = await openai.beta.threads.runs.createAndPoll(currentThreadId, {
    assistant_id: assistantId,
  });

  if (run.status === "completed") {
    const messages = await openai.beta.threads.messages.list(currentThreadId);
    const lastMessage = messages.data[0];

    if (lastMessage.content[0].type === "text") {
      const textContent = lastMessage.content[0].text;
      return {
        response: textContent.value,
        threadId: currentThreadId,
        citations: textContent.annotations,
      };
    }
  }

  throw new Error(`Run failed with status: ${run.status}`);
}
