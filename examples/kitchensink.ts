/**
 * Kitchen Sink — Every major task type in a single workflow
 *
 * Demonstrates: simpleTask, httpTask, inlineTask, jsonJqTask, switchTask,
 * forkJoinTask, waitTaskDuration, setVariableTask, terminateTask, subWorkflowTask,
 * doWhileTask, and eventTask.
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/kitchensink.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
  httpTask,
  inlineTask,
  jsonJqTask,
  switchTask,
  waitTaskDuration,
  setVariableTask,
  subWorkflowTask,
  doWhileTask,
} from "../src/sdk";
import type { Task } from "../src/open-api";

// ── Workers ─────────────────────────────────────────────────────────
const simpleWorker = worker({ taskDefName: "ks_simple_worker", registerTaskDef: true })(
  async (task: Task) => {
    return {
      status: "COMPLETED",
      outputData: { processed: true, input: task.inputData },
    };
  }
);

const branchA = worker({ taskDefName: "ks_branch_a", registerTaskDef: true })(
  async (task: Task) => {
    return {
      status: "COMPLETED",
      outputData: { branch: "A", done: true },
    };
  }
);

const branchB = worker({ taskDefName: "ks_branch_b", registerTaskDef: true })(
  async (task: Task) => {
    return {
      status: "COMPLETED",
      outputData: { branch: "B", done: true },
    };
  }
);

const loopTask = worker({ taskDefName: "ks_loop_task", registerTaskDef: true })(
  async (task: Task) => {
    const iteration = (task.inputData?.iteration as number) ?? 0;
    return {
      status: "COMPLETED",
      outputData: { iteration, processed: true },
    };
  }
);

// ── Workflow ─────────────────────────────────────────────────────────
async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  // ── Sub-workflow (registered separately) ──
  const subWf = new ConductorWorkflow(workflowClient, "ks_sub_workflow")
    .add(
      simpleTask("sub_simple_ref", "ks_simple_worker", {
        message: "${workflow.input.subMessage}",
      })
    )
    .outputParameters({ subResult: "${sub_simple_ref.output.processed}" });
  await subWf.register(true);

  // ── Main kitchen-sink workflow ──
  const wf = new ConductorWorkflow(workflowClient, "kitchen_sink_workflow")
    .description("Demonstrates every major task type");

  // 1. Simple task
  wf.add(
    simpleTask("simple_ref", "ks_simple_worker", {
      key: "${workflow.input.inputValue}",
    })
  );

  // 2. HTTP task
  wf.add(
    httpTask("http_ref", {
      uri: "https://jsonplaceholder.typicode.com/posts/1",
      method: "GET",
    })
  );

  // 3. Inline (JavaScript) task
  wf.add(
    inlineTask(
      "inline_ref",
      `(function() {
        return { doubled: $.value * 2 };
      })()`,
      "javascript"
    )
  );

  // 4. JSON JQ Transform task
  wf.add(
    jsonJqTask("jq_ref", ".http_ref.output.body | { title: .title, id: .id }")
  );

  // 5. Set variable task
  wf.add(
    setVariableTask("set_var_ref", {
      counter: 0,
      status: "in_progress",
    })
  );

  // 6. Switch task (decision)
  wf.add(
    switchTask(
      "switch_ref",
      "${workflow.input.route}",
      {
        fast: [
          simpleTask("fast_path_ref", "ks_simple_worker", { path: "fast" }),
        ],
        slow: [
          simpleTask("slow_path_ref", "ks_simple_worker", { path: "slow" }),
        ],
      },
      [simpleTask("default_path_ref", "ks_simple_worker", { path: "default" })]
    )
  );

  // 7. Fork/Join — parallel branches (using fluent API)
  wf.fork([
    [simpleTask("branch_a_ref", "ks_branch_a", {})],
    [simpleTask("branch_b_ref", "ks_branch_b", {})],
  ]);

  // 8. Do-While loop
  wf.add(
    doWhileTask(
      "loop_ref",
      'if ($.loop_task_ref["iteration"] >= 3) { false; } else { true; }',
      [
        simpleTask("loop_task_ref", "ks_loop_task", {
          iteration: "${loop_ref.output.iteration}",
        }),
      ]
    )
  );

  // 9. Wait task
  wf.add(waitTaskDuration("wait_ref", "1s"));

  // 10. Sub-workflow task
  wf.add(subWorkflowTask("sub_wf_ref", "ks_sub_workflow", 1));

  // Output
  wf.outputParameters({
    simpleResult: "${simple_ref.output.processed}",
    httpTitle: "${http_ref.output.body.title}",
    inlineResult: "${inline_ref.output.result}",
    jqResult: "${jq_ref.output.result}",
    branchA: "${branch_a_ref.output.branch}",
    branchB: "${branch_b_ref.output.branch}",
    subResult: "${sub_wf_ref.output.subResult}",
  });

  await wf.register(true);
  console.log("Registered kitchen-sink workflow:", wf.getName());

  // Execute
  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  const run = await wf.execute({
    inputValue: 42,
    route: "fast",
    subMessage: "hello from sub",
  });

  console.log("Status:", run.status);
  console.log("Output:", JSON.stringify(run.output, null, 2));

  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
