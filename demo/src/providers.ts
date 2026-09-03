/**
 * The app's list of backends. One object, and its keys are the app's provider
 * names: the switch in `LABELS` below stays exhaustive because of it.
 *
 * All three are the same mock with different settings, because the mock is the
 * only backend that exists yet. Swapping one of them for Ollama or the
 * browser's built-in model is an edit to this file and to nothing else, which
 * is the claim the rest of the demo is here to make honest.
 */

import { defineProviders, makeMockProvider } from "modelpact";

/** Long enough to watch arrive, and to reach the stop button before it ends. */
const reply = (input: string): readonly string[] => {
  const asked = input.trim().replace(/\s+/g, " ").slice(0, 60);
  const sentence =
    `You asked «${asked}». There is no model behind this: the mock streams ` +
    `a canned answer one word at a time, which is enough to show a stream, ` +
    `an abort that leaves the session open, and a window filling up.`;
  return sentence.match(/\S+\s*/g) ?? ["…"];
};

const SETTINGS = { reply, delayMs: 45 };

export const PROVIDERS = defineProviders({
  mock: makeMockProvider(SETTINGS),
  // Narrow enough that the second turn crosses the line.
  "mock-narrow": makeMockProvider({ ...SETTINGS, contextWindow: 60 }),
  // Enough steps that the bar is something you watch rather than something
  // you miss: the mock waits `delayMs` between them.
  "mock-download": makeMockProvider({
    ...SETTINGS,
    access: "needs-download",
    downloadSteps: [
      0, 0.06, 0.14, 0.23, 0.35, 0.44, 0.58, 0.7, 0.79, 0.88, 0.95, 1,
    ],
  }),
});

export type ProviderName = keyof typeof PROVIDERS;

export const PROVIDER_NAMES = Object.keys(PROVIDERS) as ProviderName[];

export function labelOf(name: ProviderName): string {
  switch (name) {
    case "mock":
      return "Mock · 4096-token window";
    case "mock-narrow":
      return "Mock · 60-token window";
    case "mock-download":
      return "Mock · downloads first";
  }
}
