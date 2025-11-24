import { KafkaPublishTaskDef, TaskType } from "../../open-api";
import { nameTaskNameGenerator } from "./common";

/**
 * Takes an optional partial KafkaPublishTaskDef
 * generates a task replacing default/fake values with provided overrides
 *
 * @param overrides overrides for defaults
 * @returns a fully defined task
 */
export const generateKafkaPublishTask = (
  overrides: Partial<KafkaPublishTaskDef> = {}
): KafkaPublishTaskDef => ({
  ...nameTaskNameGenerator("kafka", overrides),
  inputParameters: {
    kafka_request: {
      topic: "topic",
      value: "",
      bootStrapServers: "localhost:9092",
      headers: {},
      key: "123",
      keySerializer: "org.apache.kafka.common.serialization.IntegerSerializer",
    },
  },
  ...overrides,
  type: TaskType.KAFKA_PUBLISH,
});
