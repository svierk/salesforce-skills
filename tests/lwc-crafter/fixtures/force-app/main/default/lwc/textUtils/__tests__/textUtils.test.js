import { truncate } from 'c/textUtils';

describe('c-text-utils', () => {
  it('keeps a short text as it is', () => {
    expect(truncate('Acme', 10)).toBe('Acme');
  });

  it('shortens a long text with an ellipsis', () => {
    expect(truncate('Acme Corporation', 5)).toBe('Acme…');
  });
});
