import "reflect-metadata";
import { describe, it, expect } from "@jest/globals";
import { schemaField, generateSchemaFromClass } from "../decorators";

describe("@schemaField() decorator", () => {
  describe("type inference via reflect-metadata", () => {
    it("should infer string type", () => {
      class TestClass {
        @schemaField()
        name!: string;
      }
      const schema = generateSchemaFromClass(TestClass);
      expect(schema.properties).toEqual({ name: { type: "string" } });
    });

    it("should infer number type", () => {
      class TestClass {
        @schemaField()
        amount!: number;
      }
      const schema = generateSchemaFromClass(TestClass);
      expect(schema.properties).toEqual({ amount: { type: "number" } });
    });

    it("should infer boolean type", () => {
      class TestClass {
        @schemaField()
        active!: boolean;
      }
      const schema = generateSchemaFromClass(TestClass);
      expect(schema.properties).toEqual({ active: { type: "boolean" } });
    });
  });

  describe("required fields", () => {
    it("should include field in required array", () => {
      class TestClass {
        @schemaField({ required: true })
        id!: string;

        @schemaField()
        name!: string;
      }
      const schema = generateSchemaFromClass(TestClass);
      expect(schema.required).toEqual(["id"]);
    });

    it("should handle multiple required fields", () => {
      class TestClass {
        @schemaField({ required: true })
        a!: string;

        @schemaField({ required: true })
        b!: number;
      }
      const schema = generateSchemaFromClass(TestClass);
      expect(schema.required).toEqual(["a", "b"]);
    });
  });

  describe("explicit type override", () => {
    it("should use explicit type over inferred type", () => {
      class TestClass {
        @schemaField({ type: "integer" })
        count!: number;
      }
      const schema = generateSchemaFromClass(TestClass);
      expect(schema.properties).toEqual({ count: { type: "integer" } });
    });
  });

  describe("array fields", () => {
    it("should handle array with items spec", () => {
      class TestClass {
        @schemaField({ type: "array", items: { type: "string" } })
        tags!: string[];
      }
      const schema = generateSchemaFromClass(TestClass);
      expect(schema.properties).toEqual({
        tags: { type: "array", items: { type: "string" } },
      });
    });
  });

  describe("description, default, and enum", () => {
    it("should include description", () => {
      class TestClass {
        @schemaField({ description: "User's age" })
        age!: number;
      }
      const schema = generateSchemaFromClass(TestClass);
      expect((schema.properties.age as Record<string, unknown>).description).toBe("User's age");
    });

    it("should include default value", () => {
      class TestClass {
        @schemaField({ default: 42 })
        count!: number;
      }
      const schema = generateSchemaFromClass(TestClass);
      expect((schema.properties.count as Record<string, unknown>).default).toBe(42);
    });

    it("should include enum values", () => {
      class TestClass {
        @schemaField({ type: "string", enum: ["A", "B", "C"] })
        status!: string;
      }
      const schema = generateSchemaFromClass(TestClass);
      expect((schema.properties.status as Record<string, unknown>).enum).toEqual(["A", "B", "C"]);
    });
  });

  describe("empty and multiple classes", () => {
    it("should return empty schema for class with no decorated fields", () => {
      // eslint-disable-next-line @typescript-eslint/no-extraneous-class
      class EmptyClass {}
      const schema = generateSchemaFromClass(EmptyClass);
      expect(schema).toEqual({
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {},
      });
    });

    it("should not share metadata between different classes", () => {
      class ClassA {
        @schemaField({ required: true })
        fieldA!: string;
      }
      class ClassB {
        @schemaField()
        fieldB!: number;
      }
      const schemaA = generateSchemaFromClass(ClassA);
      const schemaB = generateSchemaFromClass(ClassB);

      expect(Object.keys(schemaA.properties)).toEqual(["fieldA"]);
      expect(Object.keys(schemaB.properties)).toEqual(["fieldB"]);
    });
  });

  describe("$schema field", () => {
    it("should always include JSON Schema draft-07 URI", () => {
      class TestClass {
        @schemaField()
        x!: string;
      }
      expect(generateSchemaFromClass(TestClass).$schema).toBe(
        "http://json-schema.org/draft-07/schema#"
      );
    });
  });

  describe("nested object fields", () => {
    it("should handle object with nested properties", () => {
      class TestClass {
        @schemaField({
          type: "object",
          properties: {
            street: { type: "string", required: true },
            city: { type: "string" },
          },
        })
        address!: object;
      }
      const schema = generateSchemaFromClass(TestClass);
      const address = schema.properties.address as Record<string, unknown>;
      expect(address.type).toBe("object");
      expect(address.properties).toEqual({
        street: { type: "string" },
        city: { type: "string" },
      });
      expect(address.required).toEqual(["street"]);
    });
  });

  describe("Stage 3 (TypeScript 5.0+) decorator API", () => {
    it("should register fields when called with new decorator signature (value, context)", () => {
      class TestClass {
        name = "";
      }
      // Simulate new decorator API: decorator(value, context) returns initializer
      const decorator = schemaField({ type: "string" });
      const initializer = decorator(undefined, {
        kind: "field",
        name: "name",
      }) as (initialValue: unknown) => unknown;
      expect(typeof initializer).toBe("function");

      // Initializer runs when instance is created; bind instance as `this`
      const instance = new TestClass();
      initializer.call(instance, "");

      const schema = generateSchemaFromClass(TestClass);
      expect(schema.properties).toEqual({ name: { type: "string" } });
    });

    it("should support required fields with new API", () => {
      class TestClass {
        id = "";
        count = 0;
      }
      const initId = schemaField({ type: "string", required: true })(
        undefined,
        { kind: "field", name: "id" }
      ) as (v: unknown) => unknown;
      const initCount = schemaField({ type: "number" })(
        undefined,
        { kind: "field", name: "count" }
      ) as (v: unknown) => unknown;

      const instance = new TestClass();
      initId.call(instance, "");
      initCount.call(instance, 0);

      const schema = generateSchemaFromClass(TestClass);
      expect(schema.properties).toEqual({
        id: { type: "string" },
        count: { type: "number" },
      });
      expect(schema.required).toEqual(["id"]);
    });

    it("should not duplicate metadata when initializer runs multiple times", () => {
      class TestClass {
        value = "";
      }
      const initializer = schemaField({ type: "string" })(
        undefined,
        { kind: "field", name: "value" }
      ) as (v: unknown) => unknown;

      const i1 = new TestClass();
      const i2 = new TestClass();
      const i3 = new TestClass();
      initializer.call(i1, "");
      initializer.call(i2, "");
      initializer.call(i3, "");

      const schema = generateSchemaFromClass(TestClass);
      expect(schema.properties).toEqual({ value: { type: "string" } });
      expect(Object.keys(schema.properties)).toHaveLength(1);
    });

    it("should work with explicit type when design:type unavailable (new API)", () => {
      class TestClass {
        count = 0;
      }
      const initializer = schemaField({
        type: "integer",
        description: "Count",
      })(undefined, { kind: "field", name: "count" }) as (v: unknown) => unknown;
      initializer.call(new TestClass(), 0);

      const schema = generateSchemaFromClass(TestClass);
      expect(schema.properties).toEqual({
        count: { type: "integer", description: "Count" },
      });
    });
  });
});
