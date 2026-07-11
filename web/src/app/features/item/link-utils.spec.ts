import { faviconUrl, normalizeUrl } from './link-utils';

describe('normalizeUrl', () => {
  it('prepends https:// when the input has no scheme', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('www.example.com/path?x=1')).toBe('https://www.example.com/path?x=1');
  });

  it('leaves an existing scheme untouched', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
    expect(normalizeUrl('ftp://example.com')).toBe('ftp://example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  example.com  ')).toBe('https://example.com');
  });

  it('returns an empty string unchanged', () => {
    expect(normalizeUrl('')).toBe('');
    expect(normalizeUrl('   ')).toBe('');
  });
});

describe('faviconUrl', () => {
  it('builds a Google s2 favicon URL from the hostname', () => {
    expect(faviconUrl('example.com')).toBe('https://www.google.com/s2/favicons?domain=example.com');
    expect(faviconUrl('https://sub.example.com/page')).toBe(
      'https://www.google.com/s2/favicons?domain=sub.example.com',
    );
  });

  it('returns an empty string for an invalid URL', () => {
    expect(faviconUrl('not a url at all :::')).toBe('');
  });

  it('returns an empty string for an empty input', () => {
    expect(faviconUrl('')).toBe('');
  });
});
