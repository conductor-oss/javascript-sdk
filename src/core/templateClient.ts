import {
  ConductorClient,
  HumanTaskTemplate,
} from "../common";
import { tryCatchReThrow } from "./helpers";


export class TemplateClient {
  public readonly _client: ConductorClient;

  constructor(client: ConductorClient) {
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
    return tryCatchReThrow(() =>
      this._client.humanTask.saveTemplate(template, asNewVersion)
    );
  }
}
