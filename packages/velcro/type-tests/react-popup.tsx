// Type-level check of the generated React wrapper for <sl-popup> against Shoelace 2.20.1's SlPopup React API.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import { VelcroPopup, type VelcroPopupElement, type VelcroPopupProps } from '../dist/react/index.js';

const ref = createRef<VelcroPopupElement>();
const onSlReposition = (event: { target: VelcroPopupElement }) => event.target.reposition();

// Every Shoelace attribute/property, with Shoelace's value types, and the sl-reposition event.
const virtualAnchor = { getBoundingClientRect: () => new DOMRect(0, 0, 10, 10) };
const shoelaceProps: VelcroPopupProps = {
  anchor: 'anchor-id',
  active: true,
  placement: 'bottom-start',
  strategy: 'fixed',
  distance: 8,
  skidding: -4,
  arrow: true,
  arrowPlacement: 'center',
  arrowPadding: 4,
  flip: true,
  flipFallbackPlacements: 'right bottom',
  flipFallbackStrategy: 'initial',
  flipBoundary: document.body,
  flipPadding: 2,
  shift: true,
  shiftBoundary: [document.body],
  shiftPadding: 3,
  autoSize: 'vertical',
  sync: 'width',
  autoSizeBoundary: document.body,
  autoSizePadding: 5,
  hoverBridge: true,
  onSlReposition,
  children: 'Popup',
};
createElement(VelcroPopup, { ...shoelaceProps, ref });
// The anchor also takes an element or a virtual element, and the event's target is the popup element.
createElement(VelcroPopup, { anchor: document.body, onSlReposition: event => event.target.reposition() });
createElement(VelcroPopup, { anchor: virtualAnchor });
const refTarget: VelcroPopupElement | null = ref.current;

// Values outside Shoelace's unions are rejected.
// @ts-expect-error -- not a Shoelace placement
const badPlacement: VelcroPopupProps = { placement: 'middle' };
// @ts-expect-error -- not a Shoelace strategy
const badStrategy: VelcroPopupProps = { strategy: 'sticky' };
// @ts-expect-error -- not a Shoelace arrow placement
const badArrowPlacement: VelcroPopupProps = { arrowPlacement: 'side' };
// @ts-expect-error -- not a Shoelace flip fallback strategy
const badFlipFallbackStrategy: VelcroPopupProps = { flipFallbackStrategy: 'worst-fit' };
// @ts-expect-error -- not a Shoelace auto-size value
const badAutoSize: VelcroPopupProps = { autoSize: 'diagonal' };
// @ts-expect-error -- not a Shoelace sync value
const badSync: VelcroPopupProps = { sync: 'depth' };
// @ts-expect-error -- distance is a number
const badDistance: VelcroPopupProps = { distance: '8' };
// @ts-expect-error -- the event target is the popup, which has no checked property
createElement(VelcroPopup, { onSlReposition: event => event.target.checked });

export { badArrowPlacement, badAutoSize, badDistance, badFlipFallbackStrategy, badPlacement, badStrategy, badSync, refTarget };
