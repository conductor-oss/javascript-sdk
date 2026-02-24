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
});
