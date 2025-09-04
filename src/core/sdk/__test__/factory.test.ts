import { expect, describe, it } from "@jest/globals";
import { doWhileTask, newLoopTask } from "../doWhile";
import { dynamicForkTask } from "../dynamicFork";
import { eventTask, sqsEventTask, conductorEventTask } from "../event";
import { forkTask, forkTaskJoin } from "../forkJoin";
import { httpTask } from "../http";
import { inlineTask } from "../inline";
import { joinTask } from "../join";
import { jsonJqTask } from "../jsonJq";
import { kafkaPublishTask } from "../kafkaPublish";
import { setVariableTask } from "../setVariable";
import { subWorkflowTask } from "../subWorkflow";
import { switchTask } from "../switch";
import { terminateTask } from "../terminate";
import { waitTaskDuration, waitTaskUntil } from "../wait";
import { workflow } from "../workflow";

describe("doWhileTask", () => {
  it("Should generate a doWhile task ", () => {
    const doWhileObj = doWhileTask("name", "false", []);
    expect(doWhileObj).toEqual({
      name: "name",
      taskReferenceName: "name",
      loopCondition: "false",
      inputParameters: {},
      type: "DO_WHILE",
      loopOver: [],
    });
  });
  it("Should generate the template for a common loop task", () => {
    const tname = "whileName";
    const doWhileObj = newLoopTask(tname, 5, []);
    expect(doWhileObj).toEqual({
      name: tname,
      taskReferenceName: tname,
      loopCondition:
        "if ( $.whileName['iteration'] < $.value ) { true; } else { false; }",
      inputParameters: { value: 5 },
      type: "DO_WHILE",
      loopOver: [],
    });
  });
});

describe("dynamicForkTask", () => {
  it("Should generate a dynamic task", () => {
    const tname = "dynnamicForkTask";
    const dynamicForkTaskObj = dynamicForkTask(tname, []);
    expect(dynamicForkTaskObj).toEqual({
      name: tname,
      taskReferenceName: tname,
      inputParameters: { dynamicTasks: [], dynamicTasksInput: "" },
      type: "FORK_JOIN_DYNAMIC",
      dynamicForkTasksParam: "dynamicTasks",
      dynamicForkTasksInputParamName: "dynamicTasksInput",
    });
  });
});

describe("eventTask", () => {
  it("Should generate an eventTask ", () => {
    const tname = "eventTask";
    const eventTaskObj = eventTask(tname, "prefix", "suffix");
    expect(eventTaskObj).toEqual({
      name: tname,
      taskReferenceName: tname,
      sink: "prefix:suffix",
      type: "EVENT",
    });
  });
  it("Should generate an sqsEvent task", () => {
    const tname = "eventTask";
    const eventTaskObj = sqsEventTask(tname, "queueName");
    expect(eventTaskObj).toEqual({
      name: tname,
      taskReferenceName: "eventTask",
      sink: "sqs:queueName",
      type: "EVENT",
    });
  });
  it("Should generate an conductorEventTask task", () => {
    const tname = "eventTask";
    const eventTaskObj = conductorEventTask(tname, "queueName");
    expect(eventTaskObj).toEqual({
      name: tname,
      taskReferenceName: "eventTask",
      sink: "conductor:queueName",
      type: "EVENT",
    });
  });
});

describe("forkTask", () => {
  it("Should generate a fork task", () => {
    const tname = "forkTask";
    const forkTaskObj = forkTask(tname, [eventTask(tname, "prefix", "suffix")]);
    expect(forkTaskObj).toEqual({
      taskReferenceName: "forkTask",
      name: "forkTask",
      type: "FORK_JOIN",
      forkTasks: [
        [
          {
            name: "forkTask",
            taskReferenceName: "forkTask",
            sink: "prefix:suffix",
            type: "EVENT",
          },
        ],
      ],
    });
  });
  it("Should return a tuple with both fork and join", () => {
    const tname = "forkTaskJoin";
    const [forkTask, joinTask] = forkTaskJoin(tname, [
      eventTask(tname, "prefix", "suffix"),
    ]);
    expect(forkTask).toEqual({
      taskReferenceName: "forkTaskJoin",
      name: "forkTaskJoin",
      type: "FORK_JOIN",
      forkTasks: [
        [
          {
            name: "forkTaskJoin",
            taskReferenceName: "forkTaskJoin",
            sink: "prefix:suffix",
            type: "EVENT",
          },
        ],
      ],
    });
    expect(joinTask).toEqual({
      name: "forkTaskJoin_join",
      taskReferenceName: "forkTaskJoin_join_ref",
      inputParameters: {},
      joinOn: [],
      optional: false,
      asyncComplete: false,
      type: "JOIN",
    });
  });
});

describe("httpTask", () => {
  it("Should generate an http task", () => {
    const tname = "httpTask";
    const httpTaskObj = httpTask(tname, {
      uri: "http://www.yahoo.com",
      method: "GET",
    });
    expect(httpTaskObj).toEqual({
      asyncComplete: false,
      name: "httpTask",
      taskReferenceName: "httpTask",
      inputParameters: {
        http_request: { uri: "http://www.yahoo.com", method: "GET" },
      },
      type: "HTTP",
    });
  });
});

describe("inlineTask", () => {
  it("Should generate inline task", () => {
    const tname = "httpTask";
    const httpTaskObj = inlineTask(tname, "( function(){ return true;} )()");
    expect(httpTaskObj).toEqual({
      name: "httpTask",
      taskReferenceName: "httpTask",
      inputParameters: {
        evaluatorType: "javascript",
        expression: "( function(){ return true;} )()",
      },
      type: "INLINE",
    });
  });
});

describe("joinTask", () => {
  it("Should generate join task", () => {
    const tname = "joinTask";
    const joinTaskObj = joinTask(tname, []);
    expect(joinTaskObj).toEqual({
      name: "joinTask",
      taskReferenceName: "joinTask",
      joinOn: [],
      type: "JOIN",
    });
  });
});
describe("jsonJqTask", () => {
  it("Should generate jsonJqTask", () => {
    const tname = "jsonJqTask";
    const jsonJqTaskObj = jsonJqTask(tname, "jq script");
    expect(jsonJqTaskObj).toEqual({
      name: "jsonJqTask",
      taskReferenceName: "jsonJqTask",
      type: "JSON_JQ_TRANSFORM",
      inputParameters: { queryExpression: "jq script" },
    });
  });
});

describe("jsonJqTask", () => {
  it("Should generate jsonJqTask", () => {
    const tname = "jsonJqTask";
    const jsonJqTaskObj = jsonJqTask(tname, "jq script");
    expect(jsonJqTaskObj).toEqual({
      name: "jsonJqTask",
      taskReferenceName: "jsonJqTask",
      type: "JSON_JQ_TRANSFORM",
      inputParameters: { queryExpression: "jq script" },
    });
  });
});

describe("kafkaPublishTask", () => {
  it("Should generate kafkaPublishTask", () => {
    const tname = "kafkaPublishTask";
    const kafkaPublishTaskObj = kafkaPublishTask(tname, {
      topic: "topic",
      value: "val",
      bootStrapServers: "asdsad",
      headers: {},
      key: "key",
      keySerializer: "serial",
    });
    expect(kafkaPublishTaskObj).toEqual({
      taskReferenceName: "kafkaPublishTask",
      name: "kafkaPublishTask",
      type: "KAFKA_PUBLISH",
      inputParameters: {
        kafka_request: {
          topic: "topic",
          value: "val",
          bootStrapServers: "asdsad",
          headers: {},
          key: "key",
          keySerializer: "serial",
        },
      },
    });
  });
});

describe("setVariableTask", () => {
  it("Should generate setVariableTask", () => {
    const tname = "setVariableTask";
    const kafkaPublishTaskObj = setVariableTask(tname, {
      varOne: "topic",
    });
    expect(kafkaPublishTaskObj).toEqual({
      name: "setVariableTask",
      taskReferenceName: "setVariableTask",
      type: "SET_VARIABLE",
      inputParameters: { varOne: "topic" },
    });
  });
});

describe("subWorkflowTask", () => {
  it("Should generate subWorkflowTask", () => {
    const tname = "subWorkflowTask";
    const subWorkflowTaskObj = subWorkflowTask(tname, "myWorkflowName");
    expect(subWorkflowTaskObj).toEqual({
      name: "subWorkflowTask",
      taskReferenceName: "subWorkflowTask",
      subWorkflowParam: { name: "myWorkflowName", version: undefined },
      type: "SUB_WORKFLOW",
    });
  });
});

describe("switchTask", () => {
  it("Should generate switchTask", () => {
    const tname = "switchTask";
    const switchTaskObj = switchTask(tname, "step", {
      step: [joinTask("pepe", [])],
    });
    expect(switchTaskObj).toEqual({
      name: "switchTask",
      taskReferenceName: "switchTask",
      decisionCases: {
        step: [
          {
            name: "pepe",
            taskReferenceName: "pepe",
            joinOn: [],
            type: "JOIN",
          },
        ],
      },
      evaluatorType: "value-param",
      inputParameters: {
        switchCaseValue: "step",
      },
      expression: "switchCaseValue",
      defaultCase: [],
      type: "SWITCH",
    });
  });
});

describe("terminateTask", () => {
  it("Should generate terminateTask", () => {
    const tname = "terminateTask";
    const terminateTaskObj = terminateTask(tname, "COMPLETED");
    expect(terminateTaskObj).toEqual({
      name: "terminateTask",
      taskReferenceName: "terminateTask",
      inputParameters: {
        terminationStatus: "COMPLETED",
        terminationReason: undefined,
      },
      type: "TERMINATE",
    });
  });
});

describe("wait", () => {
  it("Should generate waitTaskDuration", () => {
    const tname = "waitTaskDuration";
    const waitTaskDurationObj = waitTaskDuration(tname, "1h");
    expect(waitTaskDurationObj).toEqual({
      name: "waitTaskDuration",
      taskReferenceName: "waitTaskDuration",
      inputParameters: { duration: "1h" },
      type: "WAIT",
    });
  });

  it("Should generate waitTaskUntil", () => {
    const tname = "waitTaskUntil";
    const waitTaskUntilObj = waitTaskUntil(tname, "2022-12-17 03:00 GMT-03:00");
    expect(waitTaskUntilObj).toEqual({
      name: "waitTaskUntil",
      taskReferenceName: "waitTaskUntil",
      inputParameters: { until: "2022-12-17 03:00 GMT-03:00" },
      type: "WAIT",
    });
  });
});

describe("workflow", () => {
  it("Should generate a workflow with tasks", () => {
    const tname = "workflowName";
    const workflowObj = workflow(tname, []);
    expect(workflowObj).toEqual({
      name: "workflowName",
      version: 1,
      tasks: [],
      inputParameters: [],
      timeoutSeconds: 0,
    });
  });
});
