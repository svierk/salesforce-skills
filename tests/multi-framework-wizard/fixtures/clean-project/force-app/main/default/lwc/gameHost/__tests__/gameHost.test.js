import { createElement } from 'lwc';
import GameHost from 'c/gameHost';

describe('c-game-host', () => {
  it('renders', () => {
    const element = createElement('c-game-host', { is: GameHost });
    document.body.appendChild(element);
    expect(element).toBeTruthy();
  });
});
