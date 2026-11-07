// animation's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { pkgDir }) {
  test('the sl-animation API type test checks Shoelace\'s public members and module entries through the export map', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/animation-api.tsx'), 'utf8');
    for (const entry of ['animation/class', 'animation/animations', 'utilities/animation']) {
      assert.match(source, new RegExp(`from '@charm-ux/velcro/${entry}';`), entry);
    }
    assert.match(source, /Pick<VelcroAnimation, ShoelacePublicMembers> = element;/);
    for (const member of ['defaultSlot', 'currentTime', 'handleAnimationChange', 'handlePlayChange', 'handlePlaybackRateChange', 'cancel', 'finish', 'render']) {
      assert.match(source, new RegExp(`\\| '${member}'$`, 'm'), member);
    }
    assert.match(source, /^const rendered: unknown = element\.render\(\);$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 2);
  });
}
