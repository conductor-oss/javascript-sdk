import type { Client, Tag } from "../../../open-api";
import type {
  MessageTemplate,
  PromptTemplateTestRequest,
} from "../../../open-api/generated";
import { PromptResource } from "../../../open-api/generated";
import { handleSdkError } from "../../helpers/errors";

export class PromptClient {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Save a prompt template
   * @param name - The prompt name
   * @param description - Description of the prompt
   * @param template - The prompt template text
   * @param models - Optional array of model names
   */
  public async savePrompt(
    name: string,
    description: string,
    template: string,
    models?: string[]
  ): Promise<void> {
    try {
      await PromptResource.saveMessageTemplate({
        path: { name },
        body: template,
        query: { description, models },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to save prompt '${name}'`);
    }
  }

  /**
   * Update a prompt template
   * @param name - The prompt name
   * @param description - Description of the prompt
   * @param template - The prompt template text
   * @param models - Optional array of model names
   */
  public async updatePrompt(
    name: string,
    description: string,
    template: string,
    models?: string[]
  ): Promise<void> {
    try {
      await PromptResource.updateMessageTemplate({
        path: { name },
        body: template,
        query: { description, models },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to update prompt '${name}'`);
    }
  }

  /**
   * Get a prompt template by name
   * @param name - The prompt name
   * @returns The message template
   */
  public async getPrompt(name: string): Promise<MessageTemplate> {
    try {
      const { data } = await PromptResource.getMessageTemplate({
        path: { name },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get prompt '${name}'`);
    }
  }

  /**
   * Get all prompt templates
   * @returns Array of message templates
   */
  public async getPrompts(): Promise<MessageTemplate[]> {
    try {
      const { data } = await PromptResource.getMessageTemplates({
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to get prompts");
    }
  }

  /**
   * Delete a prompt template
   * @param name - The prompt name
   */
  public async deletePrompt(name: string): Promise<void> {
    try {
      await PromptResource.deleteMessageTemplate({
        path: { name },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to delete prompt '${name}'`);
    }
  }

  /**
   * Test a prompt template against an LLM
   * @param testRequest - The test request containing prompt text, variables, model info, etc.
   * @returns The LLM response string
   */
  public async testPrompt(
    testRequest: PromptTemplateTestRequest
  ): Promise<string> {
    try {
      const { data } = await PromptResource.testMessageTemplate({
        body: testRequest,
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to test prompt");
    }
  }

  /**
   * Get tags for a prompt template
   * @param name - The prompt name
   * @returns Array of tags
   */
  public async getPromptTags(name: string): Promise<Tag[]> {
    try {
      const { data } = await PromptResource.getTagsForPromptTemplate({
        path: { name },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get tags for prompt '${name}'`);
    }
  }

  /**
   * Set tags for a prompt template
   * @param name - The prompt name
   * @param tags - The tags to set
   */
  public async setPromptTags(name: string, tags: Tag[]): Promise<void> {
    try {
      await PromptResource.putTagForPromptTemplate({
        path: { name },
        body: tags,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to set tags for prompt '${name}'`);
    }
  }

  /**
   * Delete tags from a prompt template
   * @param name - The prompt name
   * @param tags - The tags to delete
   */
  public async deletePromptTags(name: string, tags: Tag[]): Promise<void> {
    try {
      await PromptResource.deleteTagForPromptTemplate({
        path: { name },
        body: tags,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to delete tags from prompt '${name}'`);
    }
  }
}
