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
