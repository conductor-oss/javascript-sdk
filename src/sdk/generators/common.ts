export const randomChars = (n = 7): string =>
  (Math.random() + 1).toString(36).substring(n);

export const workflowNameGenerator = () => `workflow___${randomChars(7)}`;

export const taskNameGenerator = (taskType: string) =>
  `${taskType}__task_${randomChars(7)}`;

export const taskReferenceNameGenerator = (taskName: string) =>
  `${taskName}_ref`;

interface MaybeOverrides {
  name?: string;
}

export const nameTaskNameGenerator = (
  taskType: string,
  maybeOverrides: MaybeOverrides = {}
) => {
  const name = maybeOverrides?.name ?? taskNameGenerator(taskType);
  return {
    name,
    taskReferenceName: taskReferenceNameGenerator(name),
  };
};

export function mapArrValues<T, R>(
  arrayTransformer: (a: T[]) => R[],
  mapWithValues: Record<string, T[]>
) {
  return Object.fromEntries(
    Object.entries(mapWithValues).map(([key, value]: [string, T[]]) => [
      key,
      arrayTransformer(value),
    ])
  );
}
