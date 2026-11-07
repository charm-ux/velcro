import { useState } from 'react';
import { VelcroAnimation as SlAnimation } from '@charm-ux/velcro/react/VelcroAnimation.js';
import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';

const App = () => {
  const [play, setPlay] = useState(false);

  return (
    <div class="animation-form">
      <SlAnimation name="rubberBand" duration={1000} iterations={1} play={play} onSlFinish={() => setPlay(false)}>
        <SlButton variant="primary" onClick={() => setPlay(true)}>
          Click me
        </SlButton>
      </SlAnimation>
    </div>
  );
};
