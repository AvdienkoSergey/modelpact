// Typing here is structural, so any `number` would pass for a token count. The
// brand's key is a `unique symbol` declared here and never exported, so the
// only way to build a branded value is a constructor in this file.
declare const brand: unique symbol;
type Brand<T, Name extends string> = T & { readonly [brand]: Name };

/** Non-negative integer count of context tokens. */
export type Tokens = Brand<number, "Tokens">;

// Returns null rather than throwing: the input comes from someone else's API,
// and the provider has to decide what to do with junk.
export function tokens(value: number): Tokens | null {
  // The condition to its left is what makes this `as` honest, and the same
  // holds for every other cast in this file.
  return Number.isInteger(value) && value >= 0 ? (value as Tokens) : null;
}

/** A plain object: not an array, `Date` or function. */
export type JsonSchema = Brand<Record<string, unknown>, "JsonSchema">;

// Narrower than `object`, which in TypeScript covers arrays, `Date` and
// functions — all of which reach `responseConstraint` and fail deep inside the
// browser. `unknown` in: a schema almost always arrives from JSON.parse.
export function jsonSchema(value: unknown): JsonSchema | null {
  const plain =
    typeof value === "object" && value !== null && !Array.isArray(value);
  return plain ? (value as JsonSchema) : null;
}

/**
 * Success or failure as one value.
 *
 * The failure path is visible in the signature and cannot be skipped: until
 * `ok` is checked, `value` is not in the type. The cost is that `Result`
 * spreads, so keep it at the adapter boundary — inside a provider's
 * implementation, exceptions are fine.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// `never` for the other side means "cannot happen here", which lets the value
// slot into any Result<T, E> without naming E at the call site.
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
