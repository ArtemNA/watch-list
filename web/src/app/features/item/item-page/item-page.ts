import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { languageForUi } from '../../../core/api/tmdb-language';
import { ItemsRepository } from '../../../core/data/items.repository';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { CustomLink, MediaItem, MediaStatus } from '../../../core/models/media-item.model';
import { AppButton } from '../../../shared/ui/button/app-button';
import { AppCard } from '../../../shared/ui/card/app-card';
import { AppChip } from '../../../shared/ui/chip/app-chip';
import { AppInput } from '../../../shared/ui/input/app-input';
import { AppRating } from '../../../shared/ui/rating/app-rating';
import { DeleteConfirmDialog } from '../delete-confirm-dialog/delete-confirm-dialog';
import { faviconUrl, normalizeUrl } from '../link-utils';
import { MetadataService } from '../metadata.service';

const STATUSES: MediaStatus[] = ['want', 'watching', 'watched', 'dropped'];
const NOTES_DEBOUNCE_MS = 800;

interface RatingEntry {
  key: 'tmdb' | 'imdb' | 'rottenTomatoes' | 'metacritic';
  value: string;
}

@Component({
  selector: 'app-item-page',
  imports: [RouterLink, TPipe, AppButton, AppCard, AppChip, AppInput, AppRating, MatTooltipModule],
  templateUrl: './item-page.html',
  styleUrl: './item-page.scss',
})
export class ItemPage {
  private readonly repo = inject(ItemsRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly metadataService = inject(MetadataService);
  protected readonly i18n = inject(I18nService);

  protected readonly statuses = STATUSES;

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('id') ?? '' },
  );

  protected readonly item = computed<MediaItem | null>(
    () => this.repo.items().find((candidate) => candidate.id === this.id()) ?? null,
  );

  // Нотатки: локальний драфт з debounce-автозбереженням, не читаємо напряму з item()
  // під час набору тексту — інакше кожен зовнішній рефреш items() перезаписав би
  // те, що юзер ще друкує.
  protected readonly notesDraft = signal('');
  protected readonly notesSaveState = signal<'idle' | 'saving' | 'saved'>('idle');
  private notesTimer: ReturnType<typeof setTimeout> | null = null;
  private loadedNotesForId: string | null = null;
  // Останнє значення нотаток, яке ми самі показали в драфті (з айтема чи після
  // власного збереження) — щоб відрізнити «прийшла зміна ззовні» (інша вкладка/
  // синк) від «юзер саме друкує». Step 09, задача 4в.
  private lastKnownNotes = '';

  protected readonly isAddingLink = signal(false);
  protected readonly editingLinkId = signal<string | null>(null);
  protected readonly linkLabelDraft = signal('');
  protected readonly linkUrlDraft = signal('');
  protected readonly linkFormError = signal<string | null>(null);

  protected readonly refreshingMetadata = signal(false);
  private autoRefreshedForKey: string | null = null;

  protected readonly ratingEntries = computed<RatingEntry[]>(() => {
    const ratings = this.item()?.externalRatings;
    if (!ratings) {
      return [];
    }
    // Перевіряємо тип, а не `!== undefined`: після синку/санітизації поля
    // можуть приходити як null (JSON не має undefined), і `null.toFixed()`
    // кидав би помилку — саме це ламало сторінку айтема після синку.
    const entries: RatingEntry[] = [];
    if (typeof ratings.tmdb === 'number') {
      entries.push({ key: 'tmdb', value: ratings.tmdb.toFixed(1) });
    }
    if (typeof ratings.imdb === 'number') {
      entries.push({ key: 'imdb', value: ratings.imdb.toFixed(1) });
    }
    if (ratings.rottenTomatoes) {
      entries.push({ key: 'rottenTomatoes', value: ratings.rottenTomatoes });
    }
    if (typeof ratings.metacritic === 'number') {
      entries.push({ key: 'metacritic', value: String(ratings.metacritic) });
    }
    return entries;
  });

  constructor() {
    effect(() => {
      const current = this.item();
      if (!current) {
        return;
      }
      if (current.id !== this.loadedNotesForId) {
        this.loadedNotesForId = current.id;
        this.lastKnownNotes = current.notes ?? '';
        this.notesDraft.set(this.lastKnownNotes);
        this.notesSaveState.set('idle');
        this.cancelLinkForm();
        return;
      }
      // Той самий айтем, але нотатки в repo відрізняються від того, що ми показували
      // (зовнішня зміна — синк/інша вкладка): підхопити, ТІЛЬКИ якщо юзер зараз не
      // друкує (немає активного debounce-таймера і збереження не в процесі) —
      // інакше перетерли б те, що він саме вводить.
      const incoming = current.notes ?? '';
      if (incoming !== this.lastKnownNotes && !this.notesTimer && this.notesSaveState() !== 'saving') {
        this.lastKnownNotes = incoming;
        this.notesDraft.set(incoming);
      }
    });

    // Автооновлення метаданих при відкритті сторінки (Step 06, задача 3).
    // Guard-ключ — id+мова (не лише id!): раз на пару, щоб repo.update()
    // усередині refresh() не крутив ефект по колу, АЛЕ щоб повторне
    // перемикання мови на відкритій сторінці (en→uk→en) знову тригерило
    // довантаження — з ключем лише по id друге перемикання блокувалось.
    effect(() => {
      const current = this.item();
      const key = current ? `${current.id}:${this.i18n.lang()}` : null;
      if (!current || !key || this.autoRefreshedForKey === key || !this.metadataService.shouldRefresh(current)) {
        return;
      }
      this.autoRefreshedForKey = key;
      void this.refreshMetadata(current);
    });
  }

  ratingAriaLabel(item: MediaItem): string {
    return this.i18n.t('rating.ariaLabel', { value: item.myRating ?? 0 });
  }

  setStatus(item: MediaItem, status: MediaStatus): void {
    void this.repo.update(item.id, { status });
  }

  onRatingChange(item: MediaItem, value: number): void {
    void this.repo.update(item.id, { myRating: value });
  }

  onWatchedAtChange(item: MediaItem, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    void this.repo.update(item.id, { watchedAt: value });
  }

  onNotesInput(value: string): void {
    this.notesDraft.set(value);
    this.notesSaveState.set('idle');
    if (this.notesTimer) {
      clearTimeout(this.notesTimer);
    }
    this.notesTimer = setTimeout(() => {
      this.notesTimer = null;
      void this.saveNotes();
    }, NOTES_DEBOUNCE_MS);
  }

  startAddLink(): void {
    this.isAddingLink.set(true);
    this.editingLinkId.set(null);
    this.linkLabelDraft.set('');
    this.linkUrlDraft.set('');
    this.linkFormError.set(null);
  }

  startEditLink(link: CustomLink): void {
    this.isAddingLink.set(false);
    this.editingLinkId.set(link.id);
    this.linkLabelDraft.set(link.label);
    this.linkUrlDraft.set(link.url);
    this.linkFormError.set(null);
  }

  cancelLinkForm(): void {
    this.isAddingLink.set(false);
    this.editingLinkId.set(null);
    this.linkFormError.set(null);
  }

  async saveLink(item: MediaItem): Promise<void> {
    const label = this.linkLabelDraft().trim();
    const url = normalizeUrl(this.linkUrlDraft());
    if (!label || !url) {
      this.linkFormError.set(this.i18n.t('item.links.errors.required'));
      return;
    }

    const editingId = this.editingLinkId();
    const links = editingId
      ? item.links.map((link) => (link.id === editingId ? { ...link, label, url } : link))
      : [...item.links, { id: crypto.randomUUID(), label, url }];

    await this.repo.update(item.id, { links });
    this.cancelLinkForm();
  }

  async deleteLink(item: MediaItem, linkId: string): Promise<void> {
    await this.repo.update(item.id, { links: item.links.filter((link) => link.id !== linkId) });
  }

  faviconFor(url: string): string {
    return faviconUrl(url);
  }

  openDeleteConfirm(item: MediaItem): void {
    const ref = this.dialog.open(DeleteConfirmDialog, {
      data: { title: item.title },
    });
    ref.afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (confirmed) {
        void this.deleteItem(item);
      }
    });
  }

  async refreshMetadata(item: MediaItem): Promise<void> {
    this.refreshingMetadata.set(true);
    try {
      await this.metadataService.refresh(item);
    } catch {
      this.snackBar.open(this.i18n.t('item.metadata.refreshError'), this.i18n.t('common.cancel'), {
        duration: 5000,
      });
    } finally {
      this.refreshingMetadata.set(false);
    }
  }

  lastUpdatedTooltip(item: MediaItem): string {
    if (!item.metadataUpdatedAt) {
      return this.i18n.t('item.metadata.neverUpdated');
    }
    const date = new Date(item.metadataUpdatedAt).toLocaleString(languageForUi(this.i18n.lang()));
    return this.i18n.t('item.metadata.lastUpdated', { date });
  }

  openTmdbLinkSearch(item: MediaItem): void {
    void this.router.navigate(['/search'], { queryParams: { linkItemId: item.id, q: item.title } });
  }

  tmdbUrl(item: MediaItem): string {
    return `https://www.themoviedb.org/${item.kind}/${item.tmdbId}`;
  }

  imdbUrl(item: MediaItem): string {
    return `https://www.imdb.com/title/${item.imdbId}`;
  }

  private async saveNotes(): Promise<void> {
    const item = this.item();
    if (!item) {
      return;
    }
    this.notesSaveState.set('saving');
    const notes = this.notesDraft();
    await this.repo.update(item.id, { notes });
    this.lastKnownNotes = notes;
    this.notesSaveState.set('saved');
  }

  private async deleteItem(item: MediaItem): Promise<void> {
    await this.repo.softDelete(item.id);
    await this.router.navigate(['/']);

    const ref = this.snackBar.open(
      this.i18n.t('item.delete.snackbarMessage', { title: item.title }),
      this.i18n.t('item.delete.undo'),
      { duration: 6000 },
    );
    ref.onAction().subscribe(() => {
      void this.repo.restore(item.id);
    });
  }
}
