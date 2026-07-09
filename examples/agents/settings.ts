const llmModel = process.env.AGENTSPAN_LLM_MODEL ?? 'openai/gpt-4o-mini';
const secondaryLlmModel = process.env.AGENTSPAN_SECONDARY_LLM_MODEL ?? 'openai/gpt-4o';
export { llmModel, secondaryLlmModel };
