import { tokens, type Tokens } from "./foundations.types.js";

/**
 * Context accounting in tokens.
 *
 * `unbounded` is a separate variant because the Prompt API reports `Infinity`
 * there; as a plain number it would flow into `total - used` and produce a
 * `remaining` that looks meaningful. `unknown` covers providers that expose no
 * budget at all, which is cheaper than a `null` case at every call site.
 */
export type ContextUsage =
  | { readonly kind: "unknown" }
  | { readonly kind: "unbounded"; readonly used: Tokens }
  | {
      readonly kind: "bounded";
      readonly used: Tokens;
      readonly total: Tokens;
      readonly remaining: Tokens;
    };

/** The checked way to build one: no fractional total, no negative `remaining`. */
export function contextUsage(used: Tokens, total: number): ContextUsage {
  if (total === Infinity) return { kind: "unbounded", used };
  // Usage is allowed to pass the window — that is what fires `contextoverflow`
  // — but "minus three tokens left" is not a value worth carrying.
  const remaining = tokens(Math.max(0, total - used));
  const asTokens = tokens(total);
  // A fractional or negative total means the API returned something
  // unexpected; saying "unknown" beats inventing a number.
  if (asTokens === null || remaining === null) return { kind: "unknown" };
  return { kind: "bounded", used, total: asTokens, remaining };
}
