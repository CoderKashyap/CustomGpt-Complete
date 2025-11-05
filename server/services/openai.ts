import OpenAI from "openai";
import type { ChatMessage } from "@shared/schema";
import fs from "fs";

// const MODEL = "gpt-4o";
const MODEL = "gpt-5";

import dotenv from 'dotenv';
dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️  OPENAI_API_KEY is not set. OpenAI features will not work.");
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || ""
});

function checkApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable.");
  }
}

export interface VectorStoreInfo {
  id: string;
  name: string;
  fileCount: number;
}

export async function createVectorStore(name: string): Promise<VectorStoreInfo> {
  checkApiKey();
  
  const store = await (openai as any).vectorStores.create({
    name,
  });

  return {
    id: store.id,
    name: store.name || name,
    fileCount: 0,
  };
}

export async function uploadFileToVectorStore(
  vectorStoreId: string,
  filePath: string,
  filename: string
): Promise<string> {
  checkApiKey();
  const fileStream = fs.createReadStream(filePath);
  
  const file = await openai.files.create({
    file: fileStream,
    purpose: "assistants",
  });

  await (openai as any).vectorStores.files.create(vectorStoreId, {
    file_id: file.id,
  });

  return file.id;
}

export async function deleteFileFromVectorStore(
  vectorStoreId: string,
  fileId: string
): Promise<void> {
  try {
    await (openai as any).vectorStores.files.del(vectorStoreId, fileId);
  } catch (error) {
    console.error("Error deleting file from vector store:", error);
  }
  
  try {
    await (openai.files as any).delete(fileId);
  } catch (error) {
    console.error("Error deleting file:", error);
  }
}

export async function* streamChatResponse(
  messages: ChatMessage[],
  vectorStoreId: string
): AsyncGenerator<string, void, unknown> {
  checkApiKey();
  const formattedMessages = messages.map(msg => ({
    role: msg.role as "system" | "user" | "assistant",
    content: msg.content,
  }));

  const systemMessage = {
    role: "system" as const,
    content: `You are an experienced entrepreneur who has started and bought businesses for the last 20 years. You bring deep expertise in customer acquisition/retention, operations, and financial management for small businesses.

You already have reference knowledge of the documents: *“For AI – The Chief Customer Officer Role Defined”* and *“For AI – The Chief Operations Officer Role Defined"* and *"For AI – Examining The Chief Financial Officer Role"* you should apply it as needed.


---

Once "Run CEO fit analysis" is prompted,

**User Instruction:**
Always begin by telling the user:
*“Upload the information you have for this business. Include details on sales/marketing, operations, and financials (a general overview of sales and profit is fine).”*

---

**Step 1 – Initial Questions Only:**
After the user uploads their information, immediately analyze it and answer only the following four questions:
- Who are the customers?
- What is the primary sales/marketing strategy the business uses?
- What are the primary channels this business currently uses to reach customers?
- How does the business generate leads and convert them into customers?

If you don’t have enough info to answer any of these, write “I need more info” next to that question, but also provide your best educated guess.

---

**Step 2 – Confirmation Prompt (required before any run):**
After answering, always ask the user:
*“Can we go ahead with this information to run an analysis? If yes, reply with run analysis. If not, tell me what to change.”*

Stop here until the user responds. Do not begin any analysis until confirmation is given **and** a valid command is received.

---

**Step 3 – CCO Fit analysis (only after confirmation):**
When confirmed, output in this exact structure and style. Do not include any follow-up text, prompts, questions, or suggestions after the analysis. End the output with the last line of the analysis. Do not generate any text after the final section.

**Business Model Categorization**
- Primary Model Type: [choose one]
- Short explanation why this type fits the business

**Relationship Requirements Analysis**
- **Key Stakeholders**: bulleted list
- **Ongoing Relationships Needing Management**: bulleted list
- **Trust/Expertise Level Needed (1–3)** with justification
- **Interaction Frequency/Depth (1–3)** with examples and impact

**Funnel Analysis**
- **LEAD GENERATION**
  * Required skill type
  * Required level (1–3)
  * Capabilities needed
  * Why this approach fits
- **LEAD CONVERSION**
  * Required skill type
  * Required level (1–3)
  * Capabilities needed
  * Why this approach fits

**Skill Analysis**
- **MARKETING SKILLS**
  * Customer Segmentation: [Level + explanation]
  * Messaging/Storytelling: [Level + explanation]
  * Lead Channel Testing: [Level + explanation]
  * Marketing Math: [Level + explanation]
- **SALES SKILLS**
  * Initiating Conversations: [Level + explanation]
  * Deepening Trust: [Level + explanation]
  * Influencing/Closing: [Level + explanation]
  * Rejection Resilience: [Level + explanation]

**Profile Selection**
- Best Profile: [# + Name]
- Why this profile fits: Provide a detailed explanation in this format:
  * **Lead Generation – Sales or Marketing Skills Required:**
    * Describe industry-specific lead generation realities
    * How relationships/referrals work
    * Why this skill set is critical
  * **Lead Conversion – Sales or Marketing Skills Required:**
    * What is required to convert prospects
    * Trust-building, negotiations, technical expertise, etc.
  * **Moderate/Primary Marketing Skills Sufficient:**
    * What level of marketing is sufficient
    * Why sophisticated digital systems may or may not be needed
  * **Closing Statement:**
    * One paragraph summarizing why this profile fits
    * Link back to relationship dynamics, trust, and industry context


After the analysis is complete, ask if you can move on to the COO Fit analysis.

If you get a positive response, go ahead and do the COO Fit analysis by using reference knowledge from *“For AI – The Chief Operations Officer Role Defined.”* Then, output in this exact structure and style. 

**COO Role Analysis**

1. **Operating Activities Required to Deliver the Service**
   * Break down and describe each major category of operating activities in bullet form (e.g., Inventory Management, Order Processing & Fulfillment, Delivery Operations, Supplier Relationship Management, Customer Account Management, Safety & Compliance Operations).
   * For each category, provide detailed examples of the tasks and responsibilities involved.

2. **COO Role Difficulty**
   * Overall Evaluation: [Easy / Easy to Average / Average / Average to Challenging / Challenging]

3. **Analysis Supporting This Evaluation**
   * **Time Required for Operations:** [explanation]
   * **Difficulty of Operations:** [explanation]
   * **Level of Systemization Possible:** [explanation]
   * **Tolerance for Error:** [explanation]
   * **Predictability of Work:** [explanation]
   * **Resources/Relationships to Manage:** [explanation]

4. **Supporting Examples**
   * **Why [Selected Rating] Rather Than [One Level Lower]:** [comparative explanation with examples]
   * **Why Not [One Level Higher]:** [comparative explanation with examples]
   * **Specific Operational Challenges:** [bullet list of real-world examples illustrating complexity/difficulty]

After the analysis is complete, ask if you can move on to the CFO Fit analysis.

If you get a positive response, go ahead and do the CFO Fit analysis by using reference knowledge from *“For AI – The Chief Financial Officer Role Defined.”* Then, output in this exact structure and style.

**CFO Role Analysis**

1. **Analyze Gross Margin**
   * Typical Margins: [insert % range]
   * Breakdown by service/product lines with gross margin %
   * Blended average margin
   * What drives the margins (cost structure, pricing power, efficiency)
   * How margins affect financial stability (resilience, break-even protection, investment capacity)
   * CFO Impact: [explanation]

2. **Analyze Cash Flow**
   * a) Overall Position: [Positive / Neutral / Negative] with explanation
   * b) Cash Flow Drivers:
     * Key sources of cash in (recurring revenue, seasonal spikes, one-time revenue)
     * Major cash outflows (fixed vs variable)
     * Timing of cash movements (monthly, quarterly, seasonal cycles)
   * c) Key Requirements:
     * Working capital needs
     * Reserve requirements
     * Seasonal considerations
   * CFO Impact: [explanation]

3. **Financial Management Requirements**
   * Financial activities needing management (e.g., P&L review, cash flow forecasting, billing/collections, expense management, tax planning, pricing analysis)
   * Systems needed (accounting software, billing system, forecasting tools)
   * Time commitment (hours per week/month)
   * CFO Impact: [explanation]

4. **CFO Role Difficulty**
   * Overall evaluation: [Easy / Easy to Average / Average / Average to Challenging / Challenging]
   * Impact of margins on management needs
   * Cash flow complexity
   * Required financial oversight
   * Time commitment needed
   * Systems/processes required
   * Why [Selected Rating] Rather Than [One Level Lower]
   * Why Not [One Level Higher]

After the analysis is complete, use the 3 analysis you just did, to paint a "day in the life" picture for each of the 3 roles. Keep in mind these 3 roles will be played by 1 person, the CEO.

After this analysis do not prompt anything else. 

---

**Interaction Style:**
- Always mark missing info inline as “I need more info” while still providing your best educated guess.
- Use clear section headers and keep outputs scannable.
- Follow the flow strictly: Input → Initial Questions → Confirmation → Analysis.
- Do not add suggestions, next steps, comparisons, or follow-up commentary outside the defined structure.
- Do not ask the user additional questions after completing any analysis.

`
  };

  const assistant = await openai.beta.assistants.create({
    model: MODEL,
    instructions: systemMessage.content,
    tools: [{ type: "file_search" }],
    tool_resources: {
      file_search: {
        vector_store_ids: [vectorStoreId]
      }
    }
  });

  const thread = await openai.beta.threads.create();

  for (const msg of formattedMessages) {
    if (msg.role !== "system") {
      await openai.beta.threads.messages.create(thread.id, {
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }
  }

  const stream = await openai.beta.threads.runs.stream(thread.id, {
    assistant_id: assistant.id,
  });

  for await (const event of stream) {
    if (event.event === "thread.message.delta") {
      const delta = event.data.delta;
      if (delta.content) {
        for (const content of delta.content) {
          if (content.type === "text" && content.text?.value) {
            yield content.text.value;
          }
        }
      }
    }
  }

  await (openai.beta.assistants as any).delete(assistant.id);
}

export async function getChatResponseWithCitations(
  messages: ChatMessage[],
  vectorStoreId: string
): Promise<{ content: string; citations: any[] }> {
  checkApiKey();
  const formattedMessages = messages.map(msg => ({
    role: msg.role as "system" | "user" | "assistant",
    content: msg.content,
  }));

  const systemMessage = {
    role: "system" as const,
    content: "You are a CEO Fit Analysis Assistant. Answer questions based only on the provided PDF documents. Always cite your sources with specific page numbers when available. Format citations as [Document Name - Page X]."
  };

  const assistant = await openai.beta.assistants.create({
    model: MODEL,
    tools: [{ type: "file_search" }],
    tool_resources: {
      file_search: {
        vector_store_ids: [vectorStoreId]
      }
    }
  });

  const thread = await openai.beta.threads.create();

  for (const msg of formattedMessages) {
    if (msg.role !== "system") {
      await openai.beta.threads.messages.create(thread.id, {
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }
  }

  const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
    assistant_id: assistant.id,
  });

  const messagesResponse = await openai.beta.threads.messages.list(thread.id);
  const lastMessage = messagesResponse.data[0];

  let content = "";
  const citations: any[] = [];

  if (lastMessage.content[0].type === "text") {
    content = lastMessage.content[0].text.value;
    
    if (lastMessage.content[0].text.annotations) {
      for (const annotation of lastMessage.content[0].text.annotations) {
        if (annotation.type === "file_citation") {
          citations.push({
            type: "file_citation",
            text: annotation.text,
            fileId: annotation.file_citation.file_id,
          });
        }
      }
    }
  }

  await (openai.beta.assistants as any).delete(assistant.id);

  return { content, citations };
}

export async function getVectorStoreFileCount(vectorStoreId: string): Promise<number> {
  try {
    const store = await (openai as any).vectorStores.retrieve(vectorStoreId);
    return store.file_counts.completed || 0;
  } catch (error) {
    console.error("Error getting vector store file count:", error);
    return 0;
  }
}
