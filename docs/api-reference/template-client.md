# TemplateClient API Reference

The `TemplateClient` provides functionality for managing human task templates. Human task templates define the UI forms and schemas that are presented to users when they interact with human tasks in workflows.

## Constructor

### `new TemplateClient(client: Client)`

Creates a new TemplateClient.

**Parameters:**

-   `client` (`Client`): An instance of `Client`.

---

## Methods

### `registerTemplate(template: HumanTaskTemplate, asNewVersion: boolean = false): Promise<HumanTaskTemplate>`

Register a new human task template or creates a new version of an existing template.

**Parameters:**

-   `template` (`HumanTaskTemplate`): The human task template to register.
-   `asNewVersion` (`boolean`, optional): Whether to create as a new version. Defaults to `false`.

**Returns:**

-   `Promise<HumanTaskTemplate>`: The registered template.

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
        description: "Approve the request"
      },
      comments: {
        type: "string",
        description: "Additional comments"
      }
    },
    required: ["approved"]
  },
  templateUI: {
    fields: [
      {
        name: "approved",
        type: "boolean",
        label: "Approval",
        required: true
      },
      {
        name: "comments",
        type: "text",
        label: "Comments",
        required: false
      }
    ]
  }
};

const registeredTemplate = await templateClient.registerTemplate(template);
console.log(`Template registered with version: ${registeredTemplate.version}`);
```

---

## Type Definitions

### `HumanTaskTemplate`

Human task template definition that specifies the form schema and UI for human tasks.

| Property | Type | Description |
| --- | --- | --- |
| `createTime` | `number` | The creation time of the template. |
| `createdBy` | `string` | The user who created the template. |
| `jsonSchema` | `Record<string, unknown>` | JSON schema defining the structure and validation rules for the form data. |
| `name` | `string` | The name of the template. |
| `ownerApp` | `string` | The owner application of the template. |
| `tags` | `Tag[]` | The tags associated with the template. |
| `templateUI` | `Record<string, unknown>` | UI configuration defining how the form should be rendered. |
| `updateTime` | `number` | The last update time of the template. |
| `updatedBy` | `string` | The user who last updated the template. |
| `version` | `number` | The version of the template. |

## JSON Schema

The `jsonSchema` property should follow the [JSON Schema specification](https://json-schema.org/) and defines:

- **Data Structure**: The expected format of the form data
- **Validation Rules**: Required fields, data types, constraints
- **Field Descriptions**: Help text and labels

**Example:**

```json
{
  "type": "object",
  "properties": {
    "approved": {
      "type": "boolean",
      "description": "Whether the request is approved"
    },
    "amount": {
      "type": "number",
      "minimum": 0,
      "description": "Amount to approve"
    }
  },
  "required": ["approved"]
}
```

## Template UI

The `templateUI` property defines how the form should be rendered in the user interface. This typically includes:

- **Field Types**: Input types (text, select, checkbox, etc.)
- **Labels**: User-friendly field labels
- **Validation**: Client-side validation rules
- **Layout**: Form layout and styling information

**Example:**

```json
{
  "fields": [
    {
      "name": "approved",
      "type": "boolean",
      "label": "Approve Request",
      "required": true
    },
    {
      "name": "comments",
      "type": "text",
      "label": "Comments",
      "required": false,
      "placeholder": "Enter your comments here"
    }
  ]
}
```

## Versioning

Templates support versioning to allow for evolution of forms over time:

- **New Templates**: Set `version: 1` when creating a new template
- **New Versions**: Set `asNewVersion: true` when registering to create a new version
- **Version Compatibility**: Consider backward compatibility when updating templates

## Usage in Workflows

Once registered, templates can be referenced in human tasks within workflows:

```typescript
import { humanTask } from "@io-orkes/conductor-javascript";

const task = humanTask("approval_ref", "approval_task", {
  template: "approval_form"  // References the template name
});
```

## Best Practices

1. **Schema Validation**: Always provide comprehensive JSON schemas with proper validation
2. **UI Consistency**: Maintain consistent field naming and types across versions
3. **Version Management**: Plan for template evolution and maintain backward compatibility
4. **Required Fields**: Clearly mark required fields in both schema and UI
5. **User Experience**: Provide helpful descriptions and placeholders for better UX
