/**
 * 118 - OCG-backed long-term memory with human good/bad feedback links.
 *
 * Enable memory on an agent and the server-side compiler does two things
 * automatically once the config is deployed/started:
 *
 *   - BEFORE a run: relevant past memories (scoped to this agent/user) are
 *     retrieved from OCG and injected into the prompt — no tool call needed.
 *   - AFTER a run: the conversation is summarized (Claude-style: durable facts,
 *     not the raw transcript) by a small internal summarizer agent and saved
 *     back to OCG as a memory.
 *
 * Feedback is HUMAN-only. Agents never vote. Instead, the runtime hands a
 * `FeedbackEvent` — including signed *capability URLs* (good/bad) — to the
 * agent's `feedbackSink`. A human (e.g. a support engineer) clicks a link to
 * mark the memory good or bad; the link skips auth (its signature is the
 * authorization), so the clicker needs no OCG account. Here the sink just
 * prints the URLs as they'd appear in a Zendesk ticket comment.
 *
 * Requires the OCG instance to be started with a feedback-link secret
 * (`OCG_FEEDBACK_LINK_SECRET`) for the capability URLs to be minted.
 *
 * Run:
 *
 *   OCG_INSTANCE_URL=https://test.contextgraph.io \
 *   OCG_TOKEN=<bearer-token> \
 *   npx tsx examples/agents/118-ocg-memory.ts
 */

import {
  Agent,
  AgentRuntime,
  OCGMemoryStore,
  type FeedbackEvent,
} from '@io-orkes/conductor-javascript/agents';

const MODEL = process.env.AGENTSPAN_LLM_MODEL ?? 'openai/gpt-4o-mini';

const OCG_INSTANCE_URL = process.env.OCG_INSTANCE_URL ?? '';
// Unlike the credential-resolving retrieval tools (which resolve a credential
// server-side), the memory store calls OCG directly, so it holds the bearer
// token client-side.
const OCG_TOKEN = process.env.OCG_TOKEN;
if (!OCG_INSTANCE_URL) {
  throw new Error(
    'Set OCG_INSTANCE_URL to your OCG instance, e.g. https://test.contextgraph.io',
  );
}

/**
 * Deliver the good/bad links to a human. In production this would POST a comment
 * to the Zendesk ticket; here we just print what would be sent.
 */
function zendeskSink(event: FeedbackEvent): void {
  console.log('\n--- would post to Zendesk ticket ---');
  console.log(`Saved memory: ${event.memoryKey}`);
  console.log(`Summary: ${event.summary}`);
  if (event.goodUrl) {
    console.log(`  👍 Was this helpful?  ${event.goodUrl}`);
    console.log(`  👎 Not helpful:       ${event.badUrl}`);
  }
  console.log('------------------------------------\n');
}

const store = new OCGMemoryStore({
  url: OCG_INSTANCE_URL,
  agent: 'agent:support',
  user: 'user:alice',
  token: OCG_TOKEN,
  maxResults: 5,
});

export const supportAgent = new Agent({
  name: 'support',
  model: MODEL,
  instructions:
    'You are a customer support agent. Use any relevant context from memory to ' +
    'personalize your answer. A memory labeled [bad] was flagged by a human — ' +
    'treat it with suspicion.',
  semanticMemory: store,
  feedbackSink: zendeskSink,
});

async function main() {
  const runtime = new AgentRuntime();
  try {
    console.log('--- Turn 1 ---');
    const t1 = await runtime.run(
      supportAgent,
      "Hi, I'm Alice. I'm on the Enterprise plan and prefer email.",
    );
    t1.printResult();

    console.log("\n--- Turn 2 (should recall Alice's plan from memory) ---");
    const t2 = await runtime.run(supportAgent, 'What plan am I on again?');
    t2.printResult();
  } finally {
    await runtime.shutdown();
  }
}

main().catch(console.error);
