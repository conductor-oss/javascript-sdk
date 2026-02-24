/**
 * Lightweight JSON Schema (draft-07) generator from declarative field descriptions.
 *
 * TypeScript has no runtime type reflection, so this provides a practical
 * alternative: describe your fields declaratively and get a valid JSON Schema object.
 *
 * @example
 * ```typescript
 * const schema = jsonSchema({
 *   orderId: { type: "string", required: true },
 *   amount: { type: "number" },
 *   items: { type: "array", items: { type: "string" } },
 *   address: {
 *     type: "object",
 *     properties: {
 *       street: { type: "string", required: true },
 *       city: { type: "string" },
 *     },
 *   },
 * });
 * ```
 */

export type JsonSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "null";

export interface FieldDescriptor {
  type: JsonSchemaType;
  required?: boolean;
  description?: string;
  /** For arrays: schema of array items */
  items?: FieldDescriptor;
  /** For objects: nested property descriptors */
  properties?: Record<string, FieldDescriptor>;
  /** Default value */
  default?: unknown;
  /** Enum values */
  enum?: unknown[];
}

export interface JsonSchemaOutput {
  $schema: string;
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

function fieldToSchemaProperty(field: FieldDescriptor): Record<string, unknown> {
  const prop: Record<string, unknown> = { type: field.type };

  if (field.description !== undefined) {
    prop.description = field.description;
  }

  if (field.default !== undefined) {
    prop.default = field.default;
  }

  if (field.enum !== undefined) {
    prop.enum = field.enum;
  }

  if (field.type === "array" && field.items) {
    prop.items = fieldToSchemaProperty(field.items);
  }

  if (field.type === "object" && field.properties) {
    const nested = buildObjectSchema(field.properties);
    prop.properties = nested.properties;
    if (nested.required && nested.required.length > 0) {
      prop.required = nested.required;
    }
  }

  return prop;
}

function buildObjectSchema(fields: Record<string, FieldDescriptor>): {
  properties: Record<string, unknown>;
  required: string[];
} {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [name, field] of Object.entries(fields)) {
    properties[name] = fieldToSchemaProperty(field);
    if (field.required) {
      required.push(name);
    }
  }

  return { properties, required };
}

/**
 * Generate a JSON Schema (draft-07) from declarative field descriptions.
 */
export function jsonSchema(
  fields: Record<string, FieldDescriptor>
): JsonSchemaOutput {
  const { properties, required } = buildObjectSchema(fields);
  const schema: JsonSchemaOutput = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties,
  };
  if (required.length > 0) {
    schema.required = required;
  }
  return schema;
}
