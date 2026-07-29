const llmModel = process.env.CONDUCTOR_AGENT_LLM_MODEL ?? 'openai/gpt-4o-mini';
const secondaryLlmModel = process.env.CONDUCTOR_AGENT_SECONDARY_LLM_MODEL ?? 'openai/gpt-4o';
export { llmModel, secondaryLlmModel };
