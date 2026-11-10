import { VelcroCarousel as SlCarousel } from '@charm-ux/velcro/react/VelcroCarousel.js';
import { VelcroCarouselItem as SlCarouselItem } from '@charm-ux/velcro/react/VelcroCarouselItem.js';

const App = () => (
  <SlCarousel navigation pagination slidesPerPage={2} slidesPerMove={2}>
    <SlCarouselItem style={{ background: 'var(--sl-color-red-200)' }}>Slide 1</SlCarouselItem>
    <SlCarouselItem style={{ background: 'var(--sl-color-orange-200)' }}>Slide 2</SlCarouselItem>
    <SlCarouselItem style={{ background: 'var(--sl-color-yellow-200)' }}>Slide 3</SlCarouselItem>
    <SlCarouselItem style={{ background: 'var(--sl-color-green-200)' }}>Slide 4</SlCarouselItem>
    <SlCarouselItem style={{ background: 'var(--sl-color-blue-200)' }}>Slide 5</SlCarouselItem>
    <SlCarouselItem style={{ background: 'var(--sl-color-violet-200)' }}>Slide 6</SlCarouselItem>
  </SlCarousel>
);
