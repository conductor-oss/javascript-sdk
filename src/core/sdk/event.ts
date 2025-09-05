import { TaskType, EventTaskDef } from "../../common/types";

export const eventTask = (
  taskReferenceName: string,
  eventPrefix: string,
  eventSuffix: string,
  optional?: boolean
): EventTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  sink: `${eventPrefix}:${eventSuffix}`,
  type: TaskType.EVENT,
  optional,
});

export const sqsEventTask = (
  taskReferenceName: string,
  queueName: string,
  optional?: boolean
) => eventTask(taskReferenceName, "sqs", queueName, optional);

export const conductorEventTask = (
  taskReferenceName: string,
  eventName: string,
  optional?: boolean
) => eventTask(taskReferenceName, "conductor", eventName, optional);
