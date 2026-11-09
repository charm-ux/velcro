// Waits for keys whose expected effect is that nothing changes. A spec awaits the state each key produces before the next
// key or read (tests/bootstrap/product-waits.test.mjs); when that state is "unchanged", the whole key press having been
// delivered is the state to await. `scope` is the page or a locator in the document that receives the keys (an example
// frame's body, say), or a list of them when the key may go to either (the press is counted once, wherever it ends).
//
//   await recordKeys(frame.locator('body'));
//   await pressReceived(page, frame.locator('body'), 'ArrowDown');
//   expect(await state()).toEqual(unchanged);
//
// A press is keydown, keypress (for a key that produces a character or Enter) and keyup. Default actions that follow the
// keydown (implicit form submission on keypress, a native button's or checkbox's activation by Space on keyup) have run
// once the keyup has been dispatched, so the record counts keyups. A key that moves the focus to another document (a Tab
// out of a frame) delivers its keyup there; such a press is not waited for with this helper.
import { expect } from '@playwright/test';

// Records the key of every keyup the scope's document receives, in the capture phase (before a handler can stop it),
// and starts the record afresh.
export const recordKeys = scope => Promise.all([scope].flat().map(one => one.evaluate(() => {
  window.__receivedKeys = [];
  if (window.__recordingKeys) return;
  window.__recordingKeys = true;
  document.addEventListener('keyup', event => window.__receivedKeys.push(event.key), { capture: true });
})));

// The keys whose press has ended (keyup) since recordKeys, in every scope given.
export const receivedKeys = async scope => (await Promise.all([scope].flat().map(one => one.evaluate(() => window.__receivedKeys)))).flat();

// Presses a key (or a chord such as Shift+Tab, one keyup per key) and waits until the scope's document has received the
// whole press.
export async function pressReceived(page, scope, key) {
  const before = (await receivedKeys(scope)).length;
  await page.keyboard.press(key);
  const keyups = key === '+' ? 1 : key.split('+').length;
  await expect.poll(async () => (await receivedKeys(scope)).length, `${key} received`).toBe(before + keyups);
}
