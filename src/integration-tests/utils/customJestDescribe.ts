import { describe } from "@jest/globals";

const orkesBackendVersion = Number(process.env.ORKES_BACKEND_VERSION);
const isOss = (process.env.CONDUCTOR_SERVER_TYPE || "").toLowerCase() === "oss";

export const describeForOrkesV5 = orkesBackendVersion >= 5 ? describe : describe.skip;
export const describeForOrkesV4 = orkesBackendVersion >= 4 ? describe : describe.skip;

// Orkes-only features: skipped when running against a Conductor OSS server.
// These still honor version gating so they only run on a compatible Orkes backend.
export const describeForOrkesOnly = !isOss ? describe : describe.skip;
export const describeForOrkesOnlyV4 =
  !isOss && orkesBackendVersion >= 4 ? describe : describe.skip;
export const describeForOrkesOnlyV5 =
  !isOss && orkesBackendVersion >= 5 ? describe : describe.skip;

// Scheduler exists on OSS but is a work in progress against the OSS test env, so
// skip it there for now (mirrors csharp-sdk's Feature=OSSSchedulerWIP trait).
export const describeForOssSchedulerWip =
  !isOss && orkesBackendVersion >= 4 ? describe : describe.skip;
