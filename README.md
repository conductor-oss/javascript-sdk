# Conductor OSS Javascript/Typescript SDK

The `conductor-javascript` repository provides the client SDKs to build task workers in javascript/typescript.

Building the task workers in javascript mainly consists of the following steps:

1. Setup conductor-javascript package
2. [Create and run task workers](workers_sdk.md)
3. [Create workflows using code](workflow_sdk.md)
   
### Setup Conductor Javascript Package

* Get the package from npm

```shell
npm i @io-orkes/conductor-javascript
```
or

```shell
yarn add @io-orkes/conductor-javascript
```

## Configurations

### Authentication Settings (Optional)
Configure the authentication settings if your Conductor server requires authentication.
* keyId: Key for authentication.
* keySecret: Secret for the key.

### Access Control Setup
See [Access Control](https://orkes.io/content/docs/getting-started/concepts/access-control) for more details on role-based access control with Conductor and generating API keys for your environment.

### Configure API Client

```typescript
/**
 * Application keys generated from the Application menu > Create Application
 * then edit and create Access Keys
 *
 */
import { OrkesApiConfig, orkesConductorClient } from "@io-orkes/conductor-javascript";

const config: Partial<OrkesApiConfig> = {
  keyId: "XXX", // optional
  keySecret: "XXXX", // optional
  refreshTokenInterval: 0, // optional (in milliseconds) | defaults to 30 minutes | 0 = no refresh
  serverUrl: "https://play.orkes.io/api",
};

orkesConductorClient(config).then(client => ..... );

```

### Next: [Create and run task workers](workers_sdk.md)
