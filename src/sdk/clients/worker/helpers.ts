import os from "os";
import {
  OptionEntries,
  TaskErrorHandler,
  TaskManagerOptions,
  TaskRunnerOptions,
} from "./types";

/**
 * Compares if the new options are really new
 * @param oldOptions
 * @param newOptions
 */
export const optionEquals = (
  oldOptions: Partial<TaskRunnerOptions>,
  newOptions: Partial<TaskRunnerOptions>
) => {
  const newOptionEntries = Object.entries(newOptions) as OptionEntries;
  const oldOptionsEntries = Object.entries(oldOptions) as OptionEntries;

  return (
    newOptionEntries.length === oldOptionsEntries.length &&
    newOptionEntries.every(
      ([key, value]) => (oldOptions[key] as unknown) === value
    )
  );
};

export function getWorkerId(options: Partial<TaskManagerOptions>) {
  return options.workerID ?? os.hostname();
}

//eslint-disable-next-line
export const noopErrorHandler: TaskErrorHandler = (error: Error) => {};
