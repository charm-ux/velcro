import { VelcroRating as SlRating } from '@charm-ux/velcro/react/VelcroRating.js';

function getSymbol(value) {
  const icons = ['emoji-angry', 'emoji-frown', 'emoji-expressionless', 'emoji-smile', 'emoji-laughing'];
  return `<sl-icon name="${icons[value - 1]}"></sl-icon>`;
}

const App = () => <SlRating label="Rating" getSymbol={getSymbol} />;
