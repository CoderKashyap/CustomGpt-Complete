import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

let openai: OpenAI | null = null;

function getOpenAIClient() {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

interface Citation {
  source: string;
  content: string;
  page?: number;
}

interface ChatResponse {
  content: string;
  citations: Citation[];
  responseId: string;
}

export async function chatWithFilesearch(
  userMessage: string,
  vectorStoreId: string | null,
  previousResponseId?: string,
  customInstructions?: string
): Promise<ChatResponse> {
  const client = getOpenAIClient();

  const tools: any[] = [];
  
  if (vectorStoreId) {
    tools.push({
      type: 'file_search',
      vector_store_ids: [vectorStoreId]
    });
  }

  const requestBody: any = {
    // model: 'gpt-4o',
    model: 'gpt-5',
    input: userMessage,
    store: true,
  };

  if (customInstructions) {
    requestBody.instructions = customInstructions;
  }

  if (tools.length > 0) {
    requestBody.tools = tools;
  }

  if (previousResponseId) {
    requestBody.previous_response_id = previousResponseId;
  }

  const response = await (client as any).responses.create(requestBody);

  const content = response.output_text || '';
  const citations: Citation[] = [];

  if (response.output && Array.isArray(response.output)) {
    for (const outputItem of response.output) {
      if (outputItem.content && Array.isArray(outputItem.content)) {
        for (const contentItem of outputItem.content) {
          if (contentItem.text?.annotations && Array.isArray(contentItem.text.annotations)) {
            for (const annotation of contentItem.text.annotations) {
              if (annotation.type === 'file_citation') {
                citations.push({
                  source: annotation.file_citation?.file_id || 'Document',
                  content: annotation.file_citation?.quote || annotation.text || '',
                  page: undefined
                });
              }
            }
          }
        }
      }
    }
  }

  return {
    content,
    citations,
    responseId: response.id
  };
}

export async function uploadFileForChat(filePath: string, filename: string): Promise<string> {
  const client = getOpenAIClient();
  const fs = await import('fs');
  
  const fileStream = fs.createReadStream(filePath);
  const file = await client.files.create({
    file: fileStream,
    purpose: 'assistants',
  });
  
  return file.id;
}

export async function deleteFileFromChat(fileId: string): Promise<void> {
  const client = getOpenAIClient();
  await client.files.delete(fileId);
}

export async function createVectorStoreForAssistant(
  assistantId: string,
  fileIds: string[]
): Promise<string> {
  const client = getOpenAIClient();
  
  const vectorStore = await (client as any).beta.vectorStores.create({
    name: `Assistant ${assistantId} Knowledge Base`,
    file_ids: fileIds,
    chunking_strategy: {
      type: "static",
      static: {
        max_chunk_size_tokens: 2000,
        chunk_overlap_tokens: 400
      }
    }
  });
  
  return vectorStore.id;
}

export async function addFilesToVectorStore(
  vectorStoreId: string,
  fileIds: string[]
): Promise<void> {
  const client = getOpenAIClient();
  
  await (client as any).beta.vectorStores.fileBatches.createAndPoll(vectorStoreId, {
    file_ids: fileIds,
    chunking_strategy: {
      type: "static",
      static: {
        max_chunk_size_tokens: 2000,
        chunk_overlap_tokens: 400
      }
    }
  });
}

export async function removeFileFromVectorStore(
  vectorStoreId: string,
  fileId: string
): Promise<void> {
  const client = getOpenAIClient();
  
  await (client as any).beta.vectorStores.files.del(vectorStoreId, fileId);
}
