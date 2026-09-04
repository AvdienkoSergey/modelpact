/**
 * `modelpact/tools`: tools written against the contract, for a page.
 *
 * A separate entry because these read the DOM. The main entry runs in node
 * too, and nothing in it names `document`; an app that only consumes a
 * provider never loads this.
 */

export { makePageTextTool, type PageTextConfig } from "./page-text.js";
