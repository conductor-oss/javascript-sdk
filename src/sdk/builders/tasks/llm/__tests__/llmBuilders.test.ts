import { describe, it, expect } from "@jest/globals";
import { llmChatCompleteTask } from "../llmChatComplete";
import { llmTextCompleteTask } from "../llmTextComplete";
import { llmGenerateEmbeddingsTask } from "../llmGenerateEmbeddings";
import { llmIndexTextTask } from "../llmIndexText";
import { llmIndexDocumentTask } from "../llmIndexDocument";
import { llmSearchIndexTask } from "../llmSearchIndex";
import { llmSearchEmbeddingsTask } from "../llmSearchEmbeddings";
import { llmStoreEmbeddingsTask } from "../llmStoreEmbeddings";
import { llmQueryEmbeddingsTask } from "../llmQueryEmbeddings";
import { generateImageTask } from "../generateImage";
import { generateAudioTask } from "../generateAudio";
import { callMcpToolTask } from "../callMcpTool";
import { listMcpToolsTask } from "../listMcpTools";
import { withPromptVariable, withPromptVariables } from "../promptHelpers";
import { LLMProvider, VectorDB, Role } from "../types";
import type { EmbeddingModel } from "../types";

// ── Enums ────────────────────────────────────────────────────────────

describe("LLMProvider enum", () => {
  it("should map OPEN_AI to 'openai'", () => {
    expect(LLMProvider.OPEN_AI).toBe("openai");
  });

  it("should map ANTHROPIC to 'anthropic'", () => {
    expect(LLMProvider.ANTHROPIC).toBe("anthropic");
  });

  it("should map BEDROCK to 'bedrock'", () => {
    expect(LLMProvider.BEDROCK).toBe("bedrock");
  });
});

describe("VectorDB enum", () => {
  it("should map PINECONE_DB to 'pineconedb'", () => {
    expect(VectorDB.PINECONE_DB).toBe("pineconedb");
  });

  it("should map WEAVIATE_DB to 'weaviatedb'", () => {
    expect(VectorDB.WEAVIATE_DB).toBe("weaviatedb");
  });

  it("should map POSTGRES_VECTOR_DB to 'pgvectordb'", () => {
    expect(VectorDB.POSTGRES_VECTOR_DB).toBe("pgvectordb");
  });

  it("should map MONGO_VECTOR_DB to 'mongovectordb'", () => {
    expect(VectorDB.MONGO_VECTOR_DB).toBe("mongovectordb");
  });
});

// ── llmChatCompleteTask ──────────────────────────────────────────────

describe("llmChatCompleteTask", () => {
  it("should create an LLM_CHAT_COMPLETE task with no options", () => {
    const task = llmChatCompleteTask("chat_ref", "openai", "gpt-4");
    expect(task).toEqual({
      name: "chat_ref",
      taskReferenceName: "chat_ref",
      type: "LLM_CHAT_COMPLETE",
      inputParameters: {
        llmProvider: "openai",
        model: "gpt-4",
      },
    });
  });

  it("should include messages when provided", () => {
    const messages = [
      { role: Role.SYSTEM, message: "You are a helpful assistant." },
      { role: Role.USER, message: "Hello" },
    ];
    const task = llmChatCompleteTask("chat_ref", "openai", "gpt-4", {
      messages,
    });
    expect(task).toEqual({
      name: "chat_ref",
      taskReferenceName: "chat_ref",
      type: "LLM_CHAT_COMPLETE",
      inputParameters: {
        llmProvider: "openai",
        model: "gpt-4",
        messages,
      },
    });
  });

  it("should include tools when provided", () => {
    const tools = [
      { name: "get_weather", description: "Get weather for a location" },
    ];
    const task = llmChatCompleteTask("chat_ref", "anthropic", "claude-3", {
      tools,
    });
    expect(task.inputParameters).toEqual(
      expect.objectContaining({ tools })
    );
  });

  it("should include instructionsTemplate and jsonOutput", () => {
    const task = llmChatCompleteTask("chat_ref", "openai", "gpt-4", {
      instructionsTemplate: "Answer questions about ${topic}",
      jsonOutput: true,
    });
    expect(task.inputParameters).toEqual(
      expect.objectContaining({
        instructionsTemplate: "Answer questions about ${topic}",
        jsonOutput: true,
      })
    );
  });
});

// ── llmTextCompleteTask ──────────────────────────────────────────────

describe("llmTextCompleteTask", () => {
  it("should create an LLM_TEXT_COMPLETE task with required args only", () => {
    const task = llmTextCompleteTask(
      "text_ref",
      "openai",
      "gpt-4",
      "my_prompt"
    );
    expect(task).toEqual({
      name: "text_ref",
      taskReferenceName: "text_ref",
      type: "LLM_TEXT_COMPLETE",
      inputParameters: {
        llmProvider: "openai",
        model: "gpt-4",
        promptName: "my_prompt",
      },
    });
  });

  it("should include promptVersion and jsonOutput when provided", () => {
    const task = llmTextCompleteTask(
      "text_ref",
      "openai",
      "gpt-4",
      "my_prompt",
      { promptVersion: 2, jsonOutput: true }
    );
    expect(task).toEqual({
      name: "text_ref",
      taskReferenceName: "text_ref",
      type: "LLM_TEXT_COMPLETE",
      inputParameters: {
        llmProvider: "openai",
        model: "gpt-4",
        promptName: "my_prompt",
        promptVersion: 2,
        jsonOutput: true,
      },
    });
  });
});

// ── llmGenerateEmbeddingsTask ────────────────────────────────────────

describe("llmGenerateEmbeddingsTask", () => {
  it("should create an LLM_GENERATE_EMBEDDINGS task with required args", () => {
    const task = llmGenerateEmbeddingsTask(
      "embed_ref",
      "openai",
      "text-embedding-ada-002",
      "some text to embed"
    );
    expect(task).toEqual({
      name: "embed_ref",
      taskReferenceName: "embed_ref",
      type: "LLM_GENERATE_EMBEDDINGS",
      inputParameters: {
        llmProvider: "openai",
        model: "text-embedding-ada-002",
        text: "some text to embed",
      },
    });
  });

  it("should include dimensions option when provided", () => {
    const task = llmGenerateEmbeddingsTask(
      "embed_ref",
      "openai",
      "text-embedding-3-small",
      "embed this",
      { dimensions: 256 }
    );
    expect(task.inputParameters).toEqual(
      expect.objectContaining({ dimensions: 256 })
    );
  });
});

// ── llmIndexTextTask ─────────────────────────────────────────────────

describe("llmIndexTextTask", () => {
  const embeddingModel: EmbeddingModel = {
    provider: "openai",
    model: "text-embedding-ada-002",
  };

  it("should create an LLM_INDEX_TEXT task and decompose embeddingModel", () => {
    const task = llmIndexTextTask(
      "index_ref",
      "pineconedb",
      "my_index",
      embeddingModel,
      "text to index",
      "doc-1"
    );
    expect(task).toEqual({
      name: "index_ref",
      taskReferenceName: "index_ref",
      type: "LLM_INDEX_TEXT",
      inputParameters: {
        vectorDB: "pineconedb",
        index: "my_index",
        embeddingModelProvider: "openai",
        embeddingModel: "text-embedding-ada-002",
        text: "text to index",
        docId: "doc-1",
      },
    });
  });

  it("should use vectorDB (uppercase) in inputParameters", () => {
    const task = llmIndexTextTask(
      "index_ref",
      "weaviatedb",
      "idx",
      embeddingModel,
      "hello",
      "doc-2"
    );
    expect(task.inputParameters).toEqual(
      expect.objectContaining({ vectorDB: "weaviatedb" })
    );
    expect((task.inputParameters as Record<string, unknown>).vectorDb).toBeUndefined();
  });

  it("should spread options like namespace and chunkSize", () => {
    const task = llmIndexTextTask(
      "index_ref",
      "pineconedb",
      "my_index",
      embeddingModel,
      "text",
      "doc-3",
      { namespace: "ns1", chunkSize: 500 }
    );
    expect(task.inputParameters).toEqual(
      expect.objectContaining({ namespace: "ns1", chunkSize: 500 })
    );
  });
});

// ── llmIndexDocumentTask ─────────────────────────────────────────────

describe("llmIndexDocumentTask", () => {
  const embeddingModel: EmbeddingModel = {
    provider: "openai",
    model: "text-embedding-ada-002",
  };

  it("should create an LLM_INDEX_TEXT task (same type as llmIndexTextTask)", () => {
    const task = llmIndexDocumentTask(
      "index_doc_ref",
      "pineconedb",
      "my_index",
      embeddingModel,
      "https://example.com/doc.pdf",
      "application/pdf"
    );
    expect(task).toEqual({
      name: "index_doc_ref",
      taskReferenceName: "index_doc_ref",
      type: "LLM_INDEX_TEXT",
      inputParameters: {
        vectorDB: "pineconedb",
        index: "my_index",
        embeddingModelProvider: "openai",
        embeddingModel: "text-embedding-ada-002",
        url: "https://example.com/doc.pdf",
        mediaType: "application/pdf",
      },
    });
  });

  it("should include url and mediaType in inputParameters", () => {
    const task = llmIndexDocumentTask(
      "index_doc_ref",
      "weaviatedb",
      "idx",
      embeddingModel,
      "https://example.com/file.txt",
      "text/plain"
    );
    expect(task.inputParameters).toEqual(
      expect.objectContaining({
        url: "https://example.com/file.txt",
        mediaType: "text/plain",
      })
    );
  });

  it("should spread optional docId and chunkSize", () => {
    const task = llmIndexDocumentTask(
      "index_doc_ref",
      "pineconedb",
      "idx",
      embeddingModel,
      "https://example.com/doc.pdf",
      "application/pdf",
      { docId: "doc-99", chunkSize: 1024 }
    );
    expect(task.inputParameters).toEqual(
      expect.objectContaining({ docId: "doc-99", chunkSize: 1024 })
    );
  });
});

// ── llmSearchIndexTask ───────────────────────────────────────────────

describe("llmSearchIndexTask", () => {
  const embeddingModel: EmbeddingModel = {
    provider: "openai",
    model: "text-embedding-ada-002",
  };

  it("should create an LLM_SEARCH_INDEX task with required args", () => {
    const task = llmSearchIndexTask(
      "search_ref",
      "pineconedb",
      "my_index",
      embeddingModel,
      "what is conductor?"
    );
    expect(task).toEqual({
      name: "search_ref",
      taskReferenceName: "search_ref",
      type: "LLM_SEARCH_INDEX",
      inputParameters: {
        vectorDB: "pineconedb",
        index: "my_index",
        embeddingModelProvider: "openai",
        embeddingModel: "text-embedding-ada-002",
        query: "what is conductor?",
      },
    });
  });

  it("should include maxResults option", () => {
    const task = llmSearchIndexTask(
      "search_ref",
      "pineconedb",
      "my_index",
      embeddingModel,
      "query text",
      { maxResults: 5 }
    );
    expect(task.inputParameters).toEqual(
      expect.objectContaining({ maxResults: 5 })
    );
  });
});

// ── llmSearchEmbeddingsTask ──────────────────────────────────────────

describe("llmSearchEmbeddingsTask", () => {
  it("should create an LLM_SEARCH_EMBEDDINGS task with number[] embeddings", () => {
    const embeddings = [0.1, 0.2, 0.3, 0.4];
    const task = llmSearchEmbeddingsTask(
      "search_embed_ref",
      "pineconedb",
      "my_index",
      embeddings
    );
    expect(task).toEqual({
      name: "search_embed_ref",
      taskReferenceName: "search_embed_ref",
      type: "LLM_SEARCH_EMBEDDINGS",
      inputParameters: {
        vectorDB: "pineconedb",
        index: "my_index",
        embeddings: [0.1, 0.2, 0.3, 0.4],
      },
    });
  });

  it("should include maxResults option", () => {
    const task = llmSearchEmbeddingsTask(
      "search_embed_ref",
      "weaviatedb",
      "idx",
      [1.0, 2.0],
      { maxResults: 10 }
    );
    expect(task.inputParameters).toEqual(
      expect.objectContaining({ maxResults: 10 })
    );
  });
});

// ── llmStoreEmbeddingsTask ───────────────────────────────────────────

describe("llmStoreEmbeddingsTask", () => {
  it("should create an LLM_STORE_EMBEDDINGS task", () => {
    const embeddings = [0.5, 0.6, 0.7];
    const task = llmStoreEmbeddingsTask(
      "store_embed_ref",
      "pineconedb",
      "my_index",
      embeddings
    );
    expect(task).toEqual({
      name: "store_embed_ref",
      taskReferenceName: "store_embed_ref",
      type: "LLM_STORE_EMBEDDINGS",
      inputParameters: {
        vectorDB: "pineconedb",
        index: "my_index",
        embeddings: [0.5, 0.6, 0.7],
      },
    });
  });

  it("should spread optional docId and metadata", () => {
    const task = llmStoreEmbeddingsTask(
      "store_embed_ref",
      "pineconedb",
      "idx",
      [1.0],
      { docId: "doc-42", metadata: { source: "test" } }
    );
    expect(task.inputParameters).toEqual(
      expect.objectContaining({
        docId: "doc-42",
        metadata: { source: "test" },
      })
    );
  });
});

// ── llmQueryEmbeddingsTask ───────────────────────────────────────────

describe("llmQueryEmbeddingsTask", () => {
  it("should create an LLM_GET_EMBEDDINGS task", () => {
    const embeddings = [0.1, 0.2, 0.3];
    const task = llmQueryEmbeddingsTask(
      "query_embed_ref",
      "weaviatedb",
      "my_index",
      embeddings
    );
    expect(task).toEqual({
      name: "query_embed_ref",
      taskReferenceName: "query_embed_ref",
      type: "LLM_GET_EMBEDDINGS",
      inputParameters: {
        vectorDB: "weaviatedb",
        index: "my_index",
        embeddings: [0.1, 0.2, 0.3],
      },
    });
  });

  it("should include namespace option", () => {
    const task = llmQueryEmbeddingsTask(
      "query_embed_ref",
      "pineconedb",
      "idx",
      [0.5],
      { namespace: "prod" }
    );
    expect(task.inputParameters).toEqual(
      expect.objectContaining({ namespace: "prod" })
    );
  });
});

// ── generateImageTask ────────────────────────────────────────────────

describe("generateImageTask", () => {
  it("should create a GENERATE_IMAGE task with required args", () => {
    const task = generateImageTask(
      "img_ref",
      "openai",
      "dall-e-3",
      "a sunset over mountains"
    );
    expect(task).toEqual({
      name: "img_ref",
      taskReferenceName: "img_ref",
      type: "GENERATE_IMAGE",
      inputParameters: {
        llmProvider: "openai",
        model: "dall-e-3",
        prompt: "a sunset over mountains",
      },
    });
  });

  it("should include imageCount, width, and height options", () => {
    const task = generateImageTask(
      "img_ref",
      "openai",
      "dall-e-3",
      "a cat",
      { imageCount: 2, width: 1024, height: 1024 }
    );
    expect(task).toEqual({
      name: "img_ref",
      taskReferenceName: "img_ref",
      type: "GENERATE_IMAGE",
      inputParameters: {
        llmProvider: "openai",
        model: "dall-e-3",
        prompt: "a cat",
        imageCount: 2,
        width: 1024,
        height: 1024,
      },
    });
  });
});

// ── generateAudioTask ────────────────────────────────────────────────

describe("generateAudioTask", () => {
  it("should create a GENERATE_AUDIO task with required args only", () => {
    const task = generateAudioTask("audio_ref", "openai", "tts-1");
    expect(task).toEqual({
      name: "audio_ref",
      taskReferenceName: "audio_ref",
      type: "GENERATE_AUDIO",
      inputParameters: {
        llmProvider: "openai",
        model: "tts-1",
      },
    });
  });

  it("should include text, voice, and speed options", () => {
    const task = generateAudioTask("audio_ref", "openai", "tts-1-hd", {
      text: "Hello world",
      voice: "alloy",
      speed: 1.5,
    });
    expect(task).toEqual({
      name: "audio_ref",
      taskReferenceName: "audio_ref",
      type: "GENERATE_AUDIO",
      inputParameters: {
        llmProvider: "openai",
        model: "tts-1-hd",
        text: "Hello world",
        voice: "alloy",
        speed: 1.5,
      },
    });
  });
});

// ── callMcpToolTask ──────────────────────────────────────────────────

describe("callMcpToolTask", () => {
  it("should create a CALL_MCP_TOOL task with required args", () => {
    const task = callMcpToolTask("mcp_ref", "my_server", "get_data");
    expect(task).toEqual({
      name: "mcp_ref",
      taskReferenceName: "mcp_ref",
      type: "CALL_MCP_TOOL",
      inputParameters: {
        mcpServer: "my_server",
        method: "get_data",
      },
    });
  });

  it("should spread options.inputParameters into inputParameters", () => {
    const task = callMcpToolTask("mcp_ref", "my_server", "query_tool", {
      inputParameters: { query: "test", limit: 10 },
    });
    expect(task).toEqual({
      name: "mcp_ref",
      taskReferenceName: "mcp_ref",
      type: "CALL_MCP_TOOL",
      inputParameters: {
        mcpServer: "my_server",
        method: "query_tool",
        query: "test",
        limit: 10,
      },
    });
  });

  it("should handle empty options.inputParameters", () => {
    const task = callMcpToolTask("mcp_ref", "server", "method", {
      inputParameters: {},
    });
    expect(task.inputParameters).toEqual({
      mcpServer: "server",
      method: "method",
    });
  });
});

// ── listMcpToolsTask ─────────────────────────────────────────────────

describe("listMcpToolsTask", () => {
  it("should create a LIST_MCP_TOOLS task with required args", () => {
    const task = listMcpToolsTask("list_mcp_ref", "my_server");
    expect(task).toEqual({
      name: "list_mcp_ref",
      taskReferenceName: "list_mcp_ref",
      type: "LIST_MCP_TOOLS",
      inputParameters: {
        mcpServer: "my_server",
      },
    });
  });

  it("should include filter option", () => {
    const task = listMcpToolsTask("list_mcp_ref", "my_server", {
      filter: "search*",
    });
    expect(task).toEqual({
      name: "list_mcp_ref",
      taskReferenceName: "list_mcp_ref",
      type: "LIST_MCP_TOOLS",
      inputParameters: {
        mcpServer: "my_server",
        filter: "search*",
      },
    });
  });
});

// ── Prompt Helpers ───────────────────────────────────────────────────

describe("withPromptVariable", () => {
  it("should return a new task with promptVariables set", () => {
    const original = llmChatCompleteTask("ref", "openai", "gpt-4");
    const result = withPromptVariable(original, "context", "some context");

    expect(result).toEqual({
      name: "ref",
      taskReferenceName: "ref",
      type: "LLM_CHAT_COMPLETE",
      inputParameters: {
        llmProvider: "openai",
        model: "gpt-4",
        promptVariables: {
          context: "some context",
        },
      },
    });
  });

  it("should not mutate the original task", () => {
    const original = llmChatCompleteTask("ref", "openai", "gpt-4");
    const originalInputParams = { ...original.inputParameters };
    withPromptVariable(original, "key", "value");

    expect(original.inputParameters).toEqual(originalInputParams);
    expect(
      (original.inputParameters as Record<string, unknown>).promptVariables
    ).toBeUndefined();
  });

  it("should merge with existing promptVariables", () => {
    const base = llmChatCompleteTask("ref", "openai", "gpt-4", {
      promptVariables: { existing: "val" },
    });
    const result = withPromptVariable(base, "newVar", "newVal");

    expect(result.inputParameters).toEqual(
      expect.objectContaining({
        promptVariables: { existing: "val", newVar: "newVal" },
      })
    );
  });
});

describe("withPromptVariables", () => {
  it("should set multiple prompt variables at once", () => {
    const original = llmTextCompleteTask(
      "ref",
      "openai",
      "gpt-4",
      "my_prompt"
    );
    const result = withPromptVariables(original, {
      context: "${workflow.input.context}",
      query: "${workflow.input.query}",
    });

    expect(result.inputParameters).toEqual(
      expect.objectContaining({
        promptVariables: {
          context: "${workflow.input.context}",
          query: "${workflow.input.query}",
        },
      })
    );
  });

  it("should merge with existing promptVariables", () => {
    const base = llmChatCompleteTask("ref", "openai", "gpt-4", {
      promptVariables: { existing: "keep_me" },
    });
    const result = withPromptVariables(base, {
      added: "new_value",
    });

    expect(result.inputParameters).toEqual(
      expect.objectContaining({
        promptVariables: { existing: "keep_me", added: "new_value" },
      })
    );
  });

  it("should not mutate the original task", () => {
    const original = llmChatCompleteTask("ref", "openai", "gpt-4", {
      promptVariables: { a: 1 },
    });
    withPromptVariables(original, { b: 2 });

    expect(
      (original.inputParameters as Record<string, unknown>).promptVariables
    ).toEqual({ a: 1 });
  });
});

// ── Cross-cutting: enum usage in builders ────────────────────────────

describe("enum usage with builders", () => {
  it("should accept LLMProvider enum values as provider argument", () => {
    const task = llmChatCompleteTask(
      "ref",
      LLMProvider.ANTHROPIC,
      "claude-3-opus"
    );
    expect(task.inputParameters).toEqual(
      expect.objectContaining({ llmProvider: "anthropic" })
    );
  });

  it("should accept VectorDB enum values as vectorDb argument", () => {
    const task = llmSearchEmbeddingsTask(
      "ref",
      VectorDB.PINECONE_DB,
      "idx",
      [0.1]
    );
    expect(task.inputParameters).toEqual(
      expect.objectContaining({ vectorDB: "pineconedb" })
    );
  });
});
