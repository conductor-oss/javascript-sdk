/**
 * Per-run LLM overrides (spec R8).
 *
 * Applied to the serialized root `agentConfig` immediately before `startAgent`
 * — SDK-side only, no new server field. Sub-agents keep their own settings
 * (no cascade).
 */
export interface RunSettings {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  thinkingBudgetTokens?: number;
}

const RUN_SETTINGS_KEYS = new Set<string>([
  "model",
  "temperature",
  "maxTokens",
  "reasoningEffort",
  "thinkingBudgetTokens",
]);

/**
 * Mutate `agentConfig` in place: only `!= null` fields override (so
 * `temperature: 0` and `maxTokens: 0` still apply); unset fields keep the
 * agent's own serialized values. `thinkingBudgetTokens` maps to the wire
 * `thinkingConfig = {enabled: true, budgetTokens: n}` shape. Throws on any
 * key outside the {@link RunSettings} field set.
 */
export function applyRunSettings(agentConfig: Record<string, unknown>, rs: RunSettings): void {
  for (const key of Object.keys(rs)) {
    if (!RUN_SETTINGS_KEYS.has(key)) {
      throw new Error(`Unknown RunSettings key: "${key}"`);
    }
  }
  if (rs.model != null) agentConfig.model = rs.model;
  if (rs.temperature != null) agentConfig.temperature = rs.temperature;
  if (rs.maxTokens != null) agentConfig.maxTokens = rs.maxTokens;
  if (rs.reasoningEffort != null) agentConfig.reasoningEffort = rs.reasoningEffort;
  if (rs.thinkingBudgetTokens != null) {
    agentConfig.thinkingConfig = { enabled: true, budgetTokens: rs.thinkingBudgetTokens };
  }
}
