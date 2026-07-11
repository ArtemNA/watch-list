import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { AnonIdService } from '../../../core/share/anon-id';
import { AuthService } from '../../../core/auth/auth.service';
import { ItemsRepository } from '../../../core/data/items.repository';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { MediaItem } from '../../../core/models/media-item.model';
import type { ListEntry } from '../../../core/models/media-list.model';
import { buildPayload, encodeSharePayload, type ShareSource } from '../../../core/share/share-payload';
import { ShareService } from '../../../core/share/share.service';
import { AppButton } from '../../../shared/ui/button/app-button';

export interface ShareListDialogData {
  source: ShareSource;
}

type ShareTab = 'link' | 'code';
type CopyTarget = 'link' | 'code';

/**
 * Шер списку (ARCHITECTURE §9): чекбокси notes/links ЗАВЖДИ вимкнені за
 * замовчуванням; обидва транспорти (URL через бекенд і офлайн-код) працюють
 * з того самого buildPayload — код перераховується реактивно (computed), лінк
 * створюється лише по кліку (мережевий виклик).
 */
@Component({
  selector: 'app-share-list-dialog',
  imports: [MatDialogModule, TPipe, AppButton],
  templateUrl: './share-list-dialog.html',
  styleUrl: './share-list-dialog.scss',
})
export class ShareListDialog {
  private readonly data = inject<ShareListDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ShareListDialog>);
  private readonly itemsRepo = inject(ItemsRepository);
  private readonly authService = inject(AuthService);
  private readonly anonId = inject(AnonIdService);
  private readonly shareService = inject(ShareService);
  protected readonly i18n = inject(I18nService);

  protected readonly includeNotes = signal(false);
  protected readonly includeLinks = signal(false);
  protected readonly tab = signal<ShareTab>('link');

  protected readonly sharedBy = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly createError = signal(false);
  protected readonly link = signal<string | null>(null);
  protected readonly copied = signal<CopyTarget | null>(null);

  private readonly byTmdbId = computed(() => {
    const map = new Map<number, MediaItem>();
    for (const item of this.itemsRepo.items()) {
      if (item.tmdbId !== undefined) {
        map.set(item.tmdbId, item);
      }
    }
    return map;
  });

  private readonly byId = computed(() => new Map(this.itemsRepo.items().map((item) => [item.id, item])));

  private readonly resolve = (entry: ListEntry): MediaItem | null => {
    if (entry.tmdbId !== undefined) {
      return this.byTmdbId().get(entry.tmdbId) ?? null;
    }
    return this.byId().get(entry.id) ?? null;
  };

  protected readonly offlineCode = computed(() => {
    const payload = this.currentPayload();
    return payload ? encodeSharePayload(payload) : '';
  });

  constructor() {
    void this.initSharedBy();
  }

  private async initSharedBy(): Promise<void> {
    const email = this.authService.email();
    this.sharedBy.set(email ?? (await this.anonId.getOrCreate()));
  }

  private currentPayload() {
    const sharedBy = this.sharedBy();
    if (!sharedBy) {
      return null;
    }
    return buildPayload(this.data.source, this.resolve, sharedBy, {
      includeNotes: this.includeNotes(),
      includeLinks: this.includeLinks(),
    });
  }

  onIncludeNotesChange(event: Event): void {
    this.includeNotes.set((event.target as HTMLInputElement).checked);
    this.link.set(null);
  }

  onIncludeLinksChange(event: Event): void {
    this.includeLinks.set((event.target as HTMLInputElement).checked);
    this.link.set(null);
  }

  setTab(tab: ShareTab): void {
    this.tab.set(tab);
  }

  async createLink(): Promise<void> {
    const payload = this.currentPayload();
    if (!payload) {
      return;
    }
    this.creating.set(true);
    this.createError.set(false);
    try {
      const result = await this.shareService.createShareLink(payload);
      // Будуємо URL із window.location.origin, а не result.url з бекенда:
      // за dev-проксі (ng serve → api-dev, changeOrigin: true) req.headers.host
      // на бекенді — це хост ПРОКСІ-ЦІЛІ, а не той, що бачить браузер, тож
      // задокументований у бекенді url там був би мертвим посиланням.
      this.link.set(`${window.location.origin}/share/${result.code}`);
    } catch {
      this.createError.set(true);
    } finally {
      this.creating.set(false);
    }
  }

  async copy(text: string, target: CopyTarget): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(target);
      setTimeout(() => this.copied.update((current) => (current === target ? null : current)), 2000);
    } catch {
      // Буфер обміну недоступний (немає дозволу/фокуса сторінки) — юзер завжди
      // може виділити й скопіювати вручну з readonly-поля, тому мовчки ігноруємо.
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
