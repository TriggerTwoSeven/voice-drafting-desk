import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodToGeminiSchema } from "@/lib/gemini";

function prop(
  schema: Record<string, unknown>,
  name: string,
): Record<string, unknown> {
  const properties = schema.properties as Record<string, Record<string, unknown>>;
  const value = properties[name];
  if (!value) throw new Error(`property "${name}" missing from schema`);
  return value;
}

describe("zodToGeminiSchema", () => {
  it("uppercases type and strips JSON-Schema-only keys", () => {
    const schema = z.object({ name: z.string(), count: z.number() });
    const out = zodToGeminiSchema(schema, "Simple") as Record<string, unknown>;
    expect(out.type).toBe("OBJECT");
    expect(out.$schema).toBeUndefined();
    expect(out.definitions).toBeUndefined();
    const schema2 = out as Record<string, unknown>;
    expect(prop(schema2, "name").type).toBe("STRING");
    expect(prop(schema2, "count").type).toBe("NUMBER");
  });

  it("collapses .nullable() into `nullable: true` with no anyOf/null-union left", () => {
    const schema = z.object({ maybe: z.string().nullable() });
    const out = zodToGeminiSchema(schema, "Nullable") as Record<string, unknown>;
    const maybe = prop(out, "maybe");
    expect(maybe.anyOf).toBeUndefined();
    expect(Array.isArray(maybe.type)).toBe(false);
    expect(maybe.type).toBe("STRING");
    expect(maybe.nullable).toBe(true);
  });

  it("stringifies minItems/maxItems for a fixed-length array (.length(3))", () => {
    const schema = z.object({ items: z.array(z.string()).length(3) });
    const out = zodToGeminiSchema(schema, "FixedLength") as Record<string, unknown>;
    const items = prop(out, "items");
    expect(items.minItems).toBe("3");
    expect(items.maxItems).toBe("3");
    expect(typeof items.minItems).toBe("string");
  });

  it("keeps enum arrays as-is with an uppercased string type", () => {
    const schema = z.object({ pick: z.enum(["A", "B", "C"]) });
    const out = zodToGeminiSchema(schema, "Enum") as Record<string, unknown>;
    const pick = prop(out, "pick");
    expect(pick.type).toBe("STRING");
    expect(pick.enum).toEqual(["A", "B", "C"]);
  });

  it("never emits $ref, even for a schema reused across fields (via $refStrategy: none)", () => {
    const inner = z.object({ fact: z.string(), source: z.string() });
    const schema = z.object({ facts: z.array(inner), facts_used: z.array(inner) });
    const out = JSON.stringify(zodToGeminiSchema(schema, "Reused"));
    expect(out).not.toContain("$ref");
    expect(out).not.toContain("definitions");
  });
});
