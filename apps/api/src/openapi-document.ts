/**
 * The generated document, made exact where the Swagger builders are not.
 *
 * A nullable enum comes out as `{ enum: [...], nullable: true }`. OpenAPI 3.0
 * reads `enum` as the complete list of allowed values, `null` included, so a
 * generator is right to drop the `null` from that shape — and the console's
 * client lost it: `defaultAgent` could not be cleared without a cast. Listing
 * `null` in the enum says what the API accepts.
 */
export function withNullableEnums<T>(document: T): T {
  visit(document);
  return document;
}

function visit(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) visit(item);
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  const schema = node as { enum?: unknown[]; nullable?: boolean };
  if (schema.nullable === true && Array.isArray(schema.enum) && !schema.enum.includes(null)) {
    schema.enum.push(null);
  }
  for (const value of Object.values(node)) visit(value);
}
