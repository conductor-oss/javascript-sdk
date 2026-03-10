/**
 * Vector DB — Embedding generation, storage, and semantic search
 *
 * Demonstrates vector database operations:
 *   - Generate embeddings from text
 *   - Store embeddings in a vector DB
 *   - Search embeddings for semantic similarity
 *   - Index and search text (combined operations)
 *
 * Prerequisites:
 *   - An embedding model integration (e.g., OpenAI text-embedding-3-small)
 *   - A vector DB integration (e.g., Pinecone, Weaviate, pgvector)
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/advanced/vector-db.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  llmGenerateEmbeddingsTask,
  llmStoreEmbeddingsTask,
  llmSearchEmbeddingsTask,
  llmIndexTextTask,
  llmSearchIndexTask,
  llmQueryEmbeddingsTask,
  inlineTask,
} from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();

  const embeddingProvider =
    process.env.EMBEDDING_PROVIDER ?? "openai_integration";
  const embeddingModel =
    process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
  const vectorDb = process.env.VECTOR_DB ?? "pinecone_integration";
  const vectorIndex = process.env.VECTOR_INDEX ?? "vector-db-example";

  // ── 1. Generate Embeddings Workflow ───────────────────────────────
  const embedWf = new ConductorWorkflow(
    workflowClient,
    "vector_generate_embeddings"
  )
    .description("Generate embeddings from text using an embedding model");

  embedWf.add(
    llmGenerateEmbeddingsTask(
      "embed_ref",
      embeddingProvider,
      embeddingModel,
      "${workflow.input.text}",
      {
        dimensions: 1536,
      }
    )
  );

  embedWf.add(
    inlineTask(
      "info_ref",
      `(function() {
        var embeddings = $.embed_ref.output.result || [];
        return {
          dimensions: embeddings.length,
          preview: embeddings.slice(0, 5)
        };
      })()`,
      "javascript"
    )
  );

  embedWf.outputParameters({
    text: "${workflow.input.text}",
    embeddings: "${embed_ref.output.result}",
    info: "${info_ref.output.result}",
  });

  await embedWf.register(true);
  console.log("Registered workflow:", embedWf.getName());

  // ── 2. Store Embeddings Workflow ──────────────────────────────────
  const storeWf = new ConductorWorkflow(
    workflowClient,
    "vector_store_embeddings"
  )
    .description("Store pre-computed embeddings in vector DB");

  storeWf.add(
    llmStoreEmbeddingsTask(
      "store_ref",
      vectorDb,
      vectorIndex,
      [0.1, 0.2, 0.3], // placeholder — in practice use actual embeddings
      {
        docId: "${workflow.input.docId}",
        namespace: "${workflow.input.namespace}",
        metadata: {
          source: "${workflow.input.source}",
        },
      }
    )
  );

  storeWf.outputParameters({
    stored: true,
    docId: "${workflow.input.docId}",
  });

  await storeWf.register(true);
  console.log("Registered workflow:", storeWf.getName());

  // ── 3. Text Index + Search Workflow ───────────────────────────────
  const textSearchWf = new ConductorWorkflow(
    workflowClient,
    "vector_text_search"
  )
    .description(
      "Index text and search — embedding generation handled by Conductor"
    );

  // Index the text
  textSearchWf.add(
    llmIndexTextTask(
      "index_ref",
      vectorDb,
      vectorIndex,
      { provider: embeddingProvider, model: embeddingModel },
      "${workflow.input.text}",
      "${workflow.input.docId}",
      {
        namespace: "text-search-demo",
        chunkSize: 200,
        chunkOverlap: 20,
      }
    )
  );

  // Search the index
  textSearchWf.add(
    llmSearchIndexTask(
      "search_ref",
      vectorDb,
      vectorIndex,
      { provider: embeddingProvider, model: embeddingModel },
      "${workflow.input.query}",
      {
        namespace: "text-search-demo",
        maxResults: 3,
      }
    )
  );

  textSearchWf.outputParameters({
    indexed: true,
    searchResults: "${search_ref.output.result}",
  });

  await textSearchWf.register(true);
  console.log("Registered workflow:", textSearchWf.getName());

  // ── 4. Embedding Search Workflow ──────────────────────────────────
  const embSearchWf = new ConductorWorkflow(
    workflowClient,
    "vector_embedding_search"
  )
    .description("Search vector DB using raw embeddings");

  embSearchWf.add(
    llmSearchEmbeddingsTask(
      "search_emb_ref",
      vectorDb,
      vectorIndex,
      [0.1, 0.2, 0.3], // placeholder
      {
        namespace: "${workflow.input.namespace}",
        maxResults: 5,
      }
    )
  );

  embSearchWf.outputParameters({
    results: "${search_emb_ref.output.result}",
  });

  await embSearchWf.register(true);
  console.log("Registered workflow:", embSearchWf.getName());

  // ── 5. Query Embeddings Workflow ──────────────────────────────────
  const queryWf = new ConductorWorkflow(
    workflowClient,
    "vector_query_embeddings"
  )
    .description("Query stored embeddings from vector DB");

  queryWf.add(
    llmQueryEmbeddingsTask(
      "query_ref",
      vectorDb,
      vectorIndex,
      [0.1, 0.2, 0.3], // placeholder
      {
        namespace: "${workflow.input.namespace}",
      }
    )
  );

  queryWf.outputParameters({
    results: "${query_ref.output.result}",
  });

  await queryWf.register(true);
  console.log("Registered workflow:", queryWf.getName());

  // ── Execute examples ──────────────────────────────────────────────
  console.log("\n--- Generating embeddings ---");
  try {
    const run = await embedWf.execute({
      text: "Conductor is a workflow orchestration engine",
    });
    console.log("Status:", run.status);
    console.log("Info:", JSON.stringify((run.output as Record<string, unknown>)?.info, null, 2));
  } catch (err) {
    console.log(
      "Skipped (requires embedding model):",
      (err as Error).message
    );
  }

  console.log("\n--- Text index + search ---");
  try {
    const run = await textSearchWf.execute({
      text: "The TypeScript SDK provides task builders, workflow builders, and worker decorators.",
      docId: "ts-sdk-intro",
      query: "What does the TypeScript SDK provide?",
    });
    console.log("Status:", run.status);
    console.log("Results:", JSON.stringify((run.output as Record<string, unknown>)?.searchResults, null, 2));
  } catch (err) {
    console.log(
      "Skipped (requires vector DB):",
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
