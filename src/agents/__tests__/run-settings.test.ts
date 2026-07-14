import { describe, it, expect } from "@jest/globals";
import { applyRunSettings } from "../run-settings.js";
import type { RunSettings } from "../run-settings.js";

describe("applyRunSettings (spec R8)", () => {
  it("full override lands on the config", () => {
    const config: Record<string, unknown> = { model: "gpt-4o", temperature: 0.5 };
    applyRunSettings(config, {
      model: "anthropic/claude-sonnet-4-6",
      temperature: 0.9,
      maxTokens: 2048,
      reasoningEffort: "high",
      thinkingBudgetTokens: 1024,
    });

    expect(config).toEqual({
      model: "anthropic/claude-sonnet-4-6",
      temperature: 0.9,
      maxTokens: 2048,
      reasoningEffort: "high",
      thinkingConfig: { enabled: true, budgetTokens: 1024 },
    });
  });

  it("no settings → config equals the agent's own values (unchanged)", () => {
    const config: Record<string, unknown> = { model: "gpt-4o", temperature: 0.5 };
    applyRunSettings(config, {});
    expect(config).toEqual({ model: "gpt-4o", temperature: 0.5 });
  });

  it("partial override changes only the provided fields; temperature: 0 applies (null-check, not truthiness)", () => {
    const config: Record<string, unknown> = { model: "gpt-4o", temperature: 0.5, maxTokens: 100 };
    applyRunSettings(config, { temperature: 0 });

    expect(config.temperature).toBe(0);
    expect(config.model).toBe("gpt-4o");
    expect(config.maxTokens).toBe(100);
  });

  it("maxTokens: 0 applies (zero-value gate)", () => {
    const config: Record<string, unknown> = { maxTokens: 100 };
    applyRunSettings(config, { maxTokens: 0 });
    expect(config.maxTokens).toBe(0);
  });

  it("thinkingBudgetTokens maps to thinkingConfig = {enabled: true, budgetTokens: n}", () => {
    const config: Record<string, unknown> = {};
    applyRunSettings(config, { thinkingBudgetTokens: 512 });
    expect(config.thinkingConfig).toEqual({ enabled: true, budgetTokens: 512 });
  });

  it("does not mutate the config for undefined-valued keys", () => {
    const config: Record<string, unknown> = { model: "gpt-4o" };
    applyRunSettings(config, { model: undefined, temperature: undefined });
    expect(config).toEqual({ model: "gpt-4o" });
  });

  it("throws on an unknown key (no topP in the contract)", () => {
    const config: Record<string, unknown> = {};
    expect(() =>
      applyRunSettings(config, { topP: 0.9 } as unknown as RunSettings),
    ).toThrow(/Unknown RunSettings key/);
  });
});
