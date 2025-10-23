# ConductorLogger API Reference

The `ConductorLogger` interface provides a standardized logging mechanism for the Conductor SDK. It allows you to integrate with your preferred logging framework while maintaining consistent log formatting and levels.

## Logger Interface

### `ConductorLogger`

The main logging interface that all loggers must implement.

```typescript
interface ConductorLogger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}
```

**Methods:**

-   `info(...args: unknown[]): void` - Log informational messages
-   `error(...args: unknown[]): void` - Log error messages
-   `debug(...args: unknown[]): void` - Log debug messages

**Example:**

```typescript
import { ConductorLogger } from "@io-orkes/conductor-javascript";

const logger: ConductorLogger = {
  info: (...args) => console.log("INFO:", ...args),
  error: (...args) => console.error("ERROR:", ...args),
  debug: (...args) => console.debug("DEBUG:", ...args)
};

// Use with TaskManager or other components
const taskManager = new TaskManager(client, workers, { logger });
```

## Built-in Logger Implementation

### `DefaultLogger`

A simple console-based logger implementation with configurable log levels and tags.

#### Constructor

```typescript
new DefaultLogger(config?: DefaultLoggerConfig)
```

**Parameters:**

-   `config` (`DefaultLoggerConfig`, optional): Configuration options for the logger.

**Example:**

```typescript
import { DefaultLogger } from "@io-orkes/conductor-javascript";

const logger = new DefaultLogger({
  level: "INFO",
  tags: [{ service: "workflow-processor" }]
});
```

#### Configuration Options

##### `DefaultLoggerConfig`

| Property | Type | Description |
| --- | --- | --- |
| `level` | `ConductorLogLevel` | Minimum log level to output. Options: `"DEBUG"`, `"INFO"`, `"ERROR"`. Default is `"INFO"`. |
| `tags` | `object[]` | Array of tag objects to include with every log message. Useful for adding context like service names, versions, etc. |

##### `ConductorLogLevel`

Available log levels in order of severity:

```typescript
type ConductorLogLevel = "DEBUG" | "INFO" | "ERROR";
```

## Pre-configured Loggers

### `noopLogger`

A no-operation logger that silently discards all log messages. Useful for production environments where you want to disable logging.

```typescript
import { noopLogger } from "@io-orkes/conductor-javascript";

// Use when you don't want any logging output
const taskManager = new TaskManager(client, workers, { logger: noopLogger });
```

## Custom Logger Implementation

You can implement the `ConductorLogger` interface with any logging framework:

```typescript
import pino from 'pino';
import { ConductorLogger } from "@io-orkes/conductor-javascript";

const pinoLogger = pino({ level: 'info' });

const logger: ConductorLogger = {
  info: (...args) => pinoLogger.info(args.join(' ')),
  error: (...args) => pinoLogger.error(args.join(' ')),
  debug: (...args) => pinoLogger.debug(args.join(' '))
};
```

## Usage in SDK Components

The logger is used throughout the SDK in components like:

- **TaskManager**: Logs worker polling, task execution, and errors
- **WorkflowExecutor**: Logs workflow operations and API calls
- **MetadataClient**: Logs metadata operations
- **SchedulerClient**: Logs scheduling operations

**Example with TaskManager:**

```typescript
import { TaskManager, DefaultLogger } from "@io-orkes/conductor-javascript";

const logger = new DefaultLogger({
  level: "DEBUG",
  tags: [{ worker: "email-service" }]
});

const taskManager = new TaskManager(client, workers, { logger });
```

## Log Levels

The logger supports three levels with the following numeric values:

-   **DEBUG (10)**: Detailed diagnostic information
-   **INFO (30)**: General information about operations
-   **ERROR (60)**: Error conditions that need attention

The `DefaultLogger` will only output messages at or above the configured level.
