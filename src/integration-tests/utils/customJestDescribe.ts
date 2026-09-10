import { describe, test } from "@jest/globals";

const orkesBackendVersion = Number(process.env.ORKES_BACKEND_VERSION);
const isOss = (process.env.CONDUCTOR_SERVER_TYPE || "").toLowerCase() === "oss";

// Diagnostic switch: set CONDUCTOR_OSS_UNGATE=1 to force the OSS-only gates
// (describeForOrkesOnly*) open even when CONDUCTOR_SERVER_TYPE=oss. Use this to
// re-probe a Conductor OSS build and see which currently-gated suites now pass —
// e.g. after an OSS release adds an endpoint — as a signal that a gate could be
// relaxed. Must NOT be set in CI: it makes Orkes-only failures look like real OSS
// failures and defeats the point of the OSS job.
const ungateOss = ["1", "true"].includes(
  (process.env.CONDUCTOR_OSS_UNGATE || "").toLowerCase()
);

// OSS gating is active only when talking to an OSS server and not explicitly ungated.
const ossGated = isOss && !ungateOss;

export const describeForOrkesV5 = orkesBackendVersion >= 5 ? describe : describe.skip;
export const describeForOrkesV4 = orkesBackendVersion >= 4 ? describe : describe.skip;

// Orkes-only features: skipped when running against a Conductor OSS server.
// These still honor version gating so they only run on a compatible Orkes backend.
export const describeForOrkesOnly = !ossGated ? describe : describe.skip;
export const describeForOrkesOnlyV4 =
  !ossGated && orkesBackendVersion >= 4 ? describe : describe.skip;
export const describeForOrkesOnlyV5 =
  !ossGated && orkesBackendVersion >= 5 ? describe : describe.skip;

// Scheduler exists on OSS but is a work in progress against the OSS test env, so
// skip it there for now
export const describeForOssSchedulerWip =
  !ossGated && orkesBackendVersion >= 4 ? describe : describe.skip;

// Consistency.REGION_DURABLE requires the target server to have cross-region
// replication configured. Since orkes-conductor 5.5.0, a node without it rejects the
// start outright ("REGION_DURABLE consistency requested but region replication is not
// enabled/configured on this node") rather than silently downgrading to a plain local
// start — it refuses a guarantee it cannot provide instead of appearing to honour it.
// So these run only where the capability actually exists: set
// CONDUCTOR_REGION_DURABLE_ENABLED=true against such a target.
//
// Deliberately an explicit opt-in rather than catching the 500 and skipping: auto-skip
// would restore exactly the silent green that hid this for months (pre-5.5.0 the flag
// was accepted and ignored, so these cases were really exercising DURABLE), and would
// hide a genuine replication regression on a cluster where it is supposed to work.
// Mirrors the java-sdk gate of the same name (TaskClientTests, PR #167).
//
// Test-level rather than describe-level because the cases are generated from a
// combination table; it lives here so all suite gating stays in one module.
const regionDurableEnabled = ["1", "true"].includes(
  (process.env.CONDUCTOR_REGION_DURABLE_ENABLED || "").toLowerCase()
);

export const testForRegionDurable = regionDurableEnabled ? test : test.skip;
