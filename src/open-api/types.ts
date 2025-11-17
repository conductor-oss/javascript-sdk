import type {
  ExtendedTaskDef as OpenApiExtendedTaskDef,
  SignalResponse as OpenApiSignalResponse,
  Task,
} from "./generated";

export interface CommonTaskDef {
  name: string;
  taskReferenceName: string;
}

export enum Consistency {
  SYNCHRONOUS = "SYNCHRONOUS",
  DURABLE = "DURABLE",
  REGION_DURABLE = "REGION_DURABLE",
}

export enum ReturnStrategy {
  TARGET_WORKFLOW = "TARGET_WORKFLOW",
  BLOCKING_WORKFLOW = "BLOCKING_WORKFLOW",
  BLOCKING_TASK = "BLOCKING_TASK",
  BLOCKING_TASK_INPUT = "BLOCKING_TASK_INPUT",
}

export enum TaskResultStatusEnum {
  IN_PROGRESS = "IN_PROGRESS",
  FAILED = "FAILED",
  FAILED_WITH_TERMINAL_ERROR = "FAILED_WITH_TERMINAL_ERROR",
  COMPLETED = "COMPLETED",
}

export enum TaskType {
  START = "START",
  SIMPLE = "SIMPLE",
  DYNAMIC = "DYNAMIC",
  FORK_JOIN = "FORK_JOIN",
  FORK_JOIN_DYNAMIC = "FORK_JOIN_DYNAMIC",
  DECISION = "DECISION",
  SWITCH = "SWITCH",
  JOIN = "JOIN",
  DO_WHILE = "DO_WHILE",
  SUB_WORKFLOW = "SUB_WORKFLOW",
  EVENT = "EVENT",
  WAIT = "WAIT",
  USER_DEFINED = "USER_DEFINED",
  HTTP = "HTTP",
  LAMBDA = "LAMBDA",
  INLINE = "INLINE",
  EXCLUSIVE_JOIN = "EXCLUSIVE_JOIN",
  TERMINAL = "TERMINAL",
  TERMINATE = "TERMINATE",
  KAFKA_PUBLISH = "KAFKA_PUBLISH",
  JSON_JQ_TRANSFORM = "JSON_JQ_TRANSFORM",
  SET_VARIABLE = "SET_VARIABLE",
}

export enum ServiceType {
  HTTP = "HTTP",
  MCP_REMOTE = "MCP_REMOTE",
  gRPC = "gRPC",
}

export type TaskDefTypes =
  | SimpleTaskDef
  | DoWhileTaskDef
  | EventTaskDef
  | ForkJoinTaskDef
  | ForkJoinDynamicDef
  | HttpTaskDef
  | InlineTaskDef
  | JsonJQTransformTaskDef
  | KafkaPublishTaskDef
  | SetVariableTaskDef
  | SubWorkflowTaskDef
  | SwitchTaskDef
  | TerminateTaskDef
  | JoinTaskDef
  | WaitTaskDef;

export interface DoWhileTaskDef extends CommonTaskDef {
  inputParameters: Record<string, unknown>;
  type: TaskType.DO_WHILE;
  startDelay?: number;
  optional?: boolean;
  asyncComplete?: boolean;
  loopCondition: string;
  loopOver: TaskDefTypes[];
}

export interface EventTaskDef extends CommonTaskDef {
  type: TaskType.EVENT;
  sink: string;
  asyncComplete?: boolean;
  optional?: boolean;
}

export interface ForkJoinTaskDef extends CommonTaskDef {
  type: TaskType.FORK_JOIN;
  inputParameters?: Record<string, string>;
  forkTasks: TaskDefTypes[][];
}

export interface JoinTaskDef extends CommonTaskDef {
  type: TaskType.JOIN;
  inputParameters?: Record<string, string>;
  joinOn: string[];
  optional?: boolean;
  asyncComplete?: boolean;
}

export interface ForkJoinDynamicDef extends CommonTaskDef {
  inputParameters: {
    dynamicTasks: TaskDefTypes[] | string;
    dynamicTasksInput: Record<string, unknown> | string;
  };
  type: TaskType.FORK_JOIN_DYNAMIC;
  dynamicForkTasksParam: string; // not string "dynamicTasks",
  dynamicForkTasksInputParamName: string; // not string "dynamicTasksInput",
  startDelay?: number;
  optional?: boolean;
  asyncComplete?: boolean;
}
export interface HttpInputParameters {
  uri: string;
  method: "GET" | "PUT" | "POST" | "DELETE" | "OPTIONS" | "HEAD";
  accept?: string;
  contentType?: string;
  headers?: Record<string, string>;
  body?: unknown;
  connectionTimeOut?: number;
  readTimeOut?: string;
}

export interface HttpTaskDef extends CommonTaskDef {
  inputParameters: {
    [x: string]: unknown;
    http_request: HttpInputParameters;
  };
  type: TaskType.HTTP;
  asyncComplete?: boolean;
  optional?: boolean;
}

export interface InlineTaskInputParameters {
  evaluatorType: "javascript" | "graaljs";
  expression: string;
  [x: string]: unknown;
}

export interface InlineTaskDef extends CommonTaskDef {
  type: TaskType.INLINE;
  inputParameters: InlineTaskInputParameters;
  optional?: boolean;
}

interface ContainingQueryExpression {
  queryExpression: string;
  [x: string | number | symbol]: unknown;
}

export interface JsonJQTransformTaskDef extends CommonTaskDef {
  type: TaskType.JSON_JQ_TRANSFORM;
  inputParameters: ContainingQueryExpression;
  optional?: boolean;
}

export interface KafkaPublishInputParameters {
  topic: string;
  value: string;
  bootStrapServers: string;
  headers: Record<string, string>;
  key: string;
  keySerializer: string;
}

export interface KafkaPublishTaskDef extends CommonTaskDef {
  inputParameters: {
    kafka_request: KafkaPublishInputParameters;
  };
  type: TaskType.KAFKA_PUBLISH;
  optional?: boolean;
}

export interface SetVariableTaskDef extends CommonTaskDef {
  type: TaskType.SET_VARIABLE;
  inputParameters: Record<string, unknown>;
  optional?: boolean;
}

export interface SimpleTaskDef extends CommonTaskDef {
  type: TaskType.SIMPLE;
  inputParameters?: Record<string, unknown>;
  optional?: boolean;
}

export interface SubWorkflowTaskDef extends CommonTaskDef {
  type: TaskType.SUB_WORKFLOW;
  inputParameters?: Record<string, unknown>;
  subWorkflowParam: {
    name: string;
    version?: number;
    taskToDomain?: Record<string, string>;
  };
  optional?: boolean;
}

export interface SwitchTaskDef extends CommonTaskDef {
  inputParameters: Record<string, unknown>;
  type: TaskType.SWITCH;
  decisionCases: Record<string, TaskDefTypes[]>;
  defaultCase: TaskDefTypes[];
  evaluatorType: "value-param" | "javascript";
  expression: string;
  optional?: boolean;
}

export interface TerminateTaskDef extends CommonTaskDef {
  inputParameters: {
    terminationStatus: "COMPLETED" | "FAILED";
    workflowOutput?: Record<string, string>;
    terminationReason?: string;
  };
  type: TaskType.TERMINATE;
  startDelay?: number;
}

export interface WaitTaskDef extends CommonTaskDef {
  type: TaskType.WAIT;
  inputParameters: {
    duration?: string;
    until?: string;
  };
  optional?: boolean;
}

// TODO: need to remove this once OpenAPI spec is fixed
export interface ExtendedTaskDef
  extends Omit<
    OpenApiExtendedTaskDef,
    "timeoutSeconds" | "totalTimeoutSeconds"
  > {
  totalTimeoutSeconds?: number;
  timeoutSeconds?: number;
}

// TODO: need to remove this once OpenAPI spec is fixed
export interface SignalResponse extends OpenApiSignalResponse {
  // ========== COMMON FIELDS IN ALL RESPONSES ==========
  priority?: number;
  variables?: Record<string, unknown>;

  // ========== FIELDS SPECIFIC TO TARGET_WORKFLOW & BLOCKING_WORKFLOW ==========
  tasks?: Task[];
  createdBy?: string;
  createTime?: number;
  status?: string;
  updateTime?: number;

  // ========== FIELDS SPECIFIC TO BLOCKING_TASK & BLOCKING_TASK_INPUT ==========
  taskType?: string;
  taskId?: string;
  referenceTaskName?: string;
  retryCount?: number;
  taskDefName?: string;
  workflowType?: string;
}
