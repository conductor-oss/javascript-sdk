export interface ConductorLogger {
  info(...args: unknown[]): void
  error(...args: unknown[]): void
  debug(...args: unknown[]): void
}

export type ConductorLogLevel = keyof typeof LOG_LEVELS
export interface DefaultLoggerConfig {
  level?: ConductorLogLevel,
  tags?: object[]
}

const LOG_LEVELS = {
  DEBUG: 10,
  INFO: 30,
  ERROR: 60
} as const


/*
This provides an easy way to get up and running without worrying about configuring a logging framework.
Ideally, users that care can easily override with any compatible logger (e.g. pino, etc)
 */
export class DefaultLogger implements ConductorLogger {
  private readonly tags: object[]
  private readonly level: number

  constructor(config: DefaultLoggerConfig = {}) {
    const {level, tags = []} = config
    this.tags = tags
    if (level && level in LOG_LEVELS) {
      this.level = LOG_LEVELS[level]
    } else {
      this.level = LOG_LEVELS.INFO
    }
  }

  private log (level: ConductorLogLevel, ...args: unknown[]) {
    let resolvedLevel: number
    let name = level
    if (level in LOG_LEVELS) {
      resolvedLevel = LOG_LEVELS[level]
    } else {
      name = "INFO"
      resolvedLevel = LOG_LEVELS.INFO
    }
    if (resolvedLevel >= this.level) {
      console.log(name, ...this.tags, ...args)
    }
  }

  info = (...args: unknown[]): void => {
    this.log("INFO", ...args)
  }

  debug = (...args: unknown[]): void => {
    this.log("DEBUG", ...args)
  }

  error =(...args: unknown[]): void => {
    this.log("ERROR", ...args)
  }
}

export const noopLogger: ConductorLogger = {
  //eslint-disable-next-line
  debug: (...args: unknown[]) => {},
  //eslint-disable-next-line
  info: (...args: unknown[]) => {},
  //eslint-disable-next-line
  error: (...args: unknown[]) => {},
};
