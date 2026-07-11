import { describe, expect, it } from 'vitest';

import { isValidEmail, isValidPassword, normalizeEmail } from './validators';

describe('isValidEmail', () => {
  it('accepts a plausible email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('rejects strings without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('rejects strings without a domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects strings with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('accepts a password of exactly 8 characters', () => {
    expect(isValidPassword('12345678')).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(isValidPassword('1234567')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidPassword('')).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com');
  });
});
