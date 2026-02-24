import type {
  WorkflowDef,
  WorkflowTask,
  WorkflowRun,
  StartWorkflowRequest,
} from "../../open-api";
import { TaskType } from "../../open-api";
import type { WorkflowExecutor } from "../clients/workflow/WorkflowExecutor";

/**
 * Fluent workflow builder matching the Python SDK's ConductorWorkflow pattern.
 *
 * Provides method chaining for building, configuring, registering, and
 * executing workflows.
 *
 * @example
 * ```typescript
 * const wf = new ConductorWorkflow(executor, "order_flow")
 *   .add(simpleTask("validate_ref", "validate_order", {}))
 *   .add(simpleTask("charge_ref", "charge_payment", {}))
 *   .add(simpleTask("confirm_ref", "send_confirmation", {}))
 *   .timeoutSeconds(3600)
 *   .outputParameters({ orderId: "${workflow.input.orderId}" });
 *
 * await wf.register(true);
 * const run = await wf.execute({ orderId: "123" });
 * ```
 */
export class ConductorWorkflow {
  private readonly _executor: WorkflowExecutor;
  private readonly _name: string;
  private _version: number;
  private _description?: string;
  private _tasks: WorkflowTask[] = [];
  private _timeoutPolicy?: "TIME_OUT_WF" | "ALERT_ONLY";
  private _timeoutSeconds = 60;
  private _ownerEmail?: string;
  private _failureWorkflow = "";
  private _restartable = true;
  private _inputParameters: string[] = [];
  private _inputTemplate: Record<string, unknown> = {};
  private _outputParameters: Record<string, unknown> = {};
  private _variables: Record<string, unknown> = {};
  private _workflowStatusListenerEnabled = false;
  private _workflowStatusListenerSink?: string;
  private _forkCounter = 0;

  constructor(
    executor: WorkflowExecutor,
    name: string,
    version?: number,
    description?: string
  ) {
    this._executor = executor;
    this._name = name;
    this._version = version ?? 1;
    this._description = description;
  }

  /** Get the workflow name */
  getName(): string {
    return this._name;
  }

  /** Get the workflow version */
  getVersion(): number {
    return this._version;
  }

  // ── Task Building ───────────────────────────────────────────────

  /** Append one or more tasks sequentially */
  add(task: WorkflowTask | WorkflowTask[]): this {
    if (Array.isArray(task)) {
      this._tasks.push(...task);
    } else {
      this._tasks.push(task);
    }
    return this;
  }

  /** Add parallel fork branches with an auto-generated join */
  fork(branches: WorkflowTask[][]): this {
    this._forkCounter++;
    const forkRefName = `__fork_${this._forkCounter}`;
    const joinRefName = `__join_${this._forkCounter}`;

    const joinOn = branches.map((branch) => {
      const lastTask = branch[branch.length - 1];
      return lastTask?.taskReferenceName ?? "";
    });

    this._tasks.push({
      name: forkRefName,
      taskReferenceName: forkRefName,
      type: TaskType.FORK_JOIN,
      forkTasks: branches,
    });

    this._tasks.push({
      name: joinRefName,
      taskReferenceName: joinRefName,
      type: TaskType.JOIN,
      joinOn,
    });

    return this;
  }

  /**
   * Convert this workflow into a SUB_WORKFLOW task with the full definition
   * embedded inline, matching Python SDK's `InlineSubWorkflowTask`.
   *
   * This allows composing workflows without pre-registering the child workflow.
   *
   * @param taskReferenceName - Reference name for the sub-workflow task
   */
  toSubWorkflowTask(taskReferenceName: string): WorkflowTask {
    const def = this.toWorkflowDef();
    const subWorkflowParam: Record<string, unknown> = {
      name: this._name,
      version: this._version,
      workflowDefinition: def,
    };
    return {
      name: taskReferenceName,
      taskReferenceName,
      type: TaskType.SUB_WORKFLOW,
      subWorkflowParam:
        subWorkflowParam as unknown as WorkflowTask["subWorkflowParam"],
      inputParameters: {},
    };
  }

  // ── Configuration ───────────────────────────────────────────────

  description(desc: string): this {
    this._description = desc;
    return this;
  }

  version(v: number): this {
    this._version = v;
    return this;
  }

  timeoutPolicy(policy: "TIME_OUT_WF" | "ALERT_ONLY"): this {
    this._timeoutPolicy = policy;
    return this;
  }

  timeoutSeconds(n: number): this {
    this._timeoutSeconds = n;
    return this;
  }

  ownerEmail(email: string): this {
    this._ownerEmail = email;
    return this;
  }

  failureWorkflow(name: string): this {
    this._failureWorkflow = name;
    return this;
  }

  restartable(val: boolean): this {
    this._restartable = val;
    return this;
  }

  /** Set the list of input parameter names */
  inputParameters(params: string[]): this {
    this._inputParameters = params;
    return this;
  }

  /** Set the input template (default values/expressions for inputs) */
  inputTemplate(template: Record<string, unknown>): this {
    this._inputTemplate = template;
    return this;
  }

  /** Alias for inputTemplate — set workflow input defaults */
  workflowInput(input: Record<string, unknown>): this {
    this._inputTemplate = input;
    return this;
  }

  /** Set all output parameters at once */
  outputParameters(params: Record<string, unknown>): this {
    this._outputParameters = params;
    return this;
  }

  /** Set a single output parameter */
  outputParameter(key: string, value: unknown): this {
    this._outputParameters[key] = value;
    return this;
  }

  /** Set workflow variables */
  variables(vars: Record<string, unknown>): this {
    this._variables = vars;
    return this;
  }

  /** Enable workflow status listener with a sink name */
  enableStatusListener(sinkName: string): this {
    this._workflowStatusListenerEnabled = true;
    this._workflowStatusListenerSink = sinkName;
    return this;
  }

  /** Disable workflow status listener */
  disableStatusListener(): this {
    this._workflowStatusListenerEnabled = false;
    this._workflowStatusListenerSink = undefined;
    return this;
  }

  // ── Reference Helpers ───────────────────────────────────────────

  /** Returns a workflow input reference expression */
  input(jsonPath: string): string {
    return `\${workflow.input.${jsonPath}}`;
  }

  /** Returns a workflow output reference expression */
  output(jsonPath?: string): string {
    if (jsonPath) {
      return `\${workflow.output.${jsonPath}}`;
    }
    return "${workflow.output}";
  }

  // ── Execution ───────────────────────────────────────────────────

  /** Convert to a WorkflowDef object */
  toWorkflowDef(): WorkflowDef {
    return {
      name: this._name,
      version: this._version,
      tasks: this._tasks,
      timeoutSeconds: this._timeoutSeconds,
      restartable: this._restartable,
      inputParameters: this._inputParameters,
      outputParameters: this._outputParameters,
      inputTemplate: this._inputTemplate,
      variables: this._variables,
      failureWorkflow: this._failureWorkflow,
      ...(this._description !== undefined && {
        description: this._description,
      }),
      ...(this._timeoutPolicy !== undefined && {
        timeoutPolicy: this._timeoutPolicy,
      }),
      ...(this._ownerEmail !== undefined && { ownerEmail: this._ownerEmail }),
      ...(this._workflowStatusListenerEnabled && {
        workflowStatusListenerEnabled: true,
        workflowStatusListenerSink: this._workflowStatusListenerSink,
      }),
    };
  }

  /** Register this workflow with the Conductor server */
  async register(overwrite = true): Promise<void> {
    await this._executor.registerWorkflow(overwrite, this.toWorkflowDef());
  }

  /** Execute the workflow synchronously and wait for result */
  async execute(
    input?: Record<string, unknown>,
    waitUntilTaskRef?: string,
    requestId?: string,
    idempotencyKey?: string,
    idempotencyStrategy?: "FAIL" | "RETURN_EXISTING" | "FAIL_ON_RUNNING",
    taskToDomain?: Record<string, string>
  ): Promise<WorkflowRun> {
    const request: StartWorkflowRequest = {
      name: this._name,
      version: this._version,
      input,
      idempotencyKey,
      idempotencyStrategy,
      taskToDomain,
    };

    return this._executor.executeWorkflow(
      request,
      this._name,
      this._version,
      requestId ?? crypto.randomUUID(),
      waitUntilTaskRef
    );
  }

  /** Start the workflow asynchronously (returns workflow ID) */
  async startWorkflow(
    input?: Record<string, unknown>,
    correlationId?: string,
    priority?: number,
    idempotencyKey?: string,
    idempotencyStrategy?: "FAIL" | "RETURN_EXISTING" | "FAIL_ON_RUNNING",
    taskToDomain?: Record<string, string>
  ): Promise<string> {
    const request: StartWorkflowRequest = {
      name: this._name,
      version: this._version,
      input,
      correlationId,
      priority,
      idempotencyKey,
      idempotencyStrategy,
      taskToDomain,
    };
    return this._executor.startWorkflow(request);
  }
}
