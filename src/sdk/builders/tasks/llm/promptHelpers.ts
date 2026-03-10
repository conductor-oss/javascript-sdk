import type { WorkflowTask } from "../../../../open-api";

/**
 * Set a single prompt variable on an LLM task.
 * Returns a new task with the variable applied to inputParameters.promptVariables.
 *
 * @example
 * ```typescript
 * const task = withPromptVariable(
 *   llmChatCompleteTask("ref", "openai", "gpt-4"),
 *   "context",
 *   "${workflow.input.context}"
 * );
 * ```
 */
export const withPromptVariable = (
  task: WorkflowTask,
  variable: string,
  value: unknown
): WorkflowTask => ({
  ...task,
  inputParameters: {
    ...task.inputParameters,
    promptVariables: {
      ...(task.inputParameters?.promptVariables as
        | Record<string, unknown>
        | undefined),
      [variable]: value,
    },
  },
});

/**
 * Set multiple prompt variables on an LLM task at once.
 * Returns a new task with all variables merged into inputParameters.promptVariables.
 *
 * @example
 * ```typescript
 * const task = withPromptVariables(
 *   llmTextCompleteTask("ref", "openai", "gpt-4", "my_prompt"),
 *   {
 *     context: "${workflow.input.context}",
 *     query: "${workflow.input.query}",
 *   }
 * );
 * ```
 */
export const withPromptVariables = (
  task: WorkflowTask,
  variables: Record<string, unknown>
): WorkflowTask => ({
  ...task,
  inputParameters: {
    ...task.inputParameters,
    promptVariables: {
      ...(task.inputParameters?.promptVariables as
        | Record<string, unknown>
        | undefined),
      ...variables,
    },
  },
});
