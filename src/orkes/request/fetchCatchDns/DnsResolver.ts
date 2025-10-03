import { promises } from "dns";
import { ConductorLogger, noopLogger } from "../../../common/ConductorLogger";

interface Options {
  logger: ConductorLogger;
  resolver: (hostname: string) => Promise<string[]>;
}

const DEFAULT_OPTIONS: Options = {
  logger: noopLogger,
  resolver: promises.resolve4,
};

export const dnsResolver = async (
  host: string,
  { resolver = promises.resolve4, logger = console }: Options = DEFAULT_OPTIONS
): Promise<string | undefined> => {
  try {
    const addresses = await resolver(host); // make this a custom resolver
    if (addresses.length > 0) return addresses[0];
  } catch (e) {
    logger.error("Could not resolve host: " + host + " error: " + e);
  }
  return undefined;
};
