// The request-failure collector treats a cancelled request the same way in every engine: excused only when its frame was
// replaced (detached or navigated afterwards) by the client router's remount, counted everywhere else.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { collectRequestFailures, LOAD_FAILED } from './request-failures.mjs';

function fixture() {
  const page = new EventEmitter();
  const main = { detached: false, isDetached() { return this.detached; } };
  page.mainFrame = () => main;
  const frame = () => ({ detached: false, isDetached() { return this.detached; } });
  const request = (url, owner, errorText) => ({ url: () => url, frame: () => owner, failure: () => (errorText ? { errorText } : null) });
  return { page, main, frame, request };
}

test('Chromium and Firefox cancellations in a replaced frame are excused; any other failure counts', () => {
  const { page, main, frame, request } = fixture();
  const failures = collectRequestFailures(page);
  const replaced = frame();
  const stays = frame();
  const navigated = frame();
  const cases = [
    request('https://example.com/chromium.js', replaced, 'net::ERR_ABORTED'),
    request('https://example.com/firefox.js', replaced, 'NS_BINDING_ABORTED'),
    request('https://example.com/stays.js', stays, 'NS_BINDING_ABORTED'),
    request('https://example.com/main.js', main, 'NS_BINDING_ABORTED'),
    request('https://example.com/other.js', replaced, 'NS_ERROR_FAILURE'),
    request('https://example.com/navigated.js', navigated, 'NS_BINDING_ABORTED'),
  ];
  for (const r of cases) { page.emit('request', r); page.emit('requestfailed', r); }
  replaced.detached = true;
  page.emit('framenavigated', navigated);
  assert.deepEqual(failures().sort(), ['failed /main.js', 'failed /other.js', 'failed /stays.js']);
  assert.deepEqual([...failures.cancelled()].sort(), ['https://example.com/chromium.js', 'https://example.com/firefox.js', 'https://example.com/navigated.js']);
});

test('an unfinished request of a replaced frame counts as cancelled; a finished one or one of a frame that stayed does not', () => {
  const { page, frame, request } = fixture();
  const failures = collectRequestFailures(page);
  const replaced = frame();
  const stays = frame();
  const pending = request('https://example.com/pending.js', replaced);
  const finished = request('https://example.com/finished.js', replaced);
  const kept = request('https://example.com/kept.js', stays);
  for (const r of [pending, finished, kept]) page.emit('request', r);
  page.emit('requestfinished', finished);
  replaced.detached = true;
  assert.deepEqual(failures(), []);
  assert.deepEqual([...failures.cancelled()], ['https://example.com/pending.js']);
});

test("LOAD_FAILED matches only Firefox's exact report of a script or module load and captures its URL", () => {
  assert.equal(LOAD_FAILED.exec('Loading failed for the module with source “https://example.com/a.js”.')?.[1], 'https://example.com/a.js');
  assert.equal(LOAD_FAILED.exec('Loading failed for the <script> with source “https://example.com/b.js”.')?.[1], 'https://example.com/b.js');
  for (const other of ['Loading failed for the module with source “https://example.com/a.js”. More', 'TypeError: x is undefined', 'Loading failed for the module with source "https://example.com/a.js".']) {
    assert.equal(LOAD_FAILED.exec(other), null);
  }
});
