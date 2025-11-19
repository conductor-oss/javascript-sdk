import { jest } from "@jest/globals";
import type { ConductorLogger } from "../../sdk/helpers/logger";

export const mockLogger: ConductorLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};
