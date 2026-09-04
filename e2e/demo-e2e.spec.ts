/**
 * The contract through a real consumer: the demo in `demo/`, in a browser.
 *
 * Everything here is a promise from `src/types` seen from the outside — a
 * stream arriving in pieces, an abort that leaves the session open, a record
 * that only completed turns reach, an overflow that fires once. The vitest
 * suites assert the same things against the mock directly; this one asserts
 * they survive a bundler, React, and a person clicking.
 *
 * `playwright.config.ts` boots the demo, so there is nothing to start by hand.
 */

import { expect, test as base, type Page } from "@playwright/test";

const test = base.extend<{ errors: string[] }>({
  // Auto, so every spec below carries it: nothing on the page threw, and
  // nothing was logged as an error, during any of them.
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

const composer = (page: Page) => page.getByPlaceholder("Ask it something");
const sendButton = (page: Page) => page.getByRole("button", { name: "Send" });
const stopButton = (page: Page) => page.getByRole("button", { name: "Stop" });
const messages = (page: Page) => page.locator(".record li");
const chip = (page: Page) => page.locator(".chip");

/** A session is open once the composer takes input. */
async function opened(page: Page): Promise<void> {
  await expect(composer(page)).toBeEnabled({ timeout: 15_000 });
}

/** Send, and wait the turn out. The stop button appearing is the turn starting. */
async function ask(page: Page, input: string): Promise<void> {
  await composer(page).fill(input);
  await sendButton(page).click();
  await expect(stopButton(page)).toBeVisible();
  await expect(sendButton(page)).toBeVisible({ timeout: 20_000 });
}

/** Asked from node, not the page: the spec skips rather than fails where no daemon runs. */
async function daemonAnswers(): Promise<boolean> {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await opened(page);
});

test("the answer arrives in pieces, and the finished turn is the record", async ({
  page,
}) => {
  await composer(page).fill("Name the capital of France.");
  await sendButton(page).click();
  await expect(stopButton(page)).toBeVisible();

  // Read it partway: a stream is only a stream if there is a shorter prefix.
  // Waiting for a few words rather than for the element — it renders an
  // ellipsis until the first delta lands, and that is a prefix of nothing.
  await page.waitForFunction(
    () => (document.querySelector(".streaming")?.textContent ?? "").length > 20,
  );
  const partial = await page.locator(".streaming").innerText();
  await expect(sendButton(page)).toBeVisible({ timeout: 20_000 });

  const answer = await messages(page).nth(1).innerText();
  expect(answer.startsWith(partial)).toBe(true);
  expect(answer.length).toBeGreaterThan(partial.length);
  await expect(messages(page)).toHaveCount(2);
  await expect(chip(page)).toHaveText("ready");
});

test("stopping mid-answer keeps the words out of the record and the session open", async ({
  page,
}) => {
  await composer(page).fill("This one gets interrupted");
  await sendButton(page).click();
  await expect(stopButton(page)).toBeVisible();
  await expect(page.locator(".streaming")).not.toBeEmpty();
  await stopButton(page).click();

  await expect(page.getByText(/not in the record/)).toBeVisible();
  await expect(messages(page)).toHaveCount(0);

  // The session survived it, which is the other half of the promise.
  await ask(page, "and again");
  await expect(messages(page)).toHaveCount(2);
});

test("the conversation is still there after a reload", async ({ page }) => {
  await ask(page, "Remember this one.");
  const before = await messages(page).allInnerTexts();

  await page.reload();
  await opened(page);
  expect(await messages(page).allInnerTexts()).toEqual(before);
});

test("a second tab reads the same conversation and stays in step", async ({
  page,
  context,
}) => {
  await ask(page, "Written in the first tab");
  await expect(messages(page)).toHaveCount(2);

  const second = await context.newPage();
  await second.goto("/");
  await opened(second);
  await expect(messages(second)).toHaveCount(2);

  // The `storage` event reaches the first tab, which reopens on the new record.
  await ask(second, "Written in the second");
  await expect(messages(page)).toHaveCount(4, { timeout: 15_000 });
});

test("a window too narrow for the conversation says so once", async ({
  page,
}) => {
  await page.selectOption("select", "mock-narrow");
  await opened(page);

  const notice = page.getByText(/outgrew the window/);
  await ask(page, "one");
  await expect(notice).toHaveCount(0);

  await ask(page, "two");
  // Once, and once only: the window does not un-overflow, and every turn after
  // the first is over the same line.
  await expect(notice).toHaveCount(1);
  await ask(page, "three");
  await expect(notice).toHaveCount(1);
});

test("weights are not fetched until someone says to", async ({ page }) => {
  await page.selectOption("select", "mock-download");
  await expect(chip(page)).toHaveText("fetching weights");

  // Nothing has been downloaded and nothing can be asked: the branch stops
  // here on purpose, because on a real backend this is gigabytes.
  const consent = page.getByRole("button", { name: "Download them" });
  await expect(consent).toBeVisible();
  await expect(sendButton(page)).toBeDisabled();

  await consent.click();
  await opened(page);
  await expect(chip(page)).toHaveText("ready");
  await ask(page, "Downloaded, then asked");
  await expect(messages(page)).toHaveCount(2);
});

/**
 * The one entry with a model behind it, and the only check that runs a real
 * provider where it will actually live. A page is not node: `fetch` held on its
 * own throws `Illegal invocation` in one and works in the other, and no vitest
 * run can see that.
 */
test("the ollama entry reaches a daemon and answers", async ({ page }) => {
  test.skip(!(await daemonAnswers()), "no ollama daemon on 11434");

  await page.selectOption("select", "ollama");
  await expect(chip(page)).toHaveText("ready", { timeout: 30_000 });
  await opened(page);

  await composer(page).fill("Name the capital of France in one word.");
  await sendButton(page).click();
  await expect(sendButton(page)).toBeVisible({ timeout: 60_000 });
  await expect(messages(page)).toHaveCount(2);
  await expect(messages(page).nth(1)).not.toBeEmpty();
});

/**
 * Chrome's own, against the platform rather than against a written stand-in.
 *
 * Nothing is downloaded here: the model is gigabytes, and the branch this
 * lands on is exactly the one that stops and asks. What it proves is that the
 * real `LanguageModel.availability()` was called and its answer came back as
 * one of the three the contract has — a mapping a node run cannot exercise,
 * because the global is missing there.
 */
test("the chrome entry maps the platform's own answer", async ({ page }) => {
  const present = await page.evaluate(
    () => typeof LanguageModel !== "undefined",
  );
  test.skip(!present, "this browser has no Prompt API");

  await page.selectOption("select", "prompt-api");
  await expect(chip(page)).toHaveText(
    /^(ready|fetching weights|unavailable)$/,
    { timeout: 15_000 },
  );

  // Whichever it is, the demo is in a state and not in a crash.
  const said = await chip(page).innerText();
  if (said === "fetching weights") {
    await expect(
      page.getByRole("button", { name: "Download them" }),
    ).toBeVisible();
  }
});

/**
 * A backend from outside the package, in the picker. What it proves is the
 * installed shape end to end: `modelpact-webgpu` resolved through its own
 * `exports`, on top of `modelpact` resolved through its own, in a bundle, in a
 * page. Nothing is downloaded: the branch it lands on is the one that stops
 * and asks.
 */
test("the webgpu entry, from another package, lands in a state", async ({
  page,
}) => {
  await page.selectOption("select", "webgpu");
  await expect(chip(page)).toHaveText(
    /^(ready|fetching weights|unavailable)$/,
    { timeout: 15_000 },
  );
  const said = await chip(page).innerText();
  if (said === "fetching weights") {
    await expect(
      page.getByRole("button", { name: "Download them" }),
    ).toBeVisible();
  }
});

/**
 * A tool, the mock from `modelpact/tools` with the page's title behind it,
 * through the whole stack: the request carries it, the session opens with it,
 * the mock calls it when its name is in the message, and what it said — this
 * very page's title — is the end of the answer. The
 * chip is what says the open session is the one with the tool: the box
 * changes first, and a message sent before the reopen would go to the old
 * session, which has none.
 */
test("a tool reads the page, and the answer carries what it read", async ({
  page,
}) => {
  await page.getByLabel("Read the page").check();
  await expect(chip(page)).toHaveText("ready · tools", { timeout: 15_000 });
  await opened(page);

  await ask(page, "Use pageTitle to read this page.");
  const assistant = page.locator(".record li.assistant");
  await expect(assistant).toHaveCount(1);
  await expect(assistant).toContainText("modelpact demo");
  await expect(page.locator(".record li.tool")).toHaveText(
    "pageTitle · modelpact demo",
  );
});
