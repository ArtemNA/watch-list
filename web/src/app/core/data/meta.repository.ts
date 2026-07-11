import { Injectable, inject } from '@angular/core';

import { AppDb } from '../db/app-db';

@Injectable({ providedIn: 'root' })
export class MetaRepository {
  private readonly db = inject(AppDb);

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const entry = await this.db.meta.get(key);
    return entry?.value as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.db.meta.put({ key, value });
  }
}
