import { Client } from "../../common/open-api/client/types.gen";
import {
  EventResource,
  HumanTaskResource,
  UserFormTemplateResource,
  MetadataResource,
  ServiceRegistryResource,
  SchedulerResource,
  TaskResource,
  TokenResource,
  WorkflowResource,
  WorkflowBulkResource,
  HealthCheckResource,
} from "../../common/open-api/sdk.gen";

export const addServicesBackwardCompatibility = (client: Client) => {
  (client as any).eventResource = {
    getQueueConfig: (queueType: string, queueName: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return EventResource.getQueueConfig({
        client,
        path: { queueType, queueName },
        throwOnError: true,
      });
    },

    putQueueConfig: (queueType: string, queueName: string, body: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      EventResource.putQueueConfig({
        client,
        path: { queueType, queueName },
        body,
        throwOnError: true,
      });
    },
  };
};
