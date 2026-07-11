import { Injectable, inject } from '@angular/core';

import { MetaRepository } from '../data/meta.repository';

const META_KEY = 'share.anonId';

function randomHex8(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Стабільний `anon-<8 hex>` для незалогінених відправників (ARCHITECTURE §9) — створюється ліниво, живе в meta. */
@Injectable({ providedIn: 'root' })
export class AnonIdService {
  private readonly meta = inject(MetaRepository);
  private cached: string | null = null;

  async getOrCreate(): Promise<string> {
    if (this.cached) {
      return this.cached;
    }
    const existing = await this.meta.get<string>(META_KEY);
    if (existing) {
      this.cached = existing;
      return existing;
    }
    const id = `anon-${randomHex8()}`;
    await this.meta.set(META_KEY, id);
    this.cached = id;
    return id;
  }
}
