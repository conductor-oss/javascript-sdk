import {
  TaskType,
  KafkaPublishTaskDef,
  KafkaPublishInputParameters,
} from "../../common/types";

export const kafkaPublishTask = (
  taskReferenceName: string,
  kafka_request: KafkaPublishInputParameters,
  optional?: boolean
): KafkaPublishTaskDef => ({
  taskReferenceName,
  name: taskReferenceName,
  type: TaskType.KAFKA_PUBLISH,
  inputParameters: {
    kafka_request,
  },
  optional,
});
