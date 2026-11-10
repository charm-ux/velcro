import { useState } from 'react';
import { VelcroCarousel as SlCarousel } from '@charm-ux/velcro/react/VelcroCarousel.js';
import { VelcroCarouselItem as SlCarouselItem } from '@charm-ux/velcro/react/VelcroCarouselItem.js';
import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';

const css = `
  .dynamic-carousel {
    --aspect-ratio: 3 / 2;
  }

  .dynamic-carousel ~ .carousel-options {
    display: flex;
    justify-content: center;
    margin-top: var(--sl-spacing-large);
  }

  .dynamic-carousel sl-carousel-item {
    flex: 0 0 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: var(--sl-font-size-2x-large);
  }
`;

const App = () => {
  const [slides, setSlides] = useState(['#204ed8', '#be133d', '#6e28d9']);
  const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'violet'];

  const addSlide = () => {
    setSlides([...slides, colors[slides.length % colors.length]]);
  };

  const removeSlide = () => {
    setSlides(slides.slice(0, -1));
  };

  return (
    <>
      <SlCarousel className="dynamic-carousel" pagination navigation>
        {slides.map((color, i) => (
          <SlCarouselItem key={i} style={{ background: color }}>
            Slide {i + 1}
          </SlCarouselItem>
        ))}
      </SlCarousel>

      <div className="carousel-options">
        <SlButton onClick={addSlide}>Add slide</SlButton>
        <SlButton onClick={removeSlide}>Remove slide</SlButton>
      </div>

      <style>{css}</style>
    </>
  );
};
