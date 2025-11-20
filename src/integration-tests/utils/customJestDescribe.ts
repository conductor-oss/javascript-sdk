import { describe } from "@jest/globals";

const orkesBackendVersion = Number(process.env.ORKES_BACKEND_VERSION);

export const describeForOrkesV5 = orkesBackendVersion >= 5 ? describe : describe.skip;
export const describeForOrkesV4 = orkesBackendVersion >= 4 ? describe : describe.skip;
