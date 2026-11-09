// Waits for keys whose expected effect is that nothing changes. A spec awaits the state each key produces before the next
// key or read (tests/bootstrap/product-waits.test.mjs); when that state is "unchanged", the key's own arrival is the state
// to await. `scope` is the page or a locator in the document that receives the keys (an example frame's body, say).
//
//   await recordKeys(frame.locator('body'));
//   await pressReceived(page, frame.locator('body'), 'ArrowDown');
//   expect(await state()).toEqual(unchanged);
import { expect } from '@playwright/test';

// Records the key of every keydown the scope's document receives, in the capture phase (before a handler can stop it),
// and starts the record afresh.
export const recordKeys = scope => scope.evaluate(() => {
  window.__receivedKeys = [];
  if (window.__recordingKeys) return;
  window.__recordingKeys = true;
  document.addEventListener('keydown', event => window.__receivedKeys.push(event.key), { capture: true });
});

// The keys recorded since recordKeys.
export const receivedKeys = scope => scope.evaluate(() => window.__receivedKeys);

// Presses a key (or a chord such as Shift+Tab, one keydown per key) and waits until the scope's document has received it.
export async function pressReceived(page, scope, key) {
  const before = (await receivedKeys(scope)).length;
  await page.keyboard.press(key);
  const keydowns = key === '+' ? 1 : key.split('+').length;
  await expect.poll(async () => (await receivedKeys(scope)).length, `${key} received`).toBe(before + keydowns);
}
