/**
 * RAG Workflow — Retrieval-Augmented Generation pipeline
 *
 * Demonstrates a complete RAG pipeline:
 *   1. Index a document (text → embeddings → vector DB)
 *   2. Search the index with a user query
 *   3. Use search results as context for LLM answer generation
 *
 * Prerequisites:
 *   - An LLM integration configured in Conductor
 *   - A vector DB integration configured (e.g., Pinecone, Weaviate)
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/advanced/rag-workflow.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  llmIndexTextTask,
  llmSearchIndexTask,
  llmChatCompleteTask,
  Role,
} from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();

  const llmProvider = process.env.LLM_PROVIDER ?? "openai_integration";
  const llmModel = process.env.LLM_MODEL ?? "gpt-4o";
  const embeddingProvider = process.env.EMBEDDING_PROVIDER ?? "openai_integration";
  const embeddingModel = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
  const vectorDb = process.env.VECTOR_DB ?? "pinecone_integration";
  const vectorIndex = process.env.VECTOR_INDEX ?? "rag-example-index";

  // ── 1. Indexing Workflow ──────────────────────────────────────────
  const indexWf = new ConductorWorkflow(workflowClient, "rag_index_workflow")
    .description("Index text documents into vector DB for RAG");

  indexWf.add(
    llmIndexTextTask(
      "index_ref",
      vectorDb,
      vectorIndex,
      { provider: embeddingProvider, model: embeddingModel },
      "${workflow.input.text}",
      "${workflow.input.docId}",
      {
        namespace: "${workflow.input.namespace}",
        chunkSize: 500,
        chunkOverlap: 50,
        metadata: {
          source: "${workflow.input.source}",
          category: "${workflow.input.category}",
        },
      }
    )
  );

  indexWf.outputParameters({
    docId: "${workflow.input.docId}",
    indexed: true,
  });

  await indexWf.register(true);
  console.log("Registered indexing workflow:", indexWf.getName());

  // ── 2. RAG Query Workflow ─────────────────────────────────────────
  const queryWf = new ConductorWorkflow(workflowClient, "rag_query_workflow")
    .description("Search indexed documents and generate answer with LLM");

  // Step 1: Search the vector index
  queryWf.add(
    llmSearchIndexTask(
      "search_ref",
      vectorDb,
      vectorIndex,
      { provider: embeddingProvider, model: embeddingModel },
      "${workflow.input.question}",
      {
        namespace: "${workflow.input.namespace}",
        maxResults: 5,
      }
    )
  );

  // Step 2: Generate answer using search results as context
  queryWf.add(
    llmChatCompleteTask("answer_ref", llmProvider, llmModel, {
      messages: [
        {
          role: Role.SYSTEM,
          message: `You are a helpful assistant. Answer the user's question based ONLY on the provided context. If the context doesn't contain relevant information, say so.

Context from documents:
\${search_ref.output.result}`,
        },
        {
          role: Role.USER,
          message: "${workflow.input.question}",
        },
      ],
      temperature: 0.3,
      maxTokens: 500,
    })
  );

  queryWf.outputParameters({
    question: "${workflow.input.question}",
    searchResults: "${search_ref.output.result}",
    answer: "${answer_ref.output.result}",
  });

  await queryWf.register(true);
  console.log("Registered query workflow:", queryWf.getName());

  // ── 3. Execute the pipeline ───────────────────────────────────────
  console.log("\n--- Step 1: Indexing documents ---");

  const documents = [
    {
      docId: "doc-1",
      text: "Conductor is an open-source workflow orchestration engine originally developed at Netflix. It supports complex workflow patterns including fork/join, sub-workflows, and dynamic tasks.",
      source: "docs",
      category: "overview",
    },
    {
      docId: "doc-2",
      text: "The TypeScript SDK for Conductor provides a fluent API for building workflows, task builders for all task types, and a decorator-based worker framework with @worker.",
      source: "docs",
      category: "sdk",
    },
    {
      docId: "doc-3",
      text: "Workers in Conductor poll for tasks, execute business logic, and report results back. The SDK supports concurrency control, adaptive backoff, and metrics collection.",
      source: "docs",
      category: "workers",
    },
  ];

  for (const doc of documents) {
    try {
      const run = await indexWf.execute({
        ...doc,
        namespace: "rag-example",
      });
      console.log(`  Indexed ${doc.docId}: ${run.status}`);
    } catch (err) {
      console.log(
        `  Indexing ${doc.docId} skipped (requires vector DB): ${(err as Error).message}`
      );
      break;
    }
  }

  console.log("\n--- Step 2: Querying ---");
  try {
    const queryRun = await queryWf.execute({
      question: "How do workers function in Conductor?",
      namespace: "rag-example",
    });
    console.log("Status:", queryRun.status);
    console.log("Answer:", (queryRun.output as Record<string, string>)?.answer);
  } catch (err) {
    console.log(
      "Query skipped (requires LLM + vector DB):",
      (err as Error).message
    );
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
