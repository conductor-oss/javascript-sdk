import {
  expect,
  describe,
  test,
  jest,
  beforeAll,
  afterAll,
} from "@jest/globals";
import {
  TaskType,
  type WorkflowDef,
  type Client,
} from "../open-api";
import {
  ConductorWorkflow,
  MetadataClient,
  WorkflowExecutor,
  orkesConductorClient,
  simpleTask,
  setVariableTask,
  llmChatCompleteTask,
  Role,
} from "../sdk";
import { waitForWorkflowStatus } from "./utils/waitForWorkflowStatus";

/**
 * E2E Integration Tests for ConductorWorkflow DSL
 *
 * Tests the fluent workflow builder end-to-end:
 * - Build workflow with .add(), .fork(), config methods
 * - .register() — verify on server via getWorkflowDef
 * - .execute() — with workers, verify output
 * - .startWorkflow() → waitForWorkflowStatus
 * - .toSubWorkflowTask() — register parent+child, execute, verify child ran
 * - .input() / .output() parameter expressions in real workflows
 * - LLM task builders — register workflow with llmChatCompleteTask, verify definition
 */
describe("ConductorWorkflow DSL", () => {
  jest.setTimeout(60000);

  let client: Client;
  let executor: WorkflowExecutor;
  let metadataClient: MetadataClient;

  const suffix = Date.now();

  const workflowsToCleanup: { name: string; version: number }[] = [];
  const executionsToCleanup: string[] = [];

  beforeAll(async () => {
    client = await orkesConductorClient();
    executor = new WorkflowExecutor(client);
    metadataClient = new MetadataClient(client);
  });

  afterAll(async () => {
    for (const execId of executionsToCleanup) {
      try {
        const status = await executor.getWorkflowStatus(execId, false, false);
        if (
          status?.status &&
          !["COMPLETED", "FAILED", "TERMINATED", "TIMED_OUT"].includes(
            status.status
          )
        ) {
          await executor.terminate(execId, "Test cleanup");
        }
      } catch {
        // Ignore
      }
    }
    for (const wf of workflowsToCleanup) {
      try {
        await metadataClient.unregisterWorkflow(wf.name, wf.version);
      } catch {
        // Ignore
      }
    }
  });

  // ==================== Basic Building & Registration ====================

  describe("Build and Register", () => {
    const wfName = `jsSdkTest-dsl-basic-${suffix}`;

    test("should build a workflow with add() and register it", async () => {
      const wf = new ConductorWorkflow(executor, wfName)
        .add(
          setVariableTask("set_var_ref", {
            greeting: "hello from DSL",
          })
        )
        .description("DSL test workflow")
        .timeoutSeconds(300)
        .ownerEmail("test@example.com");

      await wf.register();
      workflowsToCleanup.push({ name: wfName, version: 1 });

      // Verify on server
      const def = await metadataClient.getWorkflowDef(wfName, 1);
      expect(def).toBeDefined();
      expect(def.name).toEqual(wfName);
      expect(def.description).toEqual("DSL test workflow");
      expect(def.timeoutSeconds).toEqual(300);
      expect(def.tasks.length).toEqual(1);
      expect(def.tasks[0].taskReferenceName).toEqual("set_var_ref");
    });

    test("getName and getVersion should return correct values", () => {
      const wf = new ConductorWorkflow(executor, "test-name", 5);
      expect(wf.getName()).toEqual("test-name");
      expect(wf.getVersion()).toEqual(5);
    });

    test("toWorkflowDef should return a valid WorkflowDef", () => {
      const wf = new ConductorWorkflow(executor, "test-def")
        .add(
          setVariableTask("ref1", { key: "val" })
        )
        .timeoutSeconds(120)
        .timeoutPolicy("ALERT_ONLY")
        .restartable(false)
        .failureWorkflow("failure-wf")
        .inputParameters(["param1", "param2"])
        .inputTemplate({ param1: "default" })
        .outputParameters({ result: "${set_var_ref.output.key}" })
        .variables({ counter: 0 });

      const def = wf.toWorkflowDef();

      expect(def.name).toEqual("test-def");
      expect(def.timeoutSeconds).toEqual(120);
      expect(def.timeoutPolicy).toEqual("ALERT_ONLY");
      expect(def.restartable).toBe(false);
      expect(def.failureWorkflow).toEqual("failure-wf");
      expect(def.inputParameters).toEqual(["param1", "param2"]);
      expect(def.inputTemplate).toEqual({ param1: "default" });
      expect(def.outputParameters).toEqual({
        result: "${set_var_ref.output.key}",
      });
      expect(def.variables).toEqual({ counter: 0 });
    });
  });

  // ==================== Execute Workflow ====================

  describe("Execute Workflow", () => {
    const wfName = `jsSdkTest-dsl-execute-${suffix}`;

    test("execute() should run workflow synchronously and return result", async () => {
      const wf = new ConductorWorkflow(executor, wfName)
        .add(
          setVariableTask("exec_ref", {
            message: "executed",
          })
        )
        .timeoutSeconds(60);

      await wf.register();
      workflowsToCleanup.push({ name: wfName, version: 1 });

      const run = await wf.execute({ testInput: "hello" });

      expect(run).toBeDefined();
      expect(run.status).toEqual("COMPLETED");
    });
  });

  // ==================== Start Workflow ====================

  describe("Start Workflow", () => {
    const wfName = `jsSdkTest-dsl-start-${suffix}`;

    test("startWorkflow() should start asynchronously and return ID", async () => {
      const wf = new ConductorWorkflow(executor, wfName)
        .add(
          setVariableTask("start_ref", {
            value: "started",
          })
        )
        .timeoutSeconds(60);

      await wf.register();
      workflowsToCleanup.push({ name: wfName, version: 1 });

      const workflowId = await wf.startWorkflow({ input1: "test" });
      executionsToCleanup.push(workflowId);

      expect(workflowId).toBeTruthy();

      const status = await waitForWorkflowStatus(
        executor,
        workflowId,
        "COMPLETED"
      );
      expect(status.status).toEqual("COMPLETED");
    });

    test("startWorkflow() with correlationId should set correlation", async () => {
      const wf = new ConductorWorkflow(executor, wfName);
      const correlationId = `dsl-corr-${suffix}`;

      const workflowId = await wf.startWorkflow(
        {},
        correlationId
      );
      executionsToCleanup.push(workflowId);

      const execution = await executor.getExecution(workflowId);
      expect(execution.correlationId).toEqual(correlationId);
    });
  });

  // ==================== Fork/Join ====================

  describe("Fork/Join", () => {
    const wfName = `jsSdkTest-dsl-fork-${suffix}`;

    test("fork() should create parallel branches with auto-join", async () => {
      const wf = new ConductorWorkflow(executor, wfName)
        .fork([
          [
            setVariableTask("branch1_ref", {
              branch: 1,
            }),
          ],
          [
            setVariableTask("branch2_ref", {
              branch: 2,
            }),
          ],
        ])
        .timeoutSeconds(60);

      await wf.register();
      workflowsToCleanup.push({ name: wfName, version: 1 });

      // Verify structure
      const def = await metadataClient.getWorkflowDef(wfName, 1);
      expect(def.tasks.length).toEqual(2); // FORK_JOIN + JOIN

      const forkTask = def.tasks[0];
      expect(forkTask.type).toEqual(TaskType.FORK_JOIN);
      expect(forkTask.forkTasks?.length).toEqual(2);

      const joinTask = def.tasks[1];
      expect(joinTask.type).toEqual(TaskType.JOIN);

      // Execute to verify it works
      const run = await wf.execute();
      expect(run.status).toEqual("COMPLETED");
    });
  });

  // ==================== SubWorkflow Task ====================

  describe("SubWorkflow Task", () => {
    const childWfName = `jsSdkTest-dsl-child-${suffix}`;
    const parentWfName = `jsSdkTest-dsl-parent-${suffix}`;

    test("toSubWorkflowTask() should embed child workflow in parent", async () => {
      // Build child workflow
      const childWf = new ConductorWorkflow(executor, childWfName)
        .add(
          setVariableTask("child_ref", {
            childResult: "from_child",
          })
        )
        .timeoutSeconds(60);

      // Register child
      await childWf.register();
      workflowsToCleanup.push({ name: childWfName, version: 1 });

      // Build parent with child as sub-workflow
      const parentWf = new ConductorWorkflow(executor, parentWfName)
        .add(childWf.toSubWorkflowTask("sub_wf_ref"))
        .timeoutSeconds(60);

      await parentWf.register();
      workflowsToCleanup.push({ name: parentWfName, version: 1 });

      // Verify parent definition
      const def = await metadataClient.getWorkflowDef(parentWfName, 1);
      const subTask = def.tasks[0];
      expect(subTask.type).toEqual(TaskType.SUB_WORKFLOW);
      expect(subTask.taskReferenceName).toEqual("sub_wf_ref");

      // Execute parent — child should run automatically
      const run = await parentWf.execute();
      expect(run.status).toEqual("COMPLETED");
    });
  });

  // ==================== Input/Output References ====================

  describe("Input/Output References", () => {
    test("input() should generate workflow input reference", () => {
      const wf = new ConductorWorkflow(executor, "ref-test");

      expect(wf.input("orderId")).toEqual("${workflow.input.orderId}");
      expect(wf.input("customer.name")).toEqual(
        "${workflow.input.customer.name}"
      );
    });

    test("output() should generate workflow output reference", () => {
      const wf = new ConductorWorkflow(executor, "ref-test");

      expect(wf.output("result")).toEqual("${workflow.output.result}");
      expect(wf.output()).toEqual("${workflow.output}");
    });

    test("input/output references should work in real workflows", async () => {
      const wfName = `jsSdkTest-dsl-refs-${suffix}`;

      const wf = new ConductorWorkflow(executor, wfName)
        .add(
          setVariableTask("ref_test_ref", {
            capturedInput: "${workflow.input.myParam}",
          })
        )
        .inputParameters(["myParam"])
        .outputParameters({
          capturedParam: "${workflow.input.myParam}",
        })
        .timeoutSeconds(60);

      await wf.register();
      workflowsToCleanup.push({ name: wfName, version: 1 });

      const run = await wf.execute({ myParam: "hello-world" });
      expect(run.status).toEqual("COMPLETED");
      expect(run.output?.capturedParam).toEqual("hello-world");
    });
  });

  // ==================== Configuration Methods ====================

  describe("Configuration Methods", () => {
    test("version() should set workflow version", () => {
      const wf = new ConductorWorkflow(executor, "ver-test").version(3);
      expect(wf.getVersion()).toEqual(3);
    });

    test("multiple add() calls should chain tasks sequentially", () => {
      const wf = new ConductorWorkflow(executor, "chain-test")
        .add(setVariableTask("step1", { a: 1 }))
        .add(setVariableTask("step2", { b: 2 }))
        .add(setVariableTask("step3", { c: 3 }));

      const def = wf.toWorkflowDef();
      expect(def.tasks.length).toEqual(3);
      expect(def.tasks[0].taskReferenceName).toEqual("step1");
      expect(def.tasks[1].taskReferenceName).toEqual("step2");
      expect(def.tasks[2].taskReferenceName).toEqual("step3");
    });

    test("add() with array should add multiple tasks at once", () => {
      const wf = new ConductorWorkflow(executor, "batch-test").add([
        setVariableTask("batch1", { x: 1 }),
        setVariableTask("batch2", { y: 2 }),
      ]);

      const def = wf.toWorkflowDef();
      expect(def.tasks.length).toEqual(2);
    });
  });

  // ==================== LLM Task Builders ====================

  describe("LLM Task Builders", () => {
    const wfName = `jsSdkTest-dsl-llm-${suffix}`;

    test("llmChatCompleteTask should create valid LLM task definition", async () => {
      const wf = new ConductorWorkflow(executor, wfName)
        .add(
          llmChatCompleteTask("llm_ref", "openai", "gpt-4o", {
            messages: [
              { role: Role.USER, message: "Hello" },
            ],
            temperature: 0.7,
            maxTokens: 100,
          })
        )
        .timeoutSeconds(60);

      await wf.register();
      workflowsToCleanup.push({ name: wfName, version: 1 });

      // Verify definition on server
      const def = await metadataClient.getWorkflowDef(wfName, 1);
      const llmTask = def.tasks[0];

      expect(llmTask.type).toEqual(TaskType.LLM_CHAT_COMPLETE);
      expect(llmTask.inputParameters?.llmProvider).toEqual("openai");
      expect(llmTask.inputParameters?.model).toEqual("gpt-4o");
      expect(llmTask.inputParameters?.temperature).toEqual(0.7);
      expect(llmTask.inputParameters?.maxTokens).toEqual(100);
    });
  });

  // ==================== Status Listener ====================

  describe("Status Listener Configuration", () => {
    test("enableStatusListener should set listener config in def", () => {
      const wf = new ConductorWorkflow(executor, "listener-test")
        .add(setVariableTask("ref1", {}))
        .enableStatusListener("conductor:my_sink");

      const def = wf.toWorkflowDef();
      expect(def.workflowStatusListenerEnabled).toBe(true);
      expect(def.workflowStatusListenerSink).toEqual("conductor:my_sink");
    });

    test("disableStatusListener should clear listener config", () => {
      const wf = new ConductorWorkflow(executor, "listener-test")
        .add(setVariableTask("ref1", {}))
        .enableStatusListener("conductor:my_sink")
        .disableStatusListener();

      const def = wf.toWorkflowDef();
      expect(def.workflowStatusListenerEnabled).toBeUndefined();
    });
  });
});
