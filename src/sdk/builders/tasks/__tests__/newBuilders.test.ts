import { describe, it, expect } from "@jest/globals";
import { startWorkflowTask } from "../startWorkflow";
import { dynamicTask } from "../dynamic";
import { humanTask } from "../humanTask";
import { httpPollTask } from "../httpPoll";
import { waitForWebhookTask } from "../waitForWebhook";
import { getDocumentTask } from "../getDocument";

describe("startWorkflowTask", () => {
  it("Should generate a startWorkflow task with minimal args", () => {
    const tname = "startWfRef";
    const result = startWorkflowTask(tname, "myWorkflow");
    expect(result).toEqual({
      name: "startWfRef",
      taskReferenceName: "startWfRef",
      type: "START_WORKFLOW",
      inputParameters: {
        startWorkflow: {
          name: "myWorkflow",
          version: undefined,
          input: undefined,
          correlationId: undefined,
        },
      },
      optional: undefined,
    });
  });

  it("Should generate a startWorkflow task with all args", () => {
    const tname = "startWfFull";
    const result = startWorkflowTask(
      tname,
      "myWorkflow",
      { key: "value" },
      2,
      "corr-123"
    );
    expect(result).toEqual({
      name: "startWfFull",
      taskReferenceName: "startWfFull",
      type: "START_WORKFLOW",
      inputParameters: {
        startWorkflow: {
          name: "myWorkflow",
          version: 2,
          input: { key: "value" },
          correlationId: "corr-123",
        },
      },
      optional: undefined,
    });
  });

  it("Should generate a startWorkflow task with optional=true", () => {
    const tname = "startWfOptional";
    const result = startWorkflowTask(
      tname,
      "myWorkflow",
      { foo: "bar" },
      1,
      "corr-456",
      true
    );
    expect(result).toEqual({
      name: "startWfOptional",
      taskReferenceName: "startWfOptional",
      type: "START_WORKFLOW",
      inputParameters: {
        startWorkflow: {
          name: "myWorkflow",
          version: 1,
          input: { foo: "bar" },
          correlationId: "corr-456",
        },
      },
      optional: true,
    });
  });
});

describe("dynamicTask", () => {
  it("Should generate a dynamic task with default param name", () => {
    const tname = "dynamicRef";
    const result = dynamicTask(tname, "my_dynamic_task");
    expect(result).toEqual({
      name: "dynamicRef",
      taskReferenceName: "dynamicRef",
      type: "DYNAMIC",
      dynamicTaskNameParam: "taskToExecute",
      inputParameters: {
        taskToExecute: "my_dynamic_task",
      },
      optional: undefined,
    });
  });

  it("Should generate a dynamic task with custom param name", () => {
    const tname = "dynamicCustomParam";
    const result = dynamicTask(tname, "my_task", "customParam");
    expect(result).toEqual({
      name: "dynamicCustomParam",
      taskReferenceName: "dynamicCustomParam",
      type: "DYNAMIC",
      dynamicTaskNameParam: "customParam",
      inputParameters: {
        customParam: "my_task",
      },
      optional: undefined,
    });
  });

  it("Should generate a dynamic task with optional=true", () => {
    const tname = "dynamicOptional";
    const result = dynamicTask(tname, "opt_task", "taskToExecute", true);
    expect(result).toEqual({
      name: "dynamicOptional",
      taskReferenceName: "dynamicOptional",
      type: "DYNAMIC",
      dynamicTaskNameParam: "taskToExecute",
      inputParameters: {
        taskToExecute: "opt_task",
      },
      optional: true,
    });
  });
});

describe("humanTask", () => {
  it("Should generate a human task with no options", () => {
    const tname = "humanRef";
    const result = humanTask(tname);
    expect(result).toEqual({
      name: "humanRef",
      taskReferenceName: "humanRef",
      type: "HUMAN",
      inputParameters: {
        __humanTaskDefinition: {},
      },
      optional: undefined,
    });
  });

  it("Should generate a human task with displayName", () => {
    const tname = "humanDisplay";
    const result = humanTask(tname, { displayName: "Approve Request" });
    expect(result).toEqual({
      name: "humanDisplay",
      taskReferenceName: "humanDisplay",
      type: "HUMAN",
      inputParameters: {
        __humanTaskDefinition: {
          displayName: "Approve Request",
        },
      },
      optional: undefined,
    });
  });

  it("Should generate a human task with formTemplate and version", () => {
    const tname = "humanForm";
    const result = humanTask(tname, {
      formTemplate: "approvalForm",
      formVersion: 3,
    });
    expect(result).toEqual({
      name: "humanForm",
      taskReferenceName: "humanForm",
      type: "HUMAN",
      inputParameters: {
        __humanTaskDefinition: {
          userFormTemplate: {
            name: "approvalForm",
            version: 3,
          },
        },
      },
      optional: undefined,
    });
  });

  it("Should default formVersion to 0 when formTemplate is provided without version", () => {
    const tname = "humanFormNoVer";
    const result = humanTask(tname, { formTemplate: "myForm" });
    expect(result).toEqual({
      name: "humanFormNoVer",
      taskReferenceName: "humanFormNoVer",
      type: "HUMAN",
      inputParameters: {
        __humanTaskDefinition: {
          userFormTemplate: {
            name: "myForm",
            version: 0,
          },
        },
      },
      optional: undefined,
    });
  });

  it("Should generate a human task with assignee", () => {
    const tname = "humanAssignee";
    const result = humanTask(tname, {
      assignee: { userType: "EXTERNAL_USER", user: "john@example.com" },
    });
    expect(result).toEqual({
      name: "humanAssignee",
      taskReferenceName: "humanAssignee",
      type: "HUMAN",
      inputParameters: {
        __humanTaskDefinition: {
          assignee: {
            userType: "EXTERNAL_USER",
            user: "john@example.com",
          },
        },
      },
      optional: undefined,
    });
  });

  it("Should generate a human task with assignmentCompletionStrategy", () => {
    const tname = "humanStrategy";
    const result = humanTask(tname, {
      assignmentCompletionStrategy: "TERMINATE",
    });
    expect(result).toEqual({
      name: "humanStrategy",
      taskReferenceName: "humanStrategy",
      type: "HUMAN",
      inputParameters: {
        __humanTaskDefinition: {
          assignmentCompletionStrategy: "TERMINATE",
        },
      },
      optional: undefined,
    });
  });

  it("Should generate a human task with all options combined", () => {
    const tname = "humanFull";
    const result = humanTask(tname, {
      displayName: "Full Review",
      formTemplate: "reviewForm",
      formVersion: 2,
      assignee: { userType: "EXTERNAL_GROUP", user: "reviewers" },
      assignmentCompletionStrategy: "LEAVE_OPEN",
      optional: true,
    });
    expect(result).toEqual({
      name: "humanFull",
      taskReferenceName: "humanFull",
      type: "HUMAN",
      inputParameters: {
        __humanTaskDefinition: {
          assignmentCompletionStrategy: "LEAVE_OPEN",
          displayName: "Full Review",
          userFormTemplate: {
            name: "reviewForm",
            version: 2,
          },
          assignee: {
            userType: "EXTERNAL_GROUP",
            user: "reviewers",
          },
        },
      },
      optional: true,
    });
  });
});

describe("httpPollTask", () => {
  it("Should generate an httpPoll task with basic http_request", () => {
    const tname = "httpPollRef";
    const result = httpPollTask(tname, {
      http_request: {
        uri: "https://api.example.com/status",
        method: "GET",
      },
    });
    expect(result).toEqual({
      name: "httpPollRef",
      taskReferenceName: "httpPollRef",
      type: "HTTP_POLL",
      inputParameters: {
        http_request: {
          uri: "https://api.example.com/status",
          method: "GET",
        },
      },
      optional: undefined,
    });
  });

  it("Should generate an httpPoll task with pollingInterval and terminationCondition", () => {
    const tname = "httpPollFull";
    const result = httpPollTask(tname, {
      http_request: {
        uri: "https://api.example.com/job/123",
        method: "GET",
      },
      pollingInterval: 30,
      pollingStrategy: "FIXED",
      terminationCondition: "$.status === 'COMPLETED'",
    });
    expect(result).toEqual({
      name: "httpPollFull",
      taskReferenceName: "httpPollFull",
      type: "HTTP_POLL",
      inputParameters: {
        http_request: {
          uri: "https://api.example.com/job/123",
          method: "GET",
        },
        pollingInterval: 30,
        pollingStrategy: "FIXED",
        terminationCondition: "$.status === 'COMPLETED'",
      },
      optional: undefined,
    });
  });

  it("Should generate an httpPoll task with optional=true", () => {
    const tname = "httpPollOptional";
    const result = httpPollTask(
      tname,
      {
        http_request: {
          uri: "https://api.example.com/check",
          method: "POST",
        },
      },
      true
    );
    expect(result).toEqual({
      name: "httpPollOptional",
      taskReferenceName: "httpPollOptional",
      type: "HTTP_POLL",
      inputParameters: {
        http_request: {
          uri: "https://api.example.com/check",
          method: "POST",
        },
      },
      optional: true,
    });
  });
});

describe("waitForWebhookTask", () => {
  it("Should generate a waitForWebhook task with no options", () => {
    const tname = "webhookRef";
    const result = waitForWebhookTask(tname);
    expect(result).toEqual({
      name: "webhookRef",
      taskReferenceName: "webhookRef",
      type: "WAIT_FOR_WEBHOOK",
      inputParameters: {},
      optional: undefined,
    });
  });

  it("Should generate a waitForWebhook task with matches", () => {
    const tname = "webhookMatches";
    const result = waitForWebhookTask(tname, {
      matches: {
        "$['event']['type']": "order.completed",
        "$['event']['source']": "payment-service",
      },
    });
    expect(result).toEqual({
      name: "webhookMatches",
      taskReferenceName: "webhookMatches",
      type: "WAIT_FOR_WEBHOOK",
      inputParameters: {
        "$['event']['type']": "order.completed",
        "$['event']['source']": "payment-service",
      },
      optional: undefined,
    });
  });

  it("Should generate a waitForWebhook task with optional=true", () => {
    const tname = "webhookOptional";
    const result = waitForWebhookTask(tname, {
      matches: { hookId: "abc" },
      optional: true,
    });
    expect(result).toEqual({
      name: "webhookOptional",
      taskReferenceName: "webhookOptional",
      type: "WAIT_FOR_WEBHOOK",
      inputParameters: {
        hookId: "abc",
      },
      optional: true,
    });
  });
});

describe("getDocumentTask", () => {
  it("Should generate a getDocument task with url only", () => {
    const tname = "getDocRef";
    const result = getDocumentTask(tname, "https://example.com/doc.pdf");
    expect(result).toEqual({
      name: "getDocRef",
      taskReferenceName: "getDocRef",
      type: "GET_DOCUMENT",
      inputParameters: {
        url: "https://example.com/doc.pdf",
      },
      optional: undefined,
    });
  });

  it("Should generate a getDocument task with mediaType option", () => {
    const tname = "getDocMedia";
    const result = getDocumentTask(tname, "https://example.com/report.pdf", {
      mediaType: "application/pdf",
    });
    expect(result).toEqual({
      name: "getDocMedia",
      taskReferenceName: "getDocMedia",
      type: "GET_DOCUMENT",
      inputParameters: {
        url: "https://example.com/report.pdf",
        mediaType: "application/pdf",
      },
      optional: undefined,
    });
  });

  it("Should generate a getDocument task with optional=true", () => {
    const tname = "getDocOptional";
    const result = getDocumentTask(tname, "https://example.com/file.html", {
      mediaType: "text/html",
      optional: true,
    });
    expect(result).toEqual({
      name: "getDocOptional",
      taskReferenceName: "getDocOptional",
      type: "GET_DOCUMENT",
      inputParameters: {
        url: "https://example.com/file.html",
        mediaType: "text/html",
      },
      optional: true,
    });
  });
});
