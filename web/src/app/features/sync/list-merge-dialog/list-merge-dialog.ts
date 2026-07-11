import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { MediaList } from '../../../core/models/media-list.model';
import { resolveListDeletedVsEdited } from '../../../core/sync/merge-lists';
import type { ListConflictResolution, ListSyncConflict } from '../../../core/sync/sync.service';
import { AppButton } from '../../../shared/ui/button/app-button';

export interface ListMergeDialogData {
  conflicts: ListSyncConflict[];
}

type Side = 'local' | 'remote';

/**
 * Аналог features/sync/merge-dialog, але для колекції lists (Step 11): лише
 * name/description можуть конфліктувати (entries зливаються автоматично —
 * ARCHITECTURE §9), тож немає постера і рядка «Улюблене»/статусів.
 */
@Component({
  selector: 'app-list-merge-dialog',
  imports: [MatDialogModule, TPipe, AppButton],
  templateUrl: './list-merge-dialog.html',
  styleUrl: './list-merge-dialog.scss',
})
export class ListMergeDialog {
  private readonly data = inject<ListMergeDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ListMergeDialog, ListConflictResolution[]>);
  protected readonly i18n = inject(I18nService);

  protected readonly conflicts = this.data.conflicts;
  protected readonly index = signal(0);
  protected readonly total = this.conflicts.length;

  private readonly fieldChoices = signal<Record<string, Side>>({});
  private readonly resolutions: ListConflictResolution[] = [];

  protected readonly current = computed(() => this.conflicts[this.index()]);

  protected readonly title = computed(() => {
    const c = this.current();
    return c.local.name || c.remote.name || '';
  });

  protected readonly allResolved = computed(() => {
    const c = this.current();
    if (c.kind !== 'fields' || !c.fields) {
      return true;
    }
    const choices = this.fieldChoices();
    return c.fields.every((f) => choices[f.field] !== undefined);
  });

  protected choiceFor(field: string): Side | undefined {
    return this.fieldChoices()[field];
  }

  protected choose(field: string, side: Side): void {
    this.fieldChoices.update((choices) => ({ ...choices, [field]: side }));
  }

  protected format(value: unknown): string {
    if (value === undefined || value === null || value === '') {
      return this.i18n.t('sync.merge.empty');
    }
    return String(value);
  }

  protected fieldLabel(field: string): string {
    return this.i18n.t(`lists.merge.field.${field}`);
  }

  protected takeAll(side: Side): void {
    const c = this.current();
    if (c.kind !== 'fields' || !c.fields) {
      return;
    }
    const choices: Record<string, Side> = {};
    for (const f of c.fields) {
      choices[f.field] = side;
    }
    this.fieldChoices.set(choices);
  }

  protected saveFields(): void {
    const c = this.current();
    if (c.kind !== 'fields' || !c.base || !c.fields || !this.allResolved()) {
      return;
    }
    const choices = this.fieldChoices();
    const list: MediaList = { ...c.base };
    for (const f of c.fields) {
      const side = choices[f.field];
      (list as unknown as Record<string, unknown>)[f.field] = side === 'local' ? f.local : f.remote;
    }
    this.commit({ kind: 'resolved', item: list });
  }

  protected resolveDeleted(decision: 'restore' | 'delete'): void {
    const c = this.current();
    if (c.kind !== 'deleted' || !c.deletedSide) {
      return;
    }
    const list = resolveListDeletedVsEdited(c.local, c.remote, c.deletedSide, decision, new Date().toISOString());
    this.commit({ kind: 'resolved', item: list });
  }

  protected skip(): void {
    this.commit({ kind: 'skip' });
  }

  protected get isDeletedConflict(): boolean {
    return this.current().kind === 'deleted';
  }

  protected get deletedSide(): Side | undefined {
    return this.current().deletedSide;
  }

  private commit(resolution: ListConflictResolution): void {
    this.resolutions.push(resolution);
    if (this.index() + 1 >= this.total) {
      this.dialogRef.close(this.resolutions);
      return;
    }
    this.index.update((i) => i + 1);
    this.fieldChoices.set({});
  }
}
