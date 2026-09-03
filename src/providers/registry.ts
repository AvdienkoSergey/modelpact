/**
 * The app's list of providers, which is the only place the full set is known.
 *
 * A backend written outside this package names itself, so `ProviderName` is a
 * plain string and the closed union moved here. `keyof typeof registry` is the
 * app's own set, and a switch over it stays exhaustive the way one over a
 * hand-written union did.
 *
 * `defineProviders` exists for the trap in doing it by hand: annotating with
 * `const providers: ProviderRegistry = {…}` widens the keys back to `string`
 * and takes the exhaustiveness with them.
 */

import type { AiProvider } from "../types/provider.js";

export type ProviderRegistry = Readonly<Record<string, AiProvider>>;

/** Identity at runtime: it checks the values and leaves the keys as literals. */
export const defineProviders = <Registry extends ProviderRegistry>(
  registry: Registry,
): Registry => registry;

/**
 * A saved choice comes back from storage as a string. This is the one place it
 * becomes a name the registry holds, or nothing.
 */
export function findProviderName<Name extends string>(
  registry: Readonly<Record<Name, AiProvider>>,
  saved: string,
): Name | null {
  // `Object.hasOwn`, not `in`: an inherited `toString` is not a provider, and
  // `__proto__` is not a name anyone registered.
  const registered = Object.hasOwn(registry, saved);
  if (!registered) return null;
  // The check on the line above is what makes this cast honest. The names are
  // a parameter rather than `keyof Registry` so that it stays one: under that
  // constraint the compiler reads every key as a plain string.
  return saved as Name;
}
