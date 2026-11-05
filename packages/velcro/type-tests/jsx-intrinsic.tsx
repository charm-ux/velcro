// Type-level check of the generated JSX integration (dist/react/custom-element-jsx.d.ts) for intrinsic <sl-*> tags in
// React: object refs from useRef/createRef, callback refs, and typed attributes. Compiled, never run.
import { createRef, useRef } from 'react';
import type {} from '../dist/react/custom-element-jsx.js';
import type { VelcroButton } from '../dist/components/button/button.js';
import type { VelcroProgressRing } from '../dist/components/progress-ring/progress-ring.js';

export function App() {
  const hookRef = useRef<VelcroButton>(null);
  const objectRef = createRef<VelcroButton>();
  const ringRef = useRef<VelcroProgressRing | null>(null);
  const wrongRef = createRef<HTMLDivElement>();
  return (
    <>
      <sl-button ref={hookRef} variant="primary" size="small">Save</sl-button>
      <sl-button ref={objectRef}>Go</sl-button>
      <sl-button ref={el => el?.focus()}>Focus</sl-button>
      <sl-progress-ring ref={ringRef} value={50} />
      {/* @ts-expect-error -- a ref to another element type is rejected */}
      <sl-button ref={wrongRef}>Wrong</sl-button>
      {/* @ts-expect-error -- not a Shoelace button variant */}
      <sl-button variant="brand">Bad</sl-button>
    </>
  );
}
