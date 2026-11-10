import { VelcroCarousel as SlCarousel } from '@charm-ux/velcro/react/VelcroCarousel.js';
import { VelcroCarouselItem as SlCarouselItem } from '@charm-ux/velcro/react/VelcroCarouselItem.js';

const App = () => (
  <SlCarousel autoplay loop pagination>
    <SlCarouselItem>
      <img
        alt="Placeholder illustration of snow-capped mountains under a blue sky"
        src="data:image/svg+xml,%3Csvg xmlns=%27http:%2F%2Fwww.w3.org%2F2000%2Fsvg%27 viewBox=%270 0 600 400%27%3E%3Crect width=%27600%27 height=%27400%27 fill=%27%2338bdf8%27/%3E%3Cpath d=%27M0 400L140 150l80 110 90-170 290 310z%27 fill=%27%23334155%27/%3E%3Cpath d=%27M310 90l-40 70 40-20 40 20z%27 fill=%27%23f8fafc%27/%3E%3Cpath d=%27M140 150l-25 40 25-12 25 12z%27 fill=%27%23f8fafc%27/%3E%3C/svg%3E"
      />
    </SlCarouselItem>
    <SlCarouselItem>
      <img
        alt="Placeholder illustration of a waterfall in a green forest"
        src="data:image/svg+xml,%3Csvg xmlns=%27http:%2F%2Fwww.w3.org%2F2000%2Fsvg%27 viewBox=%270 0 600 400%27%3E%3Crect width=%27600%27 height=%27400%27 fill=%27%23166534%27/%3E%3Crect x=%27250%27 y=%270%27 width=%27100%27 height=%27320%27 fill=%27%23e0f2fe%27/%3E%3Cellipse cx=%27300%27 cy=%27340%27 rx=%27160%27 ry=%2740%27 fill=%27%2338bdf8%27/%3E%3C/svg%3E"
      />
    </SlCarouselItem>
    <SlCarouselItem>
      <img
        alt="Placeholder illustration of a sun setting over a purple field"
        src="data:image/svg+xml,%3Csvg xmlns=%27http:%2F%2Fwww.w3.org%2F2000%2Fsvg%27 viewBox=%270 0 600 400%27%3E%3Crect width=%27600%27 height=%27400%27 fill=%27%237c3aed%27/%3E%3Crect y=%27200%27 width=%27600%27 height=%27120%27 fill=%27%23fb923c%27/%3E%3Ccircle cx=%27300%27 cy=%27230%27 r=%2760%27 fill=%27%23fde68a%27/%3E%3Crect y=%27300%27 width=%27600%27 height=%27100%27 fill=%27%234c1d95%27/%3E%3C/svg%3E"
      />
    </SlCarouselItem>
    <SlCarouselItem>
      <img
        alt="Placeholder illustration of a grass field with the sun in the sky"
        src="data:image/svg+xml,%3Csvg xmlns=%27http:%2F%2Fwww.w3.org%2F2000%2Fsvg%27 viewBox=%270 0 600 400%27%3E%3Crect width=%27600%27 height=%27400%27 fill=%27%23fde68a%27/%3E%3Ccircle cx=%27450%27 cy=%27140%27 r=%2750%27 fill=%27%23f59e0b%27/%3E%3Crect y=%27220%27 width=%27600%27 height=%27180%27 fill=%27%2365a30d%27/%3E%3C/svg%3E"
      />
    </SlCarouselItem>
    <SlCarouselItem>
      <img
        alt="Placeholder illustration of a mountain valley with clouds"
        src="data:image/svg+xml,%3Csvg xmlns=%27http:%2F%2Fwww.w3.org%2F2000%2Fsvg%27 viewBox=%270 0 600 400%27%3E%3Crect width=%27600%27 height=%27400%27 fill=%27%2394a3b8%27/%3E%3Cpath d=%27M0 400L200 120l120 160 100-110 180 230z%27 fill=%27%23475569%27/%3E%3Cellipse cx=%27140%27 cy=%2790%27 rx=%2790%27 ry=%2726%27 fill=%27%23f1f5f9%27/%3E%3Cellipse cx=%27440%27 cy=%2760%27 rx=%2770%27 ry=%2720%27 fill=%27%23f1f5f9%27/%3E%3C/svg%3E"
      />
    </SlCarouselItem>
  </SlCarousel>
);
