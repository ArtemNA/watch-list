import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { SharePayload } from './share-payload';

export interface CreateShareResult {
  code: string;
  url: string;
}

/** Тонка обгортка над /api/share — сам HTTP, без валідації (та живе в share-payload.ts). */
@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly http = inject(HttpClient);

  createShareLink(payload: SharePayload): Promise<CreateShareResult> {
    return firstValueFrom(this.http.post<CreateShareResult>('/api/share', payload));
  }

  async fetchShare(code: string): Promise<unknown> {
    const response = await firstValueFrom(
      this.http.get<{ payload: unknown }>(`/api/share/${encodeURIComponent(code)}`),
    );
    return response.payload;
  }
}
