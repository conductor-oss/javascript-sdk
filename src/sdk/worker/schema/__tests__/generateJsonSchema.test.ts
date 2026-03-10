import { describe, it, expect } from "@jest/globals";
import { jsonSchema } from "../generateJsonSchema";

describe("jsonSchema()", () => {
  it("should generate schema with $schema field", () => {
    const schema = jsonSchema({ name: { type: "string" } });
    expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(schema.type).toBe("object");
  });

  it("should generate schema for a single string field", () => {
    const schema = jsonSchema({ name: { type: "string" } });
    expect(schema.properties).toEqual({ name: { type: "string" } });
    expect(schema.required).toBeUndefined();
  });

  it("should mark required fields", () => {
    const schema = jsonSchema({
      orderId: { type: "string", required: true },
      amount: { type: "number" },
    });
    expect(schema.required).toEqual(["orderId"]);
  });

  it("should handle multiple required fields", () => {
    const schema = jsonSchema({
      a: { type: "string", required: true },
      b: { type: "number", required: true },
      c: { type: "boolean" },
    });
    expect(schema.required).toEqual(["a", "b"]);
  });

  it("should handle all basic types", () => {
    const schema = jsonSchema({
      s: { type: "string" },
      n: { type: "number" },
      i: { type: "integer" },
      b: { type: "boolean" },
      o: { type: "object" },
      a: { type: "array" },
      nil: { type: "null" },
    });
    expect(schema.properties).toEqual({
      s: { type: "string" },
      n: { type: "number" },
      i: { type: "integer" },
      b: { type: "boolean" },
      o: { type: "object" },
      a: { type: "array" },
      nil: { type: "null" },
    });
  });

  it("should handle array with items", () => {
    const schema = jsonSchema({
      tags: { type: "array", items: { type: "string" } },
    });
    expect(schema.properties).toEqual({
      tags: { type: "array", items: { type: "string" } },
    });
  });

  it("should handle nested objects", () => {
    const schema = jsonSchema({
      address: {
        type: "object",
        properties: {
          street: { type: "string", required: true },
          city: { type: "string" },
        },
      },
    });
    expect(schema.properties).toEqual({
      address: {
        type: "object",
        properties: {
          street: { type: "string" },
          city: { type: "string" },
        },
        required: ["street"],
      },
    });
  });

  it("should include description when provided", () => {
    const schema = jsonSchema({
      age: { type: "integer", description: "User age in years" },
    });
    expect(schema.properties).toEqual({
      age: { type: "integer", description: "User age in years" },
    });
  });

  it("should include default value when provided", () => {
    const schema = jsonSchema({
      count: { type: "integer", default: 10 },
    });
    expect(schema.properties).toEqual({
      count: { type: "integer", default: 10 },
    });
  });

  it("should include enum values when provided", () => {
    const schema = jsonSchema({
      status: { type: "string", enum: ["active", "inactive", "pending"] },
    });
    expect(schema.properties).toEqual({
      status: { type: "string", enum: ["active", "inactive", "pending"] },
    });
  });

  it("should handle empty field set", () => {
    const schema = jsonSchema({});
    expect(schema).toEqual({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {},
    });
    expect(schema.required).toBeUndefined();
  });

  it("should handle deeply nested objects", () => {
    const schema = jsonSchema({
      level1: {
        type: "object",
        properties: {
          level2: {
            type: "object",
            properties: {
              value: { type: "string", required: true },
            },
          },
        },
      },
    });
    const level1 = schema.properties.level1 as Record<string, unknown>;
    const level2 = (level1.properties as Record<string, unknown>).level2 as Record<string, unknown>;
    expect(level2.required).toEqual(["value"]);
  });

  it("should handle array of objects", () => {
    const schema = jsonSchema({
      items: {
        type: "array",
        items: { type: "object" },
      },
    });
    expect(schema.properties).toEqual({
      items: { type: "array", items: { type: "object" } },
    });
  });
});
