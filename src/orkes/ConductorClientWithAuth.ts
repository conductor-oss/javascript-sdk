import type { BaseHttpRequest, OpenAPIConfig } from "../common";
import { ConductorClient } from "../common";

export class ConductorClientWithAuth extends ConductorClient {
  private intervalId?: NodeJS.Timeout | undefined;

  constructor(
    config: Partial<OpenAPIConfig>,
    HttpRequest?: new (config: OpenAPIConfig) => BaseHttpRequest
  ) {
    super(config, HttpRequest);
  }

  private setToken(token: string | undefined) {
    this.request.config.TOKEN = token;
  }

  public async authorize(
    keyId: string,
    keySecret: string,
    refreshTokenInterval: number
  ) {
    this.deAuthorize();

    const response = await this.tokenResource.generateToken({
      keyId,
      keySecret,
    });
    this.setToken(response.token);

    if (response.token && refreshTokenInterval > 0) {
      const intervalId = setInterval(async () => {
        const response = await this.tokenResource.generateToken({
          keyId,
          keySecret,
        });
        this.setToken(response.token);
      }, refreshTokenInterval);
      this.intervalId = intervalId;
    }
  }

  public deAuthorize() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.setToken(undefined);
  }
}
