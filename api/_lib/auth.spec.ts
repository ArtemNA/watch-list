import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { signJwt, verifyJwt } from './auth';

const ORIGINAL_SECRET = process.env['JWT_SECRET'];

describe('JWT (hand-rolled HS256 на node:crypto)', () => {
  beforeAll(() => {
    process.env['JWT_SECRET'] = 'test-secret-for-jwt-spec';
  });

  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env['JWT_SECRET'];
    } else {
      process.env['JWT_SECRET'] = ORIGINAL_SECRET;
    }
  });

  it('sign → verify повертає той самий userId', async () => {
    const token = await signJwt('user-123');
    expect(token.split('.')).toHaveLength(3);
    expect(verifyJwt(token)).toBe('user-123');
  });

  it('відхиляє підроблений підпис', async () => {
    const token = await signJwt('user-123');
    const [h, p] = token.split('.');
    const forged = `${h}.${p}.${'A'.repeat(43)}`;
    expect(() => verifyJwt(forged)).toThrowError();
  });

  it('відхиляє токен зі зміненим payload (підпис не збігається)', async () => {
    const token = await signJwt('user-123');
    const [h, , s] = token.split('.');
    const otherPayload = Buffer.from(
      JSON.stringify({ sub: 'attacker', iat: 0, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url');
    expect(() => verifyJwt(`${h}.${otherPayload}.${s}`)).toThrowError();
  });

  it('відхиляє протухлий токен', () => {
    // Складаємо токен з exp у минулому тим самим механізмом, що й signJwt.
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: 'user-123', iat: 0, exp: Math.floor(Date.now() / 1000) - 10 }),
    ).toString('base64url');
    const sig = createHmac('sha256', process.env['JWT_SECRET']!)
      .update(`${header}.${payload}`)
      .digest('base64url');
    expect(() => verifyJwt(`${header}.${payload}.${sig}`)).toThrowError();
  });

  it('відхиляє сміття', () => {
    expect(() => verifyJwt('not-a-token')).toThrowError();
    expect(() => verifyJwt('a.b.c')).toThrowError();
  });
});
