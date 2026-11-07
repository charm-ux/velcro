import { useEffect, useRef, useState } from 'react';
import { VelcroRadio as SlRadio } from '@charm-ux/velcro/react/VelcroRadio.js';

// Stand-in for SlRadioGroup, which Velcro does not implement yet: it sets each radio's size, checks the radio whose
// value matches the group's value and, on a click, keeps that radio the only checked one. No arrow keys, no form value
// and no validation.
const SlRadioGroup = ({ label, value, size = 'medium', children }) => {
  const ref = useRef(null);
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    for (const radio of ref.current.querySelectorAll('sl-radio')) {
      radio.size = size;
      radio.checked = radio.value === current;
    }
  });
  const select = event => {
    const radio = event.target.closest('sl-radio');
    if (radio && !radio.disabled) setCurrent(radio.value);
  };
  return (
    <div ref={ref} role="radiogroup" aria-label={label} onClick={select}>
      {label && <div style={{ marginBottom: 'var(--sl-spacing-3x-small)', fontSize: 'var(--sl-input-label-font-size-medium)' }}>{label}</div>}
      {children}
    </div>
  );
};

const App = () => (
  <>
    <SlRadioGroup size="small" value="1">
      <SlRadio value="1">Small 1</SlRadio>
      <SlRadio value="2">Small 2</SlRadio>
      <SlRadio value="3">Small 3</SlRadio>
    </SlRadioGroup>

    <br />

    <SlRadioGroup size="medium" value="1">
      <SlRadio value="1">Medium 1</SlRadio>
      <SlRadio value="2">Medium 2</SlRadio>
      <SlRadio value="3">Medium 3</SlRadio>
    </SlRadioGroup>

    <br />

    <SlRadioGroup size="large" value="1">
      <SlRadio value="1">Large 1</SlRadio>
      <SlRadio value="2">Large 2</SlRadio>
      <SlRadio value="3">Large 3</SlRadio>
    </SlRadioGroup>
  </>
);
