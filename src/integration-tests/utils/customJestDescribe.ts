import { describe } from "@jest/globals";

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
