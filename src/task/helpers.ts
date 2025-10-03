import { TaskRunnerOptions } from "./types";
type OptionEntries = [keyof TaskRunnerOptions, string | number | undefined][];

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
