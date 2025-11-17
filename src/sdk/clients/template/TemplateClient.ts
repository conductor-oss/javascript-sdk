import type { HumanTaskTemplate } from "../../../open-api";
import { HumanTask } from "../../../open-api/generated";
import type { Client } from "../../../open-api/generated/client/types.gen";
import { handleSdkError } from "../../helpers/errors";

export class TemplateClient {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Register a new human task template
   *
   * @param template
   * @returns
   */
  public async registerTemplate(
    template: HumanTaskTemplate,
    asNewVersion = false
  ): Promise<HumanTaskTemplate> {
    try {
      const { data } = await HumanTask.saveTemplate({
        body: template,
        query: {
          newVersion: asNewVersion,
        },
        client: this._client,
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to register template");
    }
  }
}
