import { createElement } from 'lwc';
import FrameHost from 'c/frameHost';

describe('c-frame-host', () => {
  it('renders', () => {
    const element = createElement('c-frame-host', { is: FrameHost });
    document.body.appendChild(element);
    expect(element).toBeTruthy();
  });
});
