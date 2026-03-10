import { describe, it, expect, jest } from "@jest/globals";
import { ConductorWorkflow } from "../ConductorWorkflow";
import type { WorkflowExecutor } from "../../clients/workflow/WorkflowExecutor";
import type { WorkflowTask } from "../../../open-api";
import { TaskType } from "../../../open-api";

function createMockExecutor() {
  return {
    _client: {},
    registerWorkflow: jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined),
    startWorkflow: jest
      .fn<() => Promise<string>>()
      .mockResolvedValue("wf-id-123"),
    executeWorkflow: jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ workflowId: "wf-123" }),
  } as unknown as WorkflowExecutor;
}

function makeTask(refName: string): WorkflowTask {
  return {
    name: refName,
    taskReferenceName: refName,
    type: TaskType.SIMPLE,
    inputParameters: {},
  };
}

describe("ConductorWorkflow", () => {
  // ── Constructor ──────────────────────────────────────────────────

  describe("constructor", () => {
    it("creates with name and default version=1", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "my_workflow");
      expect(wf.getName()).toBe("my_workflow");
      expect(wf.getVersion()).toBe(1);
    });

    it("creates with custom version and description", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(
        mockExecutor,
        "my_workflow",
        3,
        "A test workflow"
      );
      expect(wf.getVersion()).toBe(3);
      const def = wf.toWorkflowDef();
      expect(def.description).toBe("A test workflow");
    });
  });

  // ── getName / getVersion ─────────────────────────────────────────

  describe("getName / getVersion", () => {
    it("returns correct name and version", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "order_flow", 5);
      expect(wf.getName()).toBe("order_flow");
      expect(wf.getVersion()).toBe(5);
    });
  });

  // ── add() ────────────────────────────────────────────────────────

  describe("add()", () => {
    it("adds a single task to the tasks array", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "wf");
      const task = makeTask("task1");
      wf.add(task);
      const def = wf.toWorkflowDef();
      expect(def.tasks).toHaveLength(1);
      expect(def.tasks[0].taskReferenceName).toBe("task1");
    });

    it("appends an array of tasks", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "wf");
      const t1 = makeTask("task1");
      const t2 = makeTask("task2");
      wf.add([t1, t2]);
      const def = wf.toWorkflowDef();
      expect(def.tasks).toHaveLength(2);
      expect(def.tasks[0].taskReferenceName).toBe("task1");
      expect(def.tasks[1].taskReferenceName).toBe("task2");
    });

    it("supports chaining: wf.add(t1).add(t2) includes both tasks", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "wf");
      const t1 = makeTask("task1");
      const t2 = makeTask("task2");
      const result = wf.add(t1).add(t2);
      expect(result).toBe(wf);
      const def = wf.toWorkflowDef();
      expect(def.tasks).toHaveLength(2);
      expect(def.tasks[0].taskReferenceName).toBe("task1");
      expect(def.tasks[1].taskReferenceName).toBe("task2");
    });
  });

  // ── fork() ───────────────────────────────────────────────────────

  describe("fork()", () => {
    it("creates a FORK_JOIN task and a JOIN task", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "wf");
      const branch1 = [makeTask("b1_task1")];
      const branch2 = [makeTask("b2_task1")];
      wf.fork([branch1, branch2]);

      const def = wf.toWorkflowDef();
      expect(def.tasks).toHaveLength(2);
      expect(def.tasks[0].type).toBe(TaskType.FORK_JOIN);
      expect(def.tasks[0].taskReferenceName).toBe("__fork_1");
      expect(def.tasks[0].forkTasks).toEqual([branch1, branch2]);
      expect(def.tasks[1].type).toBe(TaskType.JOIN);
      expect(def.tasks[1].taskReferenceName).toBe("__join_1");
    });

    it("JOIN joinOn has the last task ref from each branch", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "wf");
      const branch1 = [makeTask("b1_step1"), makeTask("b1_step2")];
      const branch2 = [makeTask("b2_step1"), makeTask("b2_step2")];
      wf.fork([branch1, branch2]);

      const def = wf.toWorkflowDef();
      const joinTask = def.tasks[1];
      expect(joinTask.joinOn).toEqual(["b1_step2", "b2_step2"]);
    });

    it("multiple forks get unique __fork_N and __join_N names", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "wf");
      wf.fork([[makeTask("a1")], [makeTask("a2")]]);
      wf.fork([[makeTask("b1")], [makeTask("b2")]]);

      const def = wf.toWorkflowDef();
      expect(def.tasks).toHaveLength(4);
      expect(def.tasks[0].taskReferenceName).toBe("__fork_1");
      expect(def.tasks[1].taskReferenceName).toBe("__join_1");
      expect(def.tasks[2].taskReferenceName).toBe("__fork_2");
      expect(def.tasks[3].taskReferenceName).toBe("__join_2");
    });
  });

  // ── Config methods (all return `this`) ───────────────────────────

  describe("config methods return this for chaining", () => {
    let wf: ConductorWorkflow;

    beforeEach(() => {
      const mockExecutor = createMockExecutor();
      wf = new ConductorWorkflow(mockExecutor, "wf");
    });

    it("description(desc) sets description and returns this", () => {
      const result = wf.description("My workflow description");
      expect(result).toBe(wf);
      expect(wf.toWorkflowDef().description).toBe("My workflow description");
    });

    it("version(v) sets version and returns this", () => {
      const result = wf.version(7);
      expect(result).toBe(wf);
      expect(wf.getVersion()).toBe(7);
    });

    it("timeoutPolicy('TIME_OUT_WF') sets timeoutPolicy and returns this", () => {
      const result = wf.timeoutPolicy("TIME_OUT_WF");
      expect(result).toBe(wf);
      expect(wf.toWorkflowDef().timeoutPolicy).toBe("TIME_OUT_WF");
    });

    it("timeoutSeconds(3600) sets timeoutSeconds and returns this", () => {
      const result = wf.timeoutSeconds(3600);
      expect(result).toBe(wf);
      expect(wf.toWorkflowDef().timeoutSeconds).toBe(3600);
    });

    it("ownerEmail('test@example.com') sets ownerEmail and returns this", () => {
      const result = wf.ownerEmail("test@example.com");
      expect(result).toBe(wf);
      expect(wf.toWorkflowDef().ownerEmail).toBe("test@example.com");
    });

    it("failureWorkflow('compensate_flow') sets failureWorkflow and returns this", () => {
      const result = wf.failureWorkflow("compensate_flow");
      expect(result).toBe(wf);
      expect(wf.toWorkflowDef().failureWorkflow).toBe("compensate_flow");
    });

    it("restartable(false) sets restartable and returns this", () => {
      const result = wf.restartable(false);
      expect(result).toBe(wf);
      expect(wf.toWorkflowDef().restartable).toBe(false);
    });

    it("inputParameters(['orderId']) sets inputParameters and returns this", () => {
      const result = wf.inputParameters(["orderId"]);
      expect(result).toBe(wf);
      expect(wf.toWorkflowDef().inputParameters).toEqual(["orderId"]);
    });

    it("inputTemplate({ orderId: 'default' }) sets inputTemplate and returns this", () => {
      const result = wf.inputTemplate({ orderId: "default" });
      expect(result).toBe(wf);
      expect(wf.toWorkflowDef().inputTemplate).toEqual({
        orderId: "default",
      });
    });

    it("outputParameters({ result: '${task1.output}' }) sets outputParameters and returns this", () => {
      const result = wf.outputParameters({ result: "${task1.output}" });
      expect(result).toBe(wf);
      expect(wf.toWorkflowDef().outputParameters).toEqual({
        result: "${task1.output}",
      });
    });

    it("outputParameter('key', 'value') adds to outputParameters and returns this", () => {
      wf.outputParameters({ existing: "val" });
      const result = wf.outputParameter("key", "value");
      expect(result).toBe(wf);
      expect(wf.toWorkflowDef().outputParameters).toEqual({
        existing: "val",
        key: "value",
      });
    });

    it("workflowInput({ x: 1 }) sets inputTemplate (alias) and returns this", () => {
      const result = wf.workflowInput({ x: 1 });
      expect(result).toBe(wf);
      expect(wf.toWorkflowDef().inputTemplate).toEqual({ x: 1 });
    });

    it("variables({ counter: 0 }) sets variables and returns this", () => {
      const result = wf.variables({ counter: 0 });
      expect(result).toBe(wf);
      expect(wf.toWorkflowDef().variables).toEqual({ counter: 0 });
    });

    it("enableStatusListener('conductor:my_sink') enables listener and returns this", () => {
      const result = wf.enableStatusListener("conductor:my_sink");
      expect(result).toBe(wf);
      const def = wf.toWorkflowDef();
      expect(def.workflowStatusListenerEnabled).toBe(true);
      expect(def.workflowStatusListenerSink).toBe("conductor:my_sink");
    });

    it("disableStatusListener() disables listener and returns this", () => {
      wf.enableStatusListener("conductor:my_sink");
      const result = wf.disableStatusListener();
      expect(result).toBe(wf);
      const def = wf.toWorkflowDef();
      expect(def.workflowStatusListenerEnabled).toBeUndefined();
      expect(def.workflowStatusListenerSink).toBeUndefined();
    });
  });

  // ── toWorkflowDef() ─────────────────────────────────────────────

  describe("toWorkflowDef()", () => {
    it("returns a complete WorkflowDef with all configured fields", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "full_workflow")
        .version(2)
        .description("Full workflow")
        .timeoutPolicy("TIME_OUT_WF")
        .timeoutSeconds(7200)
        .ownerEmail("admin@example.com")
        .failureWorkflow("compensate")
        .restartable(false)
        .inputParameters(["orderId", "customerId"])
        .inputTemplate({ orderId: "default-id" })
        .outputParameters({ result: "${task1.output.data}" })
        .variables({ counter: 0, flag: true })
        .enableStatusListener("conductor:status_sink")
        .add(makeTask("step1"));

      const def = wf.toWorkflowDef();

      expect(def.name).toBe("full_workflow");
      expect(def.version).toBe(2);
      expect(def.description).toBe("Full workflow");
      expect(def.timeoutPolicy).toBe("TIME_OUT_WF");
      expect(def.timeoutSeconds).toBe(7200);
      expect(def.ownerEmail).toBe("admin@example.com");
      expect(def.failureWorkflow).toBe("compensate");
      expect(def.restartable).toBe(false);
      expect(def.inputParameters).toEqual(["orderId", "customerId"]);
      expect(def.inputTemplate).toEqual({ orderId: "default-id" });
      expect(def.outputParameters).toEqual({
        result: "${task1.output.data}",
      });
      expect(def.variables).toEqual({ counter: 0, flag: true });
      expect(def.workflowStatusListenerEnabled).toBe(true);
      expect(def.workflowStatusListenerSink).toBe("conductor:status_sink");
      expect(def.tasks).toHaveLength(1);
      expect(def.tasks[0].taskReferenceName).toBe("step1");
    });

    it("has correct defaults: timeoutSeconds=60, restartable=true, failureWorkflow=''", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "defaults_wf");
      const def = wf.toWorkflowDef();

      expect(def.timeoutSeconds).toBe(60);
      expect(def.restartable).toBe(true);
      expect(def.failureWorkflow).toBe("");
    });
  });

  // ── toSubWorkflowTask() ─────────────────────────────────────────

  describe("toSubWorkflowTask()", () => {
    it("returns a WorkflowTask with type SUB_WORKFLOW", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "child_wf", 2);
      wf.add(makeTask("inner_task"));
      const subTask = wf.toSubWorkflowTask("child_ref");

      expect(subTask.type).toBe(TaskType.SUB_WORKFLOW);
      expect(subTask.name).toBe("child_ref");
      expect(subTask.taskReferenceName).toBe("child_ref");
    });

    it("has subWorkflowParam.name and subWorkflowParam.version", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "child_wf", 3);
      const subTask = wf.toSubWorkflowTask("child_ref");
      const param = subTask.subWorkflowParam as unknown as Record<
        string,
        unknown
      >;

      expect(param.name).toBe("child_wf");
      expect(param.version).toBe(3);
    });

    it("has subWorkflowParam.workflowDefinition (the embedded def)", () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "child_wf", 2);
      wf.add(makeTask("inner_task"));
      const subTask = wf.toSubWorkflowTask("child_ref");
      const param = subTask.subWorkflowParam as unknown as Record<
        string,
        unknown
      >;

      const embeddedDef = param.workflowDefinition as Record<string, unknown>;
      expect(embeddedDef).toBeDefined();
      expect(embeddedDef.name).toBe("child_wf");
      expect(embeddedDef.version).toBe(2);
      expect((embeddedDef.tasks as WorkflowTask[])[0].taskReferenceName).toBe(
        "inner_task"
      );
    });
  });

  // ── Reference Helpers ────────────────────────────────────────────

  describe("reference helpers", () => {
    it('input("orderId") returns "${workflow.input.orderId}"', () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "wf");
      expect(wf.input("orderId")).toBe("${workflow.input.orderId}");
    });

    it('output("total") returns "${workflow.output.total}"', () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "wf");
      expect(wf.output("total")).toBe("${workflow.output.total}");
    });

    it('output() with no args returns "${workflow.output}"', () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "wf");
      expect(wf.output()).toBe("${workflow.output}");
    });
  });

  // ── Execution (mocked) ──────────────────────────────────────────

  describe("execution (mocked)", () => {
    it("register() calls executor.registerWorkflow with the workflow def", async () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "register_wf")
        .version(2)
        .add(makeTask("step1"));

      await wf.register();

      expect(mockExecutor.registerWorkflow).toHaveBeenCalledTimes(1);
      const [overwrite, def] = (
        mockExecutor.registerWorkflow as jest.Mock
      ).mock.calls[0] as [boolean, Record<string, unknown>];
      expect(overwrite).toBe(true);
      expect(def.name).toBe("register_wf");
      expect(def.version).toBe(2);
    });

    it("startWorkflow() calls executor.startWorkflow with the correct request", async () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "start_wf", 3);

      const result = await wf.startWorkflow(
        { orderId: "abc" },
        "corr-123",
        5
      );

      expect(result).toBe("wf-id-123");
      expect(mockExecutor.startWorkflow).toHaveBeenCalledTimes(1);
      const [request] = (mockExecutor.startWorkflow as jest.Mock).mock
        .calls[0] as [Record<string, unknown>];
      expect(request.name).toBe("start_wf");
      expect(request.version).toBe(3);
      expect(request.input).toEqual({ orderId: "abc" });
      expect(request.correlationId).toBe("corr-123");
      expect(request.priority).toBe(5);
    });

    it("execute() calls executor.executeWorkflow with the correct arguments", async () => {
      const mockExecutor = createMockExecutor();
      const wf = new ConductorWorkflow(mockExecutor, "exec_wf", 2);

      const result = await wf.execute({ key: "value" });

      expect(result).toEqual({ workflowId: "wf-123" });
      expect(mockExecutor.executeWorkflow).toHaveBeenCalledTimes(1);
      const args = (mockExecutor.executeWorkflow as jest.Mock).mock
        .calls[0] as unknown[];
      // First arg is the StartWorkflowRequest
      expect(args[0].name).toBe("exec_wf");
      expect(args[0].version).toBe(2);
      expect(args[0].input).toEqual({ key: "value" });
      // Second arg is the workflow name
      expect(args[1]).toBe("exec_wf");
      // Third arg is the version
      expect(args[2]).toBe(2);
      // Fourth arg is the requestId (a UUID string)
      expect(typeof args[3]).toBe("string");
      expect(args[3].length).toBeGreaterThan(0);
    });
  });
});
