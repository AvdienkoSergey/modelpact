/**
 * `modelpact/testing`: the contract suite, run against any `AiProvider`.
 *
 * A separate entry because it calls `describe` and `test`, and `vitest` is an
 * optional peer dependency — an app that only consumes a provider never loads
 * this.
 */

export {
  CONTRACT_SCHEMA,
  describeContract,
  type ProviderFactory,
  type Scenario,
} from "./contract.js";
