# Getting Started

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
  refreshTokenInterval: 0, // optional (in milliseconds) defaults to 30 minutes (30 * 60 * 1000). 0 no refresh
  serverUrl: "https://play.orkes.io/api",
};

orkesConductorClient(config).then(client => ..... );

```

### More Docs

* [Create and run task workers](workers.md)
* [Create Workflows](create.md)
* [Search for entities](search.md)
* [Execute Workflows](execute.md)
* [About](about.md)

