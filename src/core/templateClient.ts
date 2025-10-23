import { HumanTaskTemplate } from "../common";
import { HumanTask } from "../common/open-api/sdk.gen";
import { Client } from "../common/open-api/client/types.gen";
import { handleSdkError } from "./helpers";

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
