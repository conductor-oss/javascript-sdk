import { Client } from "../../common/open-api/client/types.gen";
import { TokenResource } from "../../common/open-api/sdk.gen";
import { handleSdkError } from "../../core/helpers";

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
        handleSdkError(
          error,
          "Token refresh failed, SDK will stop working when current token expires",
          "log"
        );
        clearInterval(intervalId);
      }
    }, refreshTokenInterval);
  }
};

const authorize = async (
  openApiClient: Client,
  keyId: string,
  keySecret: string
) => {
  const { data, error } = await TokenResource.generateToken({
    body: { keyId: keyId, keySecret },
    client: openApiClient,
    throwOnError: false,
  });

  if (error || !data?.token) {
    handleSdkError(error, "Failed to generate authorization token");
  }

  openApiClient.setConfig({ auth: `${data?.token}` });
};
