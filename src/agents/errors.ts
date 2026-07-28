/**
 * Base error for all Conductor agent errors.
 */
export class ConductorAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConductorAgentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Previous name for {@link ConductorAgentError}.
 *
 * A direct alias rather than a subclass, so `instanceof` keeps working in both
 * directions for code written against either name.
 *
 * @deprecated Renamed to `ConductorAgentError` when Agentspan became
 * Conductor. Will be removed in a future release.
 */
export const AgentspanError = ConductorAgentError;

/**
 * Previous name for {@link ConductorAgentError}, as a type.
 *
 * Declared alongside the value alias above so both `instanceof AgentspanError`
 * and `const e: AgentspanError` keep compiling.
 *
 * @deprecated Renamed to `ConductorAgentError` when Agentspan became
 * Conductor. Will be removed in a future release.
 */
export type AgentspanError = ConductorAgentError;

/**
 * HTTP API error with status code and response body.
 *
 * The message includes a snippet of the response body so test failures
 * (and other call sites that only surface ``error.message``) carry the
 * server's actual diagnostic instead of just the status code — without
 * which 500 responses on /agent/start become impossible to triage from
 * CI logs alone.
 */
export class AgentAPIError extends ConductorAgentError {
  readonly statusCode: number;
  readonly responseBody: string;

  constructor(message: string, statusCode: number, responseBody: string) {
    const snippet = (responseBody ?? "").trim();
    const composed = snippet
      ? `${message} — body: ${snippet.slice(0, 500)}${snippet.length > 500 ? "…" : ""}`
      : message;
    super(composed);
    this.name = "AgentAPIError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Agent not found by name.
 */
export class AgentNotFoundError extends ConductorAgentError {
  readonly agentName: string;

  constructor(agentName: string) {
    super(`Agent not found: ${agentName}`);
    this.name = "AgentNotFoundError";
    this.agentName = agentName;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Configuration error — invalid or missing config values.
 */
export class ConfigurationError extends ConductorAgentError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Credential not found in the credential store.
 */
export class CredentialNotFoundError extends ConductorAgentError {
  readonly credentialName: string;

  constructor(credentialName: string) {
    super(`Credential not found: ${credentialName}`);
    this.name = "CredentialNotFoundError";
    this.credentialName = credentialName;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Credential authentication error — execution token invalid or expired.
 */
export class CredentialAuthError extends ConductorAgentError {
  constructor(message = "Credential authentication failed") {
    super(message);
    this.name = "CredentialAuthError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Credential rate limit exceeded (120 calls/min).
 */
export class CredentialRateLimitError extends ConductorAgentError {
  constructor(message = "Credential rate limit exceeded") {
    super(message);
    this.name = "CredentialRateLimitError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Credential service error — server-side failure.
 */
export class CredentialServiceError extends ConductorAgentError {
  constructor(message = "Credential service error") {
    super(message);
    this.name = "CredentialServiceError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * SSE connection timeout — no events received within the timeout window.
 */
export class SSETimeoutError extends ConductorAgentError {
  constructor(message = "SSE connection timed out") {
    super(message);
    this.name = "SSETimeoutError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * The server rejected the initial SSE connection (non-2xx) — it does not
 * support streaming for this route. Callers fall back to polling.
 */
export class SSEUnavailableError extends ConductorAgentError {
  constructor(message = "SSE stream is unavailable") {
    super(message);
    this.name = "SSEUnavailableError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Terminal tool error — non-retryable failure (e.g., CLI command exited non-zero).
 * Causes the Conductor task to be marked FAILED_WITH_TERMINAL_ERROR.
 */
export class TerminalToolError extends ConductorAgentError {
  constructor(message: string) {
    super(message);
    this.name = "TerminalToolError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * A stateful run's task has sat SCHEDULED/IN_PROGRESS with no worker poll
 * for longer than the liveness stall window — the local worker process for
 * this run's domain likely died. Surfaces from a blocking `wait()`.
 */
export class WorkerStallError extends ConductorAgentError {
  readonly executionId: string;
  readonly taskDefName: string;
  readonly taskId: string;
  readonly secondsQueued: number;

  constructor(executionId: string, taskDefName: string, taskId: string, secondsQueued: number) {
    super(
      `Worker stall detected on execution ${executionId}: task '${taskDefName}' (${taskId}) has been queued ${secondsQueued.toFixed(0)}s with no worker polling for it.`,
    );
    this.name = "WorkerStallError";
    this.executionId = executionId;
    this.taskDefName = taskDefName;
    this.taskId = taskId;
    this.secondsQueued = secondsQueued;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Guardrail validation failed.
 */
export class GuardrailFailedError extends ConductorAgentError {
  readonly guardrailName: string;
  readonly failureMessage: string;

  constructor(guardrailName: string, failureMessage: string) {
    super(`Guardrail '${guardrailName}' failed: ${failureMessage}`);
    this.name = "GuardrailFailedError";
    this.guardrailName = guardrailName;
    this.failureMessage = failureMessage;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
