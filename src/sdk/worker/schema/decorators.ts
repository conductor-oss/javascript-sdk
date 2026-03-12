import type { JsonSchemaOutput, JsonSchemaType } from "./generateJsonSchema.js";

// Augment Reflect with metadata methods from reflect-metadata
// (available at runtime when reflect-metadata is imported by the consumer)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
 * Type guard for Stage 3 (TypeScript 5.0+) decorator context.
 * New decorators pass (value, context) where context has a `kind` property.
 */
function isNewDecoratorContext(
  arg: unknown
): arg is { kind: string; name: string | symbol } {
  return (
    typeof arg === "object" &&
    arg !== null &&
    "kind" in arg &&
    typeof (arg as { kind: string }).kind === "string"
  );
}

/**
 * Track (class, propertyKey) pairs already stored to avoid duplicates when
 * the initializer runs on each instance (Stage 3 decorator API).
 */
const schemaFieldProcessed = new WeakMap<object, Set<string>>();

function storeSchemaFieldMetadata(
  cls: object,
  propertyKey: string,
  options: SchemaFieldOptions,
  designType?: unknown
): void {
  const existing: StoredFieldMeta[] =
    (Reflect.getOwnMetadata(SCHEMA_METADATA_KEY, cls) as StoredFieldMeta[] | undefined) ?? [];

  existing.push({
    ...options,
    propertyKey,
    designType,
  });

  Reflect.defineMetadata(SCHEMA_METADATA_KEY, existing, cls);
}

/**
 * Property decorator to define JSON Schema metadata on a class.
 *
 * When used with `generateSchemaFromClass()`, produces a JSON Schema draft-07
 * object from the decorated properties.
 *
 * Supports both TypeScript 5.0+ (Stage 3) and legacy (experimentalDecorators)
 * decorator APIs.
 *
 * If `emitDecoratorMetadata` is enabled in tsconfig.json (legacy mode), the
 * TypeScript type is automatically inferred for `string`, `number`, `boolean` —
 * no need to specify `type` explicitly for those.
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
  return function (
    targetOrValue: object | undefined,
    propertyKeyOrContext?: string | { kind: string; name: string | symbol }
  ): ((initialValue: unknown) => unknown) | undefined {
    if (isNewDecoratorContext(propertyKeyOrContext)) {
      // Stage 3 (TypeScript 5.0+) API: (value, context)
      // Return initializer that runs when instance is created; `this` = instance
      const propertyKey = String(propertyKeyOrContext.name);
      return function (this: unknown, initialValue: unknown) {
        const cls = (this as object).constructor as object;
        const processed = schemaFieldProcessed.get(cls) ?? new Set<string>();
        if (!processed.has(propertyKey)) {
          processed.add(propertyKey);
          schemaFieldProcessed.set(cls, processed);
          let designType: unknown;
          try {
            designType = Reflect.getMetadata(
              "design:type",
              this as object,
              propertyKey
            );
          } catch {
            // reflect-metadata may not emit design:type for Stage 3 decorators
          }
          storeSchemaFieldMetadata(cls, propertyKey, options, designType);
        }
        return initialValue;
      };
    }

    // Legacy (experimentalDecorators) API: (target, propertyKey)
    const target = targetOrValue as object;
    const propertyKey = propertyKeyOrContext as string;
    let designType: unknown;
    try {
      designType = Reflect.getMetadata("design:type", target, propertyKey);
    } catch {
      // reflect-metadata not available — user must provide type explicitly
    }
    storeSchemaFieldMetadata(target.constructor as object, propertyKey, options, designType);
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
