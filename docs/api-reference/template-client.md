# TemplateClient API Reference

The `TemplateClient` class provides methods for managing human task templates (forms and UI).

## Constructor

### `new TemplateClient(client: ConductorClient)`

Creates a new `TemplateClient`.

**Parameters:**

-   `client` (`ConductorClient`): An instance of `ConductorClient`.

---

## Methods

### `registerTemplate(template: HumanTaskTemplate, asNewVersion: boolean = false): Promise<HumanTaskTemplate>`

Registers a new human task template.

**Parameters:**

-   `template` (`HumanTaskTemplate`): The template to register.
-   `asNewVersion` (`boolean`, optional): Whether to register the template as a new version. Defaults to `false`.

**Returns:**

-   `Promise<HumanTaskTemplate>`: The registered template.

---

## Type Definitions

### `HumanTaskTemplate`
| Property | Type | Description |
| --- | --- | --- |
| `createdBy` | `string` | The user who created the template. |
| `createdOn` | `number` | The creation time of the template. |
| `jsonSchema` | `Record<string, any>` | The JSON schema of the template. |
| `name` | `string` | The name of the template. |
| `templateUI` | `Record<string, any>` | The UI of the template. |
| `updatedBy` | `string` | The user who last updated the template. |
| `updatedOn` | `number` | The last update time of the template. |
| `version` | `number` | The version of the template. |
