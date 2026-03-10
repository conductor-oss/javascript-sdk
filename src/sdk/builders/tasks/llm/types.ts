// ── Enums ─────────────────────────────────────────────────────────

export enum Role {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
  TOOL_CALL = "tool_call",
  TOOL = "tool",
}

/** LLM provider identifiers matching the Python SDK's LLMProvider enum. */
export enum LLMProvider {
  OPEN_AI = "openai",
  AZURE_OPEN_AI = "azure_openai",
  VERTEX_AI = "vertex_ai",
  HUGGING_FACE = "huggingface",
  ANTHROPIC = "anthropic",
  BEDROCK = "bedrock",
  COHERE = "cohere",
  GROK = "Grok",
  MISTRAL = "mistral",
  OLLAMA = "ollama",
  PERPLEXITY = "perplexity",
}

/** Vector database identifiers matching the Python SDK's VectorDB enum. */
export enum VectorDB {
  PINECONE_DB = "pineconedb",
  WEAVIATE_DB = "weaviatedb",
  POSTGRES_VECTOR_DB = "pgvectordb",
  MONGO_VECTOR_DB = "mongovectordb",
}

// ── Message & Tool Types ──────────────────────────────────────────

export interface ToolCall {
  name: string;
  taskReferenceName?: string;
  type?: string;
  inputParameters?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

export interface ChatMessage {
  role: Role;
  message: string;
  media?: string[];
  mimeType?: string;
  toolCalls?: ToolCall[];
}

export interface ToolSpec {
  name: string;
  type?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

// ── Model Types ───────────────────────────────────────────────────

export interface EmbeddingModel {
  provider: string;
  model: string;
}

export interface LlmCompletionParams {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopWords?: string[];
  maxResults?: number;
}

// ── Integration Config Types ──────────────────────────────────────

/** Base configuration for AI integrations. */
export interface IntegrationConfig {
  provider: string;
  description?: string;
  [key: string]: unknown;
}

/** OpenAI integration configuration. */
export interface OpenAIConfig extends IntegrationConfig {
  provider: "openai";
  apiKey: string;
  organizationId?: string;
}

/** Azure OpenAI integration configuration. */
export interface AzureOpenAIConfig extends IntegrationConfig {
  provider: "azure_openai";
  apiKey: string;
  endpoint: string;
  deploymentName?: string;
}

/** Weaviate vector database configuration. */
export interface WeaviateConfig extends IntegrationConfig {
  provider: "weaviatedb";
  apiKey: string;
  endpoint: string;
}

/** Pinecone vector database configuration. */
export interface PineconeConfig extends IntegrationConfig {
  provider: "pineconedb";
  apiKey: string;
  environment?: string;
  projectName?: string;
}
