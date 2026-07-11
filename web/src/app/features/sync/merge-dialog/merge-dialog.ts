import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { MediaItem } from '../../../core/models/media-item.model';
import { resolveDeletedVsEdited } from '../../../core/sync/merge';
import type { ConflictResolution, SyncConflict } from '../../../core/sync/sync.service';
import { AppButton } from '../../../shared/ui/button/app-button';

export interface MergeDialogData {
  conflicts: SyncConflict[];
}

type Side = 'local' | 'remote';

@Component({
  selector: 'app-merge-dialog',
  imports: [MatDialogModule, TPipe, AppButton],
  templateUrl: './merge-dialog.html',
  styleUrl: './merge-dialog.scss',
})
export class MergeDialog {
  private readonly data = inject<MergeDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<MergeDialog, ConflictResolution[]>);
  protected readonly i18n = inject(I18nService);

  protected readonly conflicts = this.data.conflicts;
  protected readonly index = signal(0);
  protected readonly total = this.conflicts.length;

  /** Рішення по кожному полю поточного field-конфлікту: field → обраний бік. */
  private readonly fieldChoices = signal<Record<string, Side>>({});
  private readonly resolutions: ConflictResolution[] = [];

  protected readonly current = computed(() => this.conflicts[this.index()]);

  protected readonly title = computed(() => {
    const c = this.current();
    return c.local.title || c.remote.title || '';
  });
  protected readonly posterUrl = computed(() => {
    const c = this.current();
    return c.local.posterUrl ?? c.remote.posterUrl ?? null;
  });

  /** Чи всі поля вирішені — активує «Зберегти вибране». */
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

  /** Форматує значення поля для показу (людською мовою). */
  protected format(field: string, value: unknown): string {
    if (value === undefined || value === null || value === '') {
      return this.i18n.t('sync.merge.empty');
    }
    if (field === 'status') {
      return this.i18n.t(`status.${value as string}`);
    }
    if (field === 'myRating') {
      return `★ ${value as number}`;
    }
    if (field === 'links') {
      const links = value as { label: string }[];
      return links.map((l) => l.label).join(', ');
    }
    return String(value);
  }

  protected fieldLabel(field: string): string {
    return this.i18n.t(`sync.merge.field.${field}`);
  }

  /** «Взяти все звідси / з хмари» — проставляє одну сторону всім полям. */
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
    const item: MediaItem = { ...c.base };
    for (const f of c.fields) {
      const side = choices[f.field];
      (item as unknown as Record<string, unknown>)[f.field] = side === 'local' ? f.local : f.remote;
    }
    this.commit({ kind: 'resolved', item });
  }

  /** deleted-vs-edited: відновити (беремо редаговану версію) чи видалити. */
  protected resolveDeleted(decision: 'restore' | 'delete'): void {
    const c = this.current();
    if (c.kind !== 'deleted' || !c.deletedSide) {
      return;
    }
    const item = resolveDeletedVsEdited(c.local, c.remote, c.deletedSide, decision, new Date().toISOString());
    this.commit({ kind: 'resolved', item });
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

  private commit(resolution: ConflictResolution): void {
    this.resolutions.push(resolution);
    if (this.index() + 1 >= this.total) {
      this.dialogRef.close(this.resolutions);
      return;
    }
    this.index.update((i) => i + 1);
    this.fieldChoices.set({});
  }
}
