import { Client } from "../../common/open-api/client/types.gen";
import { TokenResource } from "../../common/open-api/sdk.gen";

export const handleAuth = async (
  openApiClient: Client,
  keyId: string,
  keySecret: string,
  refreshTokenInterval: number
) => {
  const { data } = await TokenResource.generateToken({
    body: { keyId, keySecret },
    client: openApiClient,
  });

  openApiClient.setConfig({ auth: `${data?.token}` });

  if (data?.token && refreshTokenInterval > 0) {
    setInterval(async () => {
      const { data } = await TokenResource.generateToken({
        body: { keyId, keySecret },
        client: openApiClient,
      });
      openApiClient.setConfig({ auth: `${data?.token}` });
    }, refreshTokenInterval);
  }
};
