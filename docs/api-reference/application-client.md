# ApplicationClient API Reference

The `ApplicationClient` manages applications in Conductor. Applications are security entities that can be granted access keys and roles to interact with Conductor workflows and tasks.

## Constructor

### `new ApplicationClient(client: Client)`

Creates a new `ApplicationClient`.

**Parameters:**

- `client` (`Client`): An instance of `Client`.

---

## Methods

### `getAllApplications(): Promise<ExtendedConductorApplication[]>`

Gets all applications registered in Conductor.

**Returns:**

- `Promise<ExtendedConductorApplication[]>`: An array of all applications.

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Get all applications
const applications = await appClient.getAllApplications();
console.log(`Found ${applications.length} applications`);
```

---

### `createApplication(applicationName: string): Promise<ExtendedConductorApplication>`

Creates a new application.

**Parameters:**

- `applicationName` (`string`): The name of the application to create.

**Returns:**

- `Promise<ExtendedConductorApplication>`: The created application.

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Create a new application
const app = await appClient.createApplication("my-service");
console.log(`Created application: ${app.id}`);
```

---

### `getApplication(applicationId: string): Promise<ExtendedConductorApplication>`

Gets an application by its ID.

**Parameters:**

- `applicationId` (`string`): The ID of the application.

**Returns:**

- `Promise<ExtendedConductorApplication>`: The application.

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Get a specific application
const app = await appClient.getApplication("app-123");
console.log(`Application name: ${app.name}`);
```

---

### `getAppByAccessKeyId(accessKeyId: string): Promise<ExtendedConductorApplication>`

Gets an application by its access key ID.

**Parameters:**

- `accessKeyId` (`string`): The access key ID.

**Returns:**

- `Promise<ExtendedConductorApplication>`: The application associated with the access key.

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Get application by access key
const app = await appClient.getAppByAccessKeyId("key-123");
console.log(`Application: ${app.name}`);
```

---

### `updateApplication(applicationId: string, newApplicationName: string): Promise<ExtendedConductorApplication>`

Updates an application's name.

**Parameters:**

- `applicationId` (`string`): The ID of the application to update.
- `newApplicationName` (`string`): The new name for the application.

**Returns:**

- `Promise<ExtendedConductorApplication>`: The updated application.

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Update application name
const app = await appClient.updateApplication("app-123", "my-service-v2");
console.log(`Updated application name to: ${app.name}`);
```

---

### `deleteApplication(applicationId: string): Promise<void>`

Deletes an application.

**Parameters:**

- `applicationId` (`string`): The ID of the application to delete.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Delete an application
await appClient.deleteApplication("app-123");
console.log("Application deleted");
```

---

### `getAccessKeys(applicationId: string): Promise<AccessKeyInfo[]>`

Gets all access keys for an application.

**Parameters:**

- `applicationId` (`string`): The ID of the application.

**Returns:**

- `Promise<AccessKeyInfo[]>`: An array of access key information.

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Get access keys for an application
const keys = await appClient.getAccessKeys("app-123");
console.log(`Found ${keys.length} access keys`);
keys.forEach((key) => {
  console.log(`Key ${key.id}: ${key.status}`);
});
```

---

### `createAccessKey(applicationId: string): Promise<AccessKey>`

Creates a new access key for an application.

**Important:** Save the access key secret immediately after creation - it cannot be retrieved later.

**Parameters:**

- `applicationId` (`string`): The ID of the application.

**Returns:**

- `Promise<AccessKey>`: The created access key with its secret.

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Create a new access key
const accessKey = await appClient.createAccessKey("app-123");
console.log(`Key ID: ${accessKey.id}`);
console.log(`Key Secret: ${accessKey.secret}`); // Save this immediately!
```

---

### `deleteAccessKey(applicationId: string, keyId: string): Promise<void>`

Deletes an access key.

**Parameters:**

- `applicationId` (`string`): The ID of the application.
- `keyId` (`string`): The ID of the access key to delete.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Delete an access key
await appClient.deleteAccessKey("app-123", "key-456");
console.log("Access key deleted");
```

---

### `toggleAccessKeyStatus(applicationId: string, keyId: string): Promise<AccessKeyInfo>`

Toggles the status of an access key between `ACTIVE` and `INACTIVE`.

**Parameters:**

- `applicationId` (`string`): The ID of the application.
- `keyId` (`string`): The ID of the access key.

**Returns:**

- `Promise<AccessKeyInfo>`: The updated access key information.

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Toggle access key status
const keyInfo = await appClient.toggleAccessKeyStatus("app-123", "key-456");
console.log(`Access key is now ${keyInfo.status}`);
```

---

### `addApplicationRole(applicationId: string, role: ApplicationRole): Promise<void>`

Adds a role to an application user.

**Parameters:**

- `applicationId` (`string`): The ID of the application.
- `role` (`ApplicationRole`): The role to add.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { ApplicationClient, ApplicationRole } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Add a role to the application
await appClient.addApplicationRole("app-123", "WORKFLOW_MANAGER");
console.log("Role added");

// You can also use the ApplicationRole type
const role: ApplicationRole = "METADATA_MANAGER";
await appClient.addApplicationRole("app-123", role);
```

---

### `removeRoleFromApplicationUser(applicationId: string, role: string): Promise<void>`

Removes a role from an application user.

**Parameters:**

- `applicationId` (`string`): The ID of the application.
- `role` (`string`): The role to remove.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Remove a role from the application
await appClient.removeRoleFromApplicationUser("app-123", "WORKFLOW_EXECUTOR");
console.log("Role removed");
```

---

### `getApplicationTags(applicationId: string): Promise<Tag[]>`

Gets all tags associated with an application.

**Parameters:**

- `applicationId` (`string`): The ID of the application.

**Returns:**

- `Promise<Tag[]>`: An array of tags.

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Get tags for an application
const tags = await appClient.getApplicationTags("app-123");
console.log(`Application has ${tags.length} tags`);
```

---

### `addApplicationTags(applicationId: string, tags: Tag[]): Promise<void>`

Adds multiple tags to an application (replaces existing tags).

**Parameters:**

- `applicationId` (`string`): The ID of the application.
- `tags` (`Tag[]`): An array of tags to add.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Add tags to an application
await appClient.addApplicationTags("app-123", [
  { key: "environment", value: "production" },
  { key: "team", value: "backend" },
  { key: "service", value: "payment" },
]);
```

---

### `addApplicationTag(applicationId: string, tag: Tag): Promise<void>`

Adds a single tag to an application.

**Parameters:**

- `applicationId` (`string`): The ID of the application.
- `tag` (`Tag`): The tag to add.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Add a single tag
await appClient.addApplicationTag("app-123", {
  key: "version",
  value: "2.0",
});
```

---

### `deleteApplicationTags(applicationId: string, tags: Tag[]): Promise<void>`

Deletes multiple tags from an application.

**Parameters:**

- `applicationId` (`string`): The ID of the application.
- `tags` (`Tag[]`): An array of tags to delete.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Delete multiple tags
await appClient.deleteApplicationTags("app-123", [
  { key: "environment", value: "production" },
  { key: "team", value: "backend" },
]);
```

---

### `deleteApplicationTag(applicationId: string, tag: Tag): Promise<void>`

Deletes a specific tag from an application.

**Parameters:**

- `applicationId` (`string`): The ID of the application.
- `tag` (`Tag`): The tag to delete (must match both `key` and `value`).

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { ApplicationClient } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);

// Delete a specific tag
await appClient.deleteApplicationTag("app-123", {
  key: "version",
  value: "2.0",
});
```

---

## Type Definitions

### `ExtendedConductorApplication`

```typescript
export interface ExtendedConductorApplication {
  id: string;
  name: string;
  createdBy: string;
  createTime: number;
  updatedBy: string;
  updateTime: number;
  tags?: Array<Tag>;
};
```

### `AccessKey`

```typescript
export interface AccessKey {
  id: string;
  secret: string;
};
```

### `AccessKeyInfo`

```typescript
export interface AccessKeyInfo {
  id: string;
  createdAt: number;
  status: "ACTIVE" | "INACTIVE";
};
```

### `Tag`

```typescript
export type Tag = {
  key?: string;
  /**
   * @deprecated
   */
  type?: string;
  value?: string;
};
```

### `ApplicationRole`

Defines the available roles that can be assigned to an application.

```typescript
export type ApplicationRole =
  | "ADMIN"
  | "UNRESTRICTED_WORKER"
  | "METADATA_MANAGER"
  | "WORKFLOW_MANAGER"
  | "APPLICATION_MANAGER"
  | "USER"
  | "USER_READ_ONLY"
  | "WORKER"
  | "APPLICATION_CREATOR"
  | "METADATA_API"
  | "PROMPT_MANAGER";
```

**Role Descriptions:**

- `ADMIN` - Full administrative access to all resources
- `UNRESTRICTED_WORKER` - Can execute any task without restrictions
- `METADATA_MANAGER` - Can manage workflow and task definitions
- `WORKFLOW_MANAGER` - Can manage workflow executions
- `APPLICATION_MANAGER` - Can manage applications and access keys
- `USER` - Standard user access
- `USER_READ_ONLY` - Read-only access to resources
- `WORKER` - Can poll for and execute assigned tasks
- `APPLICATION_CREATOR` - Can create new applications
- `METADATA_API` - API access to metadata operations
- `PROMPT_MANAGER` - Can manage AI prompts and templates

