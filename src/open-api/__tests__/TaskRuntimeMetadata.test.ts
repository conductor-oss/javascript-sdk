import { Task } from "../generated/types.gen";

// Compile-time guarantee: the generated Task type carries runtimeMetadata as an optional
// string->string map. If the OpenAPI spec (and thus the regenerated type) drops the field, this
// assignment fails `tsc` — the type is the real deliverable for the dynamic TS client.
const _runtimeMetadataTypeGuard: Record<string, string> | undefined = ({} as Task).runtimeMetadata;
void _runtimeMetadataTypeGuard;

/**
 * The server delivers host-resolved secret values on Task.runtimeMetadata (wire-only, never
 * persisted) when a worker's TaskDef.runtimeMetadata declares secret names (conductor-oss PR #1255).
 * Verify the generated client type carries the field as a string->string map and round-trips it.
 */
describe("Task.runtimeMetadata", () => {
  it("round-trips host-resolved secret values", () => {
    const task: Task = {
      taskId: "t1",
      runtimeMetadata: { GITHUB_TOKEN: "ghp_secret", GH_APP_ID: "42" },
    };

    const back = JSON.parse(JSON.stringify(task)) as Task;

    expect(back.runtimeMetadata).toEqual({ GITHUB_TOKEN: "ghp_secret", GH_APP_ID: "42" });
    expect(back.runtimeMetadata?.["GITHUB_TOKEN"]).toBe("ghp_secret");
  });

  it("is optional and omitted from the wire when absent", () => {
    const task: Task = { taskId: "t1" };
    expect(JSON.stringify(task)).not.toContain("runtimeMetadata");
  });
});
