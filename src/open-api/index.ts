export type { Client } from "./generated/client";
export type {
  Action,
  CircuitBreakerTransitionResponse,
  ConnectivityTestInput,
  ConnectivityTestResult,
  EventHandler,
  GenerateTokenRequest,
  PollData,
  ProtoRegistryEntry,
  RerunWorkflowRequest,
  Response,
  SaveScheduleRequest,
  ScrollableSearchResultWorkflowSummary,
  SearchResultTaskSummary,
  SearchResultWorkflowScheduleExecutionModel,
  SearchResultHandledEventResponse,
  ServiceRegistry,
  ServiceMethod,
  SkipTaskRequest,
  StartWorkflowRequest,
  SubWorkflowParams,
  Tag,
  Task,
  TaskDef,
  TaskDetails,
  TaskExecLog,
  TaskResult,
  TaskSummary,
  TaskListSearchResultSummary,
  Workflow,
  WorkflowSchedule,
  WorkflowScheduleExecutionModel,
  WorkflowScheduleModel,
  WorkflowStatus,
  WorkflowSummary,
  WorkflowTask,
  WorkflowDef,
  WorkflowRun,
  ExtendedWorkflowDef,
  ExtendedEventExecution,
  // ExtendedConductorApplication, TODO: restore after OpenAPI spec update
  EventMessage,
  HumanTaskUser,
  HumanTaskDefinition,
  HumanTaskAssignment,
  HumanTaskTrigger,
  UserFormTemplate,
  HumanTaskTemplate,
  HumanTaskSearchResult,
  HumanTaskSearch,
  HumanTaskEntry,
} from "./generated";

export * from "./types";

// Legacy compatibility types: maintained for backward compatibility
export * from "./deprecated-types";

/**
 * Export types needed for client's return type in case if user is building another lib on top of sdk with declaration files
 * @deprecated
 * to import all the types below manually while using SDK since these types could change in future without backward compatibility
 * Legacy compatibility: maintained for backward compatibility
 */
export type {
  Auth,
  ClientOptions,
  Config,
  QuerySerializerOptions,
  RequestOptions,
  ResolvedRequestOptions,
} from "./generated/client";
export type { Middleware } from "./generated/client/utils.gen";
export type { StreamEvent } from "./generated/core/serverSentEvents.gen";
