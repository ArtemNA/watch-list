import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';

import { languageForUi } from '../../../core/api/tmdb-language';
import { entryFromItem, entryKey } from '../../../core/data/list-entry';
import { ItemsRepository } from '../../../core/data/items.repository';
import { ListsRepository } from '../../../core/data/lists.repository';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { CustomLink, MediaItem, MediaStatus } from '../../../core/models/media-item.model';
import type { ListEntry, MediaList } from '../../../core/models/media-list.model';
import { AppButton } from '../../../shared/ui/button/app-button';
import { AppCard } from '../../../shared/ui/card/app-card';
import { AppFavoriteToggle } from '../../../shared/ui/favorite-toggle/app-favorite-toggle';
import { AppInput } from '../../../shared/ui/input/app-input';
import { AppRating } from '../../../shared/ui/rating/app-rating';
import { DeleteConfirmDialog } from '../delete-confirm-dialog/delete-confirm-dialog';
import { faviconUrl, normalizeUrl } from '../link-utils';
import { ListFormDialog, type ListFormDialogResult } from '../../lists/list-form-dialog/list-form-dialog';
import { MediaHeader } from '../media-header/media-header';
import { MediaRatings } from '../media-ratings/media-ratings';
import { MediaWatchProviders } from '../media-watch-providers/media-watch-providers';
import { MetadataService } from '../metadata.service';

const STATUSES: MediaStatus[] = ['want', 'watching', 'watched', 'dropped'];
const NOTES_DEBOUNCE_MS = 800;

@Component({
  selector: 'app-item-page',
  imports: [
    RouterLink,
    TPipe,
    AppButton,
    AppCard,
    AppFavoriteToggle,
    AppInput,
    AppRating,
    MatMenuModule,
    MatTooltipModule,
    MediaHeader,
    MediaRatings,
    MediaWatchProviders,
  ],
  templateUrl: './item-page.html',
  styleUrl: './item-page.scss',
})
export class ItemPage {
  private readonly repo = inject(ItemsRepository);
  private readonly listsRepo = inject(ListsRepository);
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

  /** Списки, що вже містять цей айтем (резолв тим самим ключем, що list-detail-page). */
  protected readonly listsForItem = computed<MediaList[]>(() => {
    const current = this.item();
    if (!current) {
      return [];
    }
    const key = entryKey({ id: current.id, tmdbId: current.tmdbId });
    return this.listsRepo.lists().filter((list) => list.entries.some((entry) => entryKey(entry) === key));
  });

  /** Списки в меню «Додати в список» — без тих, де айтем уже є. */
  protected readonly listsAvailableToAdd = computed<MediaList[]>(() => {
    const already = new Set(this.listsForItem().map((list) => list.id));
    return this.listsRepo.lists().filter((list) => !already.has(list.id));
  });

  /**
   * Нотатки/лінки відправника (Step 12, задача 9) — ОКРЕМА картка, не всередині
   * «У списках»: членство в списках і читабельна інформація про фільм від
   * відправника — різні речі, змішувати в одному блоці плутає (знайдено живою
   * перевіркою власником). Список зі списком+entry, а не просто entry, — щоб
   * підписати кожен блок назвою списку (айтем теоретично може бути в кількох
   * імпортованих списках одразу).
   */
  protected readonly sharedNotesEntries = computed<{ list: MediaList; entry: ListEntry }[]>(() => {
    const current = this.item();
    if (!current) {
      return [];
    }
    const result: { list: MediaList; entry: ListEntry }[] = [];
    for (const list of this.listsForItem()) {
      const entry = this.entryFor(current, list);
      if (entry && this.hasSharedExtras(entry)) {
        result.push({ list, entry });
      }
    }
    return result;
  });

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

  toggleFavorite(item: MediaItem): void {
    void this.repo.toggleFavorite(item.id);
  }

  favoriteAriaLabel(item: MediaItem): string {
    return this.i18n.t(item.favorite ? 'library.favorite.remove' : 'library.favorite.add', {
      title: item.title,
    });
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

  addToList(item: MediaItem, list: MediaList): void {
    void this.listsRepo.addEntry(list.id, entryFromItem(item));
  }

  /** Entry поточного айтема в даному списку (той самий ключ, що listsForItem). */
  private entryFor(item: MediaItem, list: MediaList): ListEntry | undefined {
    const key = entryKey({ id: item.id, tmdbId: item.tmdbId });
    return list.entries.find((candidate) => entryKey(candidate) === key);
  }

  private hasSharedExtras(entry: ListEntry): boolean {
    return !!entry.sharedNotes || !!(entry.sharedLinks && entry.sharedLinks.length > 0);
  }

  /** Хрестик на чіпі списку (item-page): видаляє тільки entry, статус айтема не чіпає. */
  removeFromList(item: MediaItem, list: MediaList): void {
    const entry = this.entryFor(item, list);
    if (!entry) {
      return;
    }
    void this.listsRepo.removeEntry(list.id, entry.id);
  }

  removeFromListAriaLabel(list: MediaList): string {
    return this.i18n.t('item.lists.removeFromList', { name: list.name });
  }

  async createListWithItem(item: MediaItem): Promise<void> {
    const ref = this.dialog.open<ListFormDialog, unknown, ListFormDialogResult>(ListFormDialog);
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) {
      return;
    }
    const list = await this.listsRepo.create(result.name, result.description || undefined);
    await this.listsRepo.addEntry(list.id, entryFromItem(item));
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
