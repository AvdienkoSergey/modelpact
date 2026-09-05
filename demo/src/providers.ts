/**
 * The app's list of backends. One object, and its keys are the app's provider
 * names: the switch below stays exhaustive because of it.
 *
 * Three entries, and the same mock behind all of them — a different setting
 * each, so that a branch of the contract nobody can stage on demand becomes a
 * line in a picker. There is nothing behind any of them on purpose: the
 * transports that reach real models are `modelpact-providers`, and its demo is
 * about what happens when something answers. This one is about what the
 * contract promises whether anything answers or not.
 */

import { defineProviders, makeMockProvider } from "modelpact";

/** Long enough to watch arrive, and to reach the stop button before it ends. */
const generateReply = (input: string): readonly string[] => {
  const askedText = input.trim().replace(/\s+/g, " ").slice(0, 60);
  const sentence =
    `You asked «${askedText}». There is no model behind this: the mock streams ` +
    `a canned answer one word at a time, which is enough to show a stream, ` +
    `an abort that leaves the session open, and a window filling up.`;
  const words = sentence.match(/\S+\s*/g) ?? ["…"];
  return words;
};

const MOCK_SETTINGS = { reply: generateReply, delayMs: 45 };

export const PROVIDERS = defineProviders({
  mock: makeMockProvider(MOCK_SETTINGS),
  // Narrow enough that the second turn crosses the line.
  "mock-narrow": makeMockProvider({ ...MOCK_SETTINGS, contextWindow: 60 }),
  // Enough steps that the bar is something you watch rather than something
  // you miss: the mock waits `delayMs` between them.
  "mock-download": makeMockProvider({
    ...MOCK_SETTINGS,
    access: "needs-download",
    downloadSteps: [
      0, 0.06, 0.14, 0.23, 0.35, 0.44, 0.58, 0.7, 0.79, 0.88, 0.95, 1,
    ],
  }),
});

export type ProviderName = keyof typeof PROVIDERS;

export const PROVIDER_NAMES = Object.keys(PROVIDERS) as ProviderName[];

export function getProviderLabel(providerName: ProviderName): string {
  switch (providerName) {
    case "mock":
      return "Mock";
    case "mock-narrow":
      return "Mock · narrow window";
    case "mock-download":
      return "Mock · downloads first";
  }
}
