import type { JsonSchemaOutput, JsonSchemaType } from "./generateJsonSchema.js";

// Augment Reflect with metadata methods from reflect-metadata
// (available at runtime when reflect-metadata is imported by the consumer)
declare global {
  namespace Reflect {
    function getMetadata(key: unknown, target: object, propertyKey?: string): unknown;
    function getOwnMetadata(key: unknown, target: object): unknown;
    function defineMetadata(key: unknown, value: unknown, target: object): void;
  }
}

const SCHEMA_METADATA_KEY = Symbol("conductor:schemaField");

/**
 * Options for the @schemaField property decorator.
 */
export interface SchemaFieldOptions {
  /** JSON Schema type. If omitted, inferred from TypeScript type metadata. */
  type?: JsonSchemaType;
  /** Whether this field is required (default: false) */
  required?: boolean;
  /** Field description */
  description?: string;
  /** For arrays: element type or schema */
  items?: { type: JsonSchemaType } | SchemaFieldOptions;
  /** For objects: nested property definitions */
  properties?: Record<string, SchemaFieldOptions>;
  /** Default value */
  default?: unknown;
  /** Enum values */
  enum?: unknown[];
}

interface StoredFieldMeta extends SchemaFieldOptions {
  propertyKey: string;
  designType?: unknown;
}

/**
 * Property decorator to define JSON Schema metadata on a class.
 *
 * When used with `generateSchemaFromClass()`, produces a JSON Schema draft-07
 * object from the decorated properties.
 *
 * If `emitDecoratorMetadata` is enabled in tsconfig.json, the TypeScript type
 * is automatically inferred for `string`, `number`, `boolean` — no need to
 * specify `type` explicitly for those.
 *
 * @example
 * ```typescript
 * class OrderInput {
 *   @schemaField({ required: true })
 *   orderId!: string;
 *
 *   @schemaField()
 *   amount!: number;
 *
 *   @schemaField({ type: "array", items: { type: "string" } })
 *   items!: string[];
 * }
 *
 * const schema = generateSchemaFromClass(OrderInput);
 * ```
 */
export function schemaField(options: SchemaFieldOptions = {}) {
  return function (target: object, propertyKey: string) {
    // Read existing field metadata for this class
    const existing: StoredFieldMeta[] =
      (Reflect.getOwnMetadata(SCHEMA_METADATA_KEY, target.constructor) as StoredFieldMeta[] | undefined) ?? [];

    // Try to infer type from TypeScript metadata
    let designType: unknown;
    try {
      designType = Reflect.getMetadata("design:type", target, propertyKey);
    } catch {
      // reflect-metadata not available — user must provide type explicitly
    }

    existing.push({
      ...options,
      propertyKey,
      designType,
    });

    Reflect.defineMetadata(SCHEMA_METADATA_KEY, existing, target.constructor);
  };
}

/**
 * Map TypeScript design:type to JSON Schema type.
 */
function inferType(designType: unknown): JsonSchemaType | undefined {
  if (designType === String) return "string";
  if (designType === Number) return "number";
  if (designType === Boolean) return "boolean";
  if (designType === Array) return "array";
  if (designType === Object) return "object";
  return undefined;
}

function fieldMetaToProperty(meta: StoredFieldMeta): Record<string, unknown> {
  const resolvedType =
    meta.type ?? inferType(meta.designType) ?? "string";
  const prop: Record<string, unknown> = { type: resolvedType };

  if (meta.description !== undefined) prop.description = meta.description;
  if (meta.default !== undefined) prop.default = meta.default;
  if (meta.enum !== undefined) prop.enum = meta.enum;

  if (resolvedType === "array" && meta.items) {
    prop.items = { type: (meta.items as { type: string }).type ?? "string" };
  }

  if (resolvedType === "object" && meta.properties) {
    const nested = buildFromFieldOptions(meta.properties);
    prop.properties = nested.properties;
    if (nested.required.length > 0) prop.required = nested.required;
  }

  return prop;
}

function buildFromFieldOptions(
  fields: Record<string, SchemaFieldOptions>
): { properties: Record<string, unknown>; required: string[] } {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [name, opts] of Object.entries(fields)) {
    properties[name] = fieldMetaToProperty({
      ...opts,
      propertyKey: name,
    });
    if (opts.required) required.push(name);
  }
  return { properties, required };
}

/**
 * Generate a JSON Schema (draft-07) from a class decorated with `@schemaField()`.
 *
 * Uses `reflect-metadata` to read TypeScript type information when available,
 * falling back to explicit `type` in `@schemaField()` options.
 *
 * @param cls - A class constructor with `@schemaField()` decorated properties
 * @returns JSON Schema draft-07 object
 *
 * @example
 * ```typescript
 * class OrderInput {
 *   @schemaField({ required: true })
 *   orderId!: string;
 *
 *   @schemaField()
 *   amount!: number;
 * }
 *
 * const schema = generateSchemaFromClass(OrderInput);
 * // → { "$schema": "...", type: "object", properties: { orderId: { type: "string" }, ... }, required: ["orderId"] }
 * ```
 */
export function generateSchemaFromClass(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cls: new (...args: any[]) => unknown
): JsonSchemaOutput {
  const fields: StoredFieldMeta[] =
    (Reflect.getOwnMetadata(SCHEMA_METADATA_KEY, cls) as StoredFieldMeta[] | undefined) ?? [];

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const field of fields) {
    properties[field.propertyKey] = fieldMetaToProperty(field);
    if (field.required) {
      required.push(field.propertyKey);
    }
  }

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
