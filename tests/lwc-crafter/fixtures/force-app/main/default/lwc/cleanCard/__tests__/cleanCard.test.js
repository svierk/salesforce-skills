import CleanCard from 'c/cleanCard';
import { createElement } from 'lwc';

describe('c-clean-card', () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it('is accessible', async () => {
    const element = createElement('c-clean-card', { is: CleanCard });
    document.body.appendChild(element);
    await expect(element).toBeAccessible();
  });
});
