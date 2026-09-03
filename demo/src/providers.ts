/**
 * The app's list of backends. One object, and its keys are the app's provider
 * names: the switch in `LABELS` below stays exhaustive because of it.
 *
 * The first three are the same mock with different settings; the fourth is a
 * real model on a daemon. Nothing outside this file knows the difference, which
 * is the claim the rest of the demo is here to make honest — the picker changes
 * the backend and every other line stays as it was.
 */

import {
  defineProviders,
  makeMockProvider,
  makeOllamaProvider,
  makePromptApiProvider,
} from "modelpact";

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
  // A daemon on this machine, and the only entry with a model behind it. Absent
  // one, `access` answers `unavailable` and the chip says so — which is the
  // branch the other three cannot stage.
  ollama: makeOllamaProvider({ model: "granite4:350m" }),
  // Chrome's own, which needs no configuring and no daemon. On a browser
  // without it `access` answers `unavailable`; on one with it undownloaded,
  // the weights are gigabytes, which is what the consent button exists for.
  "prompt-api": makePromptApiProvider(),
});

export type ProviderName = keyof typeof PROVIDERS;

export const PROVIDER_NAMES = Object.keys(PROVIDERS) as ProviderName[];

export function labelOf(name: ProviderName): string {
  switch (name) {
    case "mock":
      return "Mock";
    case "mock-narrow":
      return "Mock · narrow window";
    case "mock-download":
      return "Mock · downloads first";
    case "ollama":
      return "Ollama · granite4:350m";
    case "prompt-api":
      return "Chrome · built-in model";
  }
}
