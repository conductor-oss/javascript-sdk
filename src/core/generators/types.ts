import {
  WorkflowDef,
  ForkJoinTaskDef,
  SwitchTaskDef,
  DoWhileTaskDef,
  SimpleTaskDef,
  EventTaskDef,
  ForkJoinDynamicDef,
  HttpTaskDef,
  InlineTaskDef,
  JsonJQTransformTaskDef,
  KafkaPublishTaskDef,
  SetVariableTaskDef,
  SubWorkflowTaskDef,
  TerminateTaskDef,
  JoinTaskDef,
  WaitTaskDef,
  TaskDefTypes,
  InlineTaskInputParameters,
} from "../../common/types";

export type TaskDefTypesGen =
  | SimpleTaskDef
  | DoWhileTaskDefGen
  | EventTaskDef
  | ForkJoinTaskDefGen
  | ForkJoinDynamicDef
  | HttpTaskDef
  | InlineTaskDefGen
  | JsonJQTransformTaskDef
  | KafkaPublishTaskDef
  | SetVariableTaskDef
  | SubWorkflowTaskDef
  | SwitchTaskDefGen
  | TerminateTaskDef
  | JoinTaskDef
  | WaitTaskDef;

export interface WorkflowDefGen extends Omit<WorkflowDef, "tasks"> {
  tasks: Partial<TaskDefTypesGen>[];
}

export type ForkJoinTaskDefGen = Omit<ForkJoinTaskDef, "forkTasks"> & {
  forkTasks: Partial<TaskDefTypesGen>[][];
};

export type SwitchTaskDefGen = Omit<
  SwitchTaskDef,
  "decisionCases" | "defaultCase"
> & {
  decisionCases: Record<string, Partial<TaskDefTypesGen>[]>;
  defaultCase: Partial<TaskDefTypesGen>[];
};

export type DoWhileTaskDefGen = Omit<DoWhileTaskDef, "loopOver"> & {
  loopOver: Partial<TaskDefTypesGen>[];
};

export interface InlineTaskInputParametersGen
  extends Omit<InlineTaskInputParameters, "expression"> {
  expression: string | ((...args: never[]) => unknown);
}

export interface InlineTaskDefGen
  extends Omit<InlineTaskDef, "inputParameters"> {
  inputParameters: InlineTaskInputParametersGen;
}

export type NestedTaskMapper = (
  tasks: Partial<TaskDefTypesGen>[]
) => TaskDefTypes[];
