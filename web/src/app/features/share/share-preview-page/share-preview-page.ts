import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { MediaList } from '../../../core/models/media-list.model';
import { parsePayload, type SharePayload } from '../../../core/share/share-payload';
import { ShareService } from '../../../core/share/share.service';
import { AppEmptyState } from '../../../shared/ui/empty-state/app-empty-state';
import { SharedListPreview } from '../shared-list-preview/shared-list-preview';

type PageStatus = 'loading' | 'error' | 'ready';

/** Роут /share/:code (ARCHITECTURE §9, крок 7) — тягне payload з бекенда, далі та сама SharedListPreview. */
@Component({
  selector: 'app-share-preview-page',
  imports: [TPipe, AppEmptyState, SharedListPreview],
  templateUrl: './share-preview-page.html',
  styleUrl: './share-preview-page.scss',
})
export class SharePreviewPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shareService = inject(ShareService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly i18n = inject(I18nService);

  private readonly code = toSignal(this.route.paramMap.pipe(map((params) => params.get('code') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('code') ?? '',
  });

  protected readonly status = signal<PageStatus>('loading');
  protected readonly payload = signal<SharePayload | null>(null);

  private loadedForCode: string | null = null;

  constructor() {
    effect(() => {
      const code = this.code();
      if (!code || code === this.loadedForCode) {
        return;
      }
      this.loadedForCode = code;
      void this.load(code);
    });
  }

  retry(): void {
    this.loadedForCode = null;
    const code = this.code();
    if (code) {
      void this.load(code);
    }
  }

  onListAdded(list: MediaList): void {
    void this.router.navigate(['/lists', list.id]);
    this.snackBar.open(this.i18n.t('share.preview.addSuccess', { name: list.name }), this.i18n.t('common.cancel'), {
      duration: 5000,
    });
  }

  onDiscarded(): void {
    void this.router.navigate(['/']);
  }

  private async load(code: string): Promise<void> {
    this.status.set('loading');
    try {
      const raw = await this.shareService.fetchShare(code);
      const parsed = parsePayload(raw);
      if (parsed instanceof Error) {
        this.status.set('error');
        return;
      }
      this.payload.set(parsed);
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }
}
