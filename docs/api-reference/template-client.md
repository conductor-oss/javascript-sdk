# TemplateClient API Reference

The `TemplateClient` provides functionality for managing human task templates. Human task templates define the UI forms and schemas that are presented to users when they interact with human tasks in workflows.

## Constructor

### `new TemplateClient(client: Client)`

Creates a new TemplateClient.

**Parameters:**

- `client` (`Client`): An instance of `Client`.

---

## Methods

### `registerTemplate(template: HumanTaskTemplate, asNewVersion: boolean = false): Promise<HumanTaskTemplate>`

Register a new human task template or creates a new version of an existing template.

**Parameters:**

- `template` (`HumanTaskTemplate`): The human task template to register.
- `asNewVersion` (`boolean`, optional): Whether to create as a new version. Defaults to `false`.

**Returns:**

- `Promise<HumanTaskTemplate>`: The registered template.

**Example:**

```typescript
import { TemplateClient } from "@io-orkes/conductor-javascript";

const templateClient = new TemplateClient(client);

// Register a new template
const template = {
  name: "approval_form",
  version: 1,
  jsonSchema: {
    type: "object",
    properties: {
      approved: {
        type: "boolean",
        description: "Approve the request",
      },
      comments: {
        type: "string",
        description: "Additional comments",
      },
    },
    required: ["approved"],
  },
  templateUI: {
    fields: [
      {
        name: "approved",
        type: "boolean",
        label: "Approval",
        required: true,
      },
      {
        name: "comments",
        type: "text",
        label: "Comments",
        required: false,
      },
    ],
  },
};

const registeredTemplate = await templateClient.registerTemplate(template);
console.log(`Template registered with version: ${registeredTemplate.version}`);
```

## Usage in Workflows

Once registered, templates can be referenced in human tasks within workflows:

```typescript
import { humanTask } from "@io-orkes/conductor-javascript";

const task = humanTask("approval_ref", "approval_task", {
  template: "approval_form", // References the template name
});
```

## Type Definitions

### `HumanTaskTemplate`

Human task template definition that specifies the form schema and UI for human tasks.

```typescript
export type HumanTaskTemplate = {
  createTime?: number;
  createdBy?: string;
  jsonSchema: {
    [key: string]: unknown;
  };
  name: string;
  ownerApp?: string;
  tags?: Array<Tag>;
  templateUI: {
    [key: string]: unknown;
  };
  updateTime?: number;
  updatedBy?: string;
  version: number;
};
```

### `Tag`

Tag associated with a template for categorization and search.

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
