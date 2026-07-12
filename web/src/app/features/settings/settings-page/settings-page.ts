import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ItemsRepository } from '../../../core/data/items.repository';
import { I18nService, Lang } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { MediaItem } from '../../../core/models/media-item.model';
import { mergeItems } from '../../../core/sync/merge';
import { runInteractiveSync } from '../../../core/sync/run-interactive-sync';
import { SYNC_CLOCK_TICK_MS, syncStatusText } from '../../../core/sync/sync-status-text';
import { SyncService } from '../../../core/sync/sync.service';
import type { ConflictResolution, SyncConflict } from '../../../core/sync/sync.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { AppButton } from '../../../shared/ui/button/app-button';
import { AppCard } from '../../../shared/ui/card/app-card';

const BACKUP_VERSION = 1;

interface BackupFile {
  version: number;
  exportedAt: string;
  items: MediaItem[];
}

interface ImportPreview {
  fileName: string;
  total: number;
  newCount: number;
  matchingCount: number;
  items: MediaItem[];
}

type ImportState = 'idle' | 'previewing' | 'importing';

@Component({
  selector: 'app-settings-page',
  imports: [RouterLink, TPipe, AppButton, AppCard],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly repo = inject(ItemsRepository);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  protected readonly sync = inject(SyncService);

  protected readonly itemCount = computed(() => this.repo.items().length);

  protected readonly importState = signal<ImportState>('idle');
  protected readonly preview = signal<ImportPreview | null>(null);
  protected readonly importError = signal<string | null>(null);

  // Тримає "N хв тому" в статусі синку свіжим без reload (той самий підхід,
  // що індикатор синку в хедері — ARCHITECTURE §6).
  private readonly clockTick = signal(0);

  constructor() {
    const timer = setInterval(() => this.clockTick.update((n) => n + 1), SYNC_CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected readonly accountSyncStatus = computed(() => {
    this.clockTick();
    return syncStatusText(this.sync, this.i18n);
  });

  setLang(lang: Lang): void {
    this.i18n.setLang(lang);
  }

  async runSync(): Promise<void> {
    await runInteractiveSync(this.sync, this.i18n, this.snackBar);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }

  async exportBackup(): Promise<void> {
    const items = await this.repo.getAllForExport();
    const payload: BackupFile = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `watchlist-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // дозволяє вибрати той самий файл вдруге поспіль
    if (!file) {
      return;
    }

    this.importError.set(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<BackupFile>;
      if (parsed.version !== BACKUP_VERSION || !Array.isArray(parsed.items)) {
        this.importError.set(this.i18n.t('settings.backup.import.errors.invalidFile'));
        return;
      }

      const items = parsed.items;
      let newCount = 0;
      let matchingCount = 0;
      for (const item of items) {
        const existing = await this.repo.getById(item.id);
        if (existing) {
          matchingCount++;
        } else {
          newCount++;
        }
      }
      this.preview.set({ fileName: file.name, total: items.length, newCount, matchingCount, items });
      this.importState.set('previewing');
    } catch {
      this.importError.set(this.i18n.t('settings.backup.import.errors.invalidFile'));
    }
  }

  cancelImport(): void {
    this.preview.set(null);
    this.importState.set('idle');
    this.importError.set(null);
  }

  async confirmImport(): Promise<void> {
    const preview = this.preview();
    if (!preview) {
      return;
    }
    this.importState.set('importing');

    // Та сама логіка, що й у SyncService (Step 08): нові айтеми — тихо, ті, що
    // збігаються по id, — через mergeItems; справжні конфлікти — той самий
    // merge-діалог.
    const toWrite: MediaItem[] = [];
    const conflicts: SyncConflict[] = [];
    const now = new Date().toISOString();

    for (const incoming of preview.items) {
      const existing = await this.repo.getById(incoming.id);
      if (!existing) {
        toWrite.push(incoming);
        continue;
      }
      const outcome = mergeItems(existing, incoming, now);
      switch (outcome.kind) {
        case 'identical':
        case 'useLocal':
          break;
        case 'useRemote':
          toWrite.push(incoming);
          break;
        case 'merged':
          toWrite.push(outcome.item);
          break;
        case 'conflict':
          conflicts.push({ local: existing, remote: incoming, kind: 'fields', base: outcome.base, fields: outcome.fields });
          break;
        case 'deletedVsEdited':
          conflicts.push({ local: existing, remote: incoming, kind: 'deleted', deletedSide: outcome.deletedSide });
          break;
      }
    }

    let skipped = 0;
    if (conflicts.length > 0) {
      const resolutions = await this.openMergeDialog(conflicts);
      for (const resolution of resolutions) {
        if (resolution.kind === 'skip') {
          skipped += 1;
        } else {
          toWrite.push(resolution.item);
        }
      }
    }

    await this.repo.importItems(toWrite);

    this.snackBar.open(
      this.i18n.t('settings.backup.import.success', { imported: toWrite.length, skipped }),
      undefined,
      { duration: 5000 },
    );
    this.cancelImport();
  }

  /** Той самий MergeDialog, що й Step 08 SyncService — динамічний import з тих самих причин. */
  private async openMergeDialog(conflicts: SyncConflict[]): Promise<ConflictResolution[]> {
    const { MergeDialog } = await import('../../sync/merge-dialog/merge-dialog');
    const ref = this.dialog.open(MergeDialog, { data: { conflicts }, disableClose: true });
    const result = await firstValueFrom(ref.afterClosed());
    return result ?? conflicts.map(() => ({ kind: 'skip' as const }));
  }
}
