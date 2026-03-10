import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock the generated SDK modules before importing MetadataClient
jest.mock("../../../../open-api/generated", () => ({
  MetadataResource: {
    unregisterTaskDef: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: null }),
    registerTaskDef: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: null }),
    updateTaskDef: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: null }),
    getTaskDef: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: { name: "test_task" } }),
    getTaskDefs: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: [{ name: "t1" }, { name: "t2" }] }),
    create: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: null }),
    get1: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: { name: "test_wf", version: 1 } }),
    unregisterWorkflowDef: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: null }),
    getWorkflowDefs: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: [{ name: "wf1" }] }),
  },
  Tags: {
    addWorkflowTag: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: null }),
    deleteWorkflowTag: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: null }),
    getWorkflowTags: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: [{ key: "env", value: "prod" }] }),
    setWorkflowTags: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: null }),
    addTaskTag: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: null }),
    deleteTaskTag: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: null }),
    getTaskTags: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: [{ key: "team", value: "backend" }] }),
    setTaskTags: jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: null }),
  },
}));

import { MetadataClient } from "../MetadataClient";
import { MetadataResource, Tags } from "../../../../open-api/generated";
import type { Client } from "../../../../open-api";

function createMockClient(): Client {
  const mockFn = jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: null });
  return {
    buildUrl: jest.fn(),
    getConfig: jest.fn(),
    request: jest.fn(),
    setConfig: jest.fn(),
    get: mockFn as unknown as Client["get"],
    post: mockFn as unknown as Client["post"],
    put: mockFn as unknown as Client["put"],
    patch: mockFn as unknown as Client["patch"],
    delete: mockFn as unknown as Client["delete"],
    head: mockFn as unknown as Client["head"],
    options: mockFn as unknown as Client["options"],
    trace: mockFn as unknown as Client["trace"],
  } as unknown as Client;
}

describe("MetadataClient", () => {
  let client: Client;
  let metadataClient: MetadataClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createMockClient();
    metadataClient = new MetadataClient(client);
  });

  // ── Task Definition CRUD ─────────────────────────────────────

  describe("unregisterTask()", () => {
    it("should call MetadataResource.unregisterTaskDef with correct path", async () => {
      await metadataClient.unregisterTask("my_task");
      expect(MetadataResource.unregisterTaskDef).toHaveBeenCalledWith(
        expect.objectContaining({ path: { tasktype: "my_task" } })
      );
    });
  });

  describe("registerTask()", () => {
    it("should delegate to registerTasks with single-element array", async () => {
      const taskDef = { name: "new_task" } as Parameters<typeof metadataClient.registerTask>[0];
      await metadataClient.registerTask(taskDef);
      expect(MetadataResource.registerTaskDef).toHaveBeenCalledWith(
        expect.objectContaining({ body: [taskDef] })
      );
    });
  });

  describe("registerTasks()", () => {
    it("should call MetadataResource.registerTaskDef with body array", async () => {
      const defs = [
        { name: "t1" },
        { name: "t2" },
      ] as Parameters<typeof metadataClient.registerTasks>[0];
      await metadataClient.registerTasks(defs);
      expect(MetadataResource.registerTaskDef).toHaveBeenCalledWith(
        expect.objectContaining({ body: defs })
      );
    });
  });

  describe("updateTask()", () => {
    it("should call MetadataResource.updateTaskDef", async () => {
      const taskDef = { name: "updated_task" } as Parameters<typeof metadataClient.updateTask>[0];
      await metadataClient.updateTask(taskDef);
      expect(MetadataResource.updateTaskDef).toHaveBeenCalledWith(
        expect.objectContaining({ body: taskDef })
      );
    });
  });

  describe("getTask()", () => {
    it("should call MetadataResource.getTaskDef and return data", async () => {
      const result = await metadataClient.getTask("my_task");
      expect(MetadataResource.getTaskDef).toHaveBeenCalledWith(
        expect.objectContaining({ path: { tasktype: "my_task" } })
      );
      expect(result).toEqual({ name: "test_task" });
    });
  });

  describe("getAllTaskDefs()", () => {
    it("should return all task definitions", async () => {
      const result = await metadataClient.getAllTaskDefs();
      expect(MetadataResource.getTaskDefs).toHaveBeenCalled();
      expect(result).toEqual([{ name: "t1" }, { name: "t2" }]);
    });
  });

  // ── Workflow Definition CRUD ─────────────────────────────────

  describe("registerWorkflowDef()", () => {
    it("should call MetadataResource.create with overwrite", async () => {
      const wfDef = { name: "my_wf", tasks: [], timeoutSeconds: 0 } as Parameters<typeof metadataClient.registerWorkflowDef>[0];
      await metadataClient.registerWorkflowDef(wfDef, true);
      expect(MetadataResource.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: wfDef,
          query: { overwrite: true },
        })
      );
    });

    it("should default overwrite to false", async () => {
      const wfDef = { name: "my_wf", tasks: [], timeoutSeconds: 0 } as Parameters<typeof metadataClient.registerWorkflowDef>[0];
      await metadataClient.registerWorkflowDef(wfDef);
      expect(MetadataResource.create).toHaveBeenCalledWith(
        expect.objectContaining({ query: { overwrite: false } })
      );
    });
  });

  describe("getWorkflowDef()", () => {
    it("should call MetadataResource.get1 and return data", async () => {
      const result = await metadataClient.getWorkflowDef("test_wf");
      expect(MetadataResource.get1).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { name: "test_wf" },
          query: { metadata: false, version: undefined },
        })
      );
      expect(result).toEqual({ name: "test_wf", version: 1 });
    });

    it("should pass version and metadata params", async () => {
      await metadataClient.getWorkflowDef("test_wf", 2, true);
      expect(MetadataResource.get1).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { metadata: true, version: 2 },
        })
      );
    });
  });

  describe("unregisterWorkflow()", () => {
    it("should call MetadataResource.unregisterWorkflowDef", async () => {
      await metadataClient.unregisterWorkflow("old_wf", 3);
      expect(MetadataResource.unregisterWorkflowDef).toHaveBeenCalledWith(
        expect.objectContaining({ path: { name: "old_wf", version: 3 } })
      );
    });

    it("should default version to 1", async () => {
      await metadataClient.unregisterWorkflow("old_wf");
      expect(MetadataResource.unregisterWorkflowDef).toHaveBeenCalledWith(
        expect.objectContaining({ path: { name: "old_wf", version: 1 } })
      );
    });
  });

  describe("getAllWorkflowDefs()", () => {
    it("should return all workflow definitions", async () => {
      const result = await metadataClient.getAllWorkflowDefs();
      expect(MetadataResource.getWorkflowDefs).toHaveBeenCalled();
      expect(result).toEqual([{ name: "wf1" }]);
    });
  });

  // ── Workflow Tags ────────────────────────────────────────────

  describe("addWorkflowTag()", () => {
    it("should call Tags.addWorkflowTag", async () => {
      await metadataClient.addWorkflowTag({ key: "env", value: "prod" }, "my_wf");
      expect(Tags.addWorkflowTag).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { name: "my_wf" },
          body: { key: "env", value: "prod" },
        })
      );
    });
  });

  describe("deleteWorkflowTag()", () => {
    it("should call Tags.deleteWorkflowTag", async () => {
      await metadataClient.deleteWorkflowTag({ key: "env", value: "prod" }, "my_wf");
      expect(Tags.deleteWorkflowTag).toHaveBeenCalledWith(
        expect.objectContaining({ path: { name: "my_wf" } })
      );
    });
  });

  describe("getWorkflowTags()", () => {
    it("should return tags array", async () => {
      const result = await metadataClient.getWorkflowTags("my_wf");
      expect(Tags.getWorkflowTags).toHaveBeenCalledWith(
        expect.objectContaining({ path: { name: "my_wf" } })
      );
      expect(result).toEqual([{ key: "env", value: "prod" }]);
    });
  });

  describe("setWorkflowTags()", () => {
    it("should call Tags.setWorkflowTags with tags array", async () => {
      const tags = [{ key: "env", value: "staging" }];
      await metadataClient.setWorkflowTags(tags, "my_wf");
      expect(Tags.setWorkflowTags).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { name: "my_wf" },
          body: tags,
        })
      );
    });
  });

  // ── Task Tags ────────────────────────────────────────────────

  describe("addTaskTag()", () => {
    it("should call Tags.addTaskTag", async () => {
      await metadataClient.addTaskTag({ key: "team", value: "backend" }, "my_task");
      expect(Tags.addTaskTag).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { taskName: "my_task" },
          body: { key: "team", value: "backend" },
        })
      );
    });
  });

  describe("deleteTaskTag()", () => {
    it("should call Tags.deleteTaskTag", async () => {
      await metadataClient.deleteTaskTag({ key: "team", value: "backend" }, "my_task");
      expect(Tags.deleteTaskTag).toHaveBeenCalledWith(
        expect.objectContaining({ path: { taskName: "my_task" } })
      );
    });
  });

  describe("getTaskTags()", () => {
    it("should return task tags", async () => {
      const result = await metadataClient.getTaskTags("my_task");
      expect(Tags.getTaskTags).toHaveBeenCalledWith(
        expect.objectContaining({ path: { taskName: "my_task" } })
      );
      expect(result).toEqual([{ key: "team", value: "backend" }]);
    });
  });

  describe("setTaskTags()", () => {
    it("should call Tags.setTaskTags", async () => {
      const tags = [{ key: "team", value: "frontend" }];
      await metadataClient.setTaskTags(tags, "my_task");
      expect(Tags.setTaskTags).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { taskName: "my_task" },
          body: tags,
        })
      );
    });
  });
});
