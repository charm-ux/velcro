// sl-carousel's and sl-carousel-item's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-carousel lists Shoelace\'s attributes (the five Boolean ones reflect), sl-slide-change with its detail and core\'s ready event, the three slots, nine parts and three custom properties', () => {
    const carousel = elements.get('sl-carousel');
    assert.deepEqual(carousel.attributes.map(a => a.name).sort(), [
      'autoplay', 'autoplay-interval', 'dir', 'lang', 'loop', 'mouse-dragging', 'navigation', 'orientation', 'pagination', 'slides-per-move', 'slides-per-page',
    ]);
    const reflects = carousel.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflects, ['autoplay', 'loop', 'mouseDragging', 'navigation', 'pagination']);
    const defaults = Object.fromEntries(carousel.attributes.map(a => [a.name, a.default]));
    assert.deepEqual([defaults['autoplay-interval'], defaults['slides-per-page'], defaults['slides-per-move'], defaults.orientation, defaults.loop], ['3000', '1', '1', "'horizontal'", 'false']);
    assert.equal(carousel.attributes.find(a => a.name === 'orientation').type.text, "'horizontal' | 'vertical'");
    assert.deepEqual(carousel.events.map(e => e.name).sort(), ['ready', 'sl-slide-change']);
    assert.equal(carousel.events.find(e => e.name === 'sl-slide-change').type.text, '{ index: number, slide: SlCarouselItem }');
    assert.equal(carousel.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual(carousel.slots.map(s => s.name).sort(), ['', 'next-icon', 'previous-icon']);
    assert.deepEqual(carousel.cssParts.map(p => p.name).sort(), [
      'base', 'navigation', 'navigation-button', 'navigation-button--next', 'navigation-button--previous', 'pagination', 'pagination-item', 'pagination-item--active', 'scroll-container',
    ]);
    assert.deepEqual(carousel.cssProperties.map(p => p.name).sort(), ['--aspect-ratio', '--scroll-hint', '--slide-gap']);
    assert.equal(carousel.cssProperties.find(p => p.name === '--aspect-ratio').default, '16/9');
  });

  test('sl-carousel\'s public methods are previous, next and goToSlide (documented) plus the public initializeSlides, handleSlideChange, updateSlidesSnap and handleAutoplayChange Shoelace also exposes', () => {
    const carousel = elements.get('sl-carousel');
    const methods = carousel.members.filter(m => m.kind === 'method' && m.privacy !== 'private' && m.privacy !== 'protected' && !m.inheritedFrom).map(m => m.name).sort();
    assert.deepEqual(methods, ['goToSlide', 'handleAutoplayChange', 'handleSlideChange', 'initializeSlides', 'next', 'previous', 'updateSlidesSnap']);
    const documented = ['previous', 'next', 'goToSlide'].map(name => carousel.members.find(m => m.name === name));
    for (const method of documented) assert.ok(method.description, method.name);
    assert.deepEqual(carousel.members.find(m => m.name === 'goToSlide').parameters.map(p => [p.name, p.default]), [['index', undefined], ['behavior', "'smooth'"]]);
  });

  test('sl-carousel-item lists Shoelace\'s one slot and --aspect-ratio, no parts, and only dir, lang and core\'s ready event', () => {
    const item = elements.get('sl-carousel-item');
    assert.deepEqual(item.attributes.map(a => a.name).sort(), ['dir', 'lang']);
    assert.deepEqual(item.slots.map(s => s.name), ['']);
    assert.deepEqual(item.cssParts ?? [], []);
    assert.deepEqual(item.cssProperties.map(p => p.name), ['--aspect-ratio']);
    assert.deepEqual((item.events ?? []).map(e => e.name), ['ready']);
    for (const member of item.members.filter(m => m.kind === 'field')) assert.notEqual(member.reflects, true, member.name);
  });

  test('the carousel dir type test assigns a string-typed direction to both, as Shoelace declares dir: string', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/carousel-dir.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^carousel\.dir = direction;$/m);
    assert.match(source, /^item\.dir = direction;$/m);
    assert.match(source, /^carousel\.goToSlide\(2, 'instant'\);$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 4);
  });
}
