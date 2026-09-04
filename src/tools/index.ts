/**
 * `modelpact/tools`: tools written against the contract.
 *
 * One so far, and it is the fixture: a mock tool, the counterpart of the mock
 * provider, for a suite that needs a call to have happened and a demo that
 * needs one to show. Tools that read a real page belong to a package of
 * their own, the way real transports do.
 */

export {
  makeMockTool,
  type MockTool,
  type MockToolCall,
  type MockToolConfig,
} from "./mock.js";
