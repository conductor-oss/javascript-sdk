import type { OpenAPIConfig } from "../common";
import { ConductorClient } from "../common";
import { HttpRequestConstructor } from "./types";

export class ConductorClientWithAuth extends ConductorClient {
  private intervalId?: NodeJS.Timeout;

  constructor(
    config: Partial<OpenAPIConfig>,
    CustomHttpRequest?: HttpRequestConstructor
  ) {
    super(config, CustomHttpRequest);
  }

  private setToken(token: string) {
    this.request.config.TOKEN = token;
  }

  public async authorize(
    keyId: string,
    keySecret: string,
    refreshTokenInterval: number
  ) {
    const response = (await this.tokenResource.generateToken({
      keyId,
      keySecret,
    })) as { token: string };
    this.setToken(response.token);

    if (response.token && refreshTokenInterval > 0) {
      const intervalId = setInterval(async () => {
        const response = (await this.tokenResource.generateToken({
          keyId,
          keySecret,
        })) as { token: string };
        this.setToken(response.token);
      }, refreshTokenInterval);
      this.intervalId = intervalId;
    }
  }

  public deAuthorize(): void {
    this.clearTokenInterval();
    this.request.config.TOKEN = undefined;
  }

  public clearTokenInterval(): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
    }
  }
}
