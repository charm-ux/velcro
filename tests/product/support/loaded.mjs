import { expect } from '@playwright/test';

// Litro's client router has settled (it remounts the page once after load, which replaces every example iframe), and the
// docs page and every example frame on it have finished loading their documents and load-blocking resources.
//
// This reads each document's readyState instead of waiting for Playwright's networkidle. Playwright counts a frame idle
// only once every request it saw start in that frame has reported finishing or failing, and clears that count only when
// the frame commits its next document. A load the remount cancels without a report (as Firefox and WebKit do for the
// replaced frames; see request-failures.mjs) can therefore keep the page from ever being idle again, and the wait then
// runs into the test timeout. A resource that really does not load still keeps readyState from completing, and this fails.
export async function documentsLoaded(page) {
  await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const pending = document.readyState === 'complete' ? [] : ['page'];
          for (const [i, frame] of [...document.querySelectorAll('iframe')].entries()) {
            const doc = frame.contentDocument;
            if (!doc || doc.URL === 'about:blank' || doc.readyState !== 'complete') pending.push(`frame ${i}`);
          }
          return pending;
        }),
      { message: 'the docs page and every example frame on it have loaded' },
    )
    .toEqual([]);
}
