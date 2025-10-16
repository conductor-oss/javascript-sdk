import { Client } from "../../common/open-api/client/types.gen";
import { TokenResource } from "../../common/open-api/sdk.gen";
import { errorMapper } from "../../core/helpers";

export const handleAuth = async (
  openApiClient: Client,
  keyId: string,
  keySecret: string,
  refreshTokenInterval: number
) => {
  await authorize(openApiClient, keyId, keySecret);
  if (refreshTokenInterval > 0) {
    const intervalId = setInterval(async () => {
      try {
        await authorize(openApiClient, keyId, keySecret);
      } catch (error) {
        console.error("Token refresh failed, SDK will stop working when current token expires:", error); // replace with sdk logger
        clearInterval(intervalId);
      }
    }, refreshTokenInterval);
  }
};

const authorize = async (
  openApiClient: Client,
  keyId: string,
  keySecret: string,
) => {
  const { data } = await TokenResource.generateToken({
    body: { keyId, keySecret },
    client: openApiClient,
  });
  if (!data?.token) {
    throw errorMapper("Failed to generate authorization token");
  }
  openApiClient.setConfig({ auth: `${data?.token}` });
};
