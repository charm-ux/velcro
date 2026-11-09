import { useState } from 'react';
import { VelcroRating as SlRating } from '@charm-ux/velcro/react/VelcroRating.js';

const terms = ['No rating', 'Terrible', 'Bad', 'OK', 'Good', 'Excellent'];
const css = `
  .detect-hover span {
    position: relative;
    top: -4px;
    left: 8px;
    border-radius: var(--sl-border-radius-small);
    background: var(--sl-color-neutral-900);
    color: var(--sl-color-neutral-0);
    text-align: center;
    padding: 4px 6px;
  }

  .detect-hover span:empty {
    display: none;
  }
`;

function handleHover(event) {
  rating.addEventListener('sl-hover', event => {
    setFeedback(terms[event.detail.value]);

    // Clear feedback when hovering stops
    if (event.detail.phase === 'end') {
      setFeedback('');
    }
  });
}

const App = () => {
  const [feedback, setFeedback] = useState(true);

  return (
    <>
      <div class="detect-hover">
        <SlRating label="Rating" onSlHover={handleHover} />
        <span>{feedback}</span>
      </div>
      <style>{css}</style>
    </>
  );
};
