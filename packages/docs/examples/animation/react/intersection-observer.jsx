import { useEffect, useRef, useState } from 'react';
import { VelcroAnimation as SlAnimation } from '@charm-ux/velcro/react/VelcroAnimation.js';

const css = `
  .animation-scroll {
    height: calc(100vh + 100px);
  }

  .animation-scroll .box {
    display: inline-block;
    width: 100px;
    height: 100px;
    background-color: var(--sl-color-primary-600);
  }
`;

const App = () => {
  const animation = useRef(null);
  const box = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        animation.current.play = true;
      } else {
        animation.current.play = false;
        animation.current.currentTime = 0;
      }
    });

    if (box.current) {
      observer.observe(box.current);
    }
  }, [box]);

  return (
    <>
      <div class="animation-scroll">
        <SlAnimation ref={animation} name="jackInTheBox" duration={2000} iterations={1}>
          <div ref={box} class="box" />
        </SlAnimation>
      </div>

      <style>{css}</style>
    </>
  );
};
