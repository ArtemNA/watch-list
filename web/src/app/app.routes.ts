import { Routes } from '@angular/router';

import { AuthPage } from './features/auth/auth-page/auth-page';
import { DevUi } from './features/dev-ui/dev-ui';
import { ItemPage } from './features/item/item-page/item-page';
import { LibraryPage } from './features/library/library-page/library-page';
import { ListDetailPage } from './features/lists/list-detail-page/list-detail-page';
import { ListsPage } from './features/lists/lists-page/lists-page';
import { PreviewPage } from './features/preview/preview-page/preview-page';
import { SearchPage } from './features/search/search-page/search-page';
import { SettingsPage } from './features/settings/settings-page/settings-page';
import { SharePreviewPage } from './features/share/share-preview-page/share-preview-page';
import { devOnlyGuard } from './core/dev-only.guard';
import { Shell } from './shell/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', component: LibraryPage },
      { path: 'search', component: SearchPage },
      { path: 'item/:id', component: ItemPage },
      { path: 'lists', component: ListsPage },
      { path: 'lists/:id', component: ListDetailPage },
      // Превью з пошуку БЕЗ додавання в бібліотеку (Step 13) — дані живуть тільки
      // в пам'яті сторінки, нічого не пишеться в IndexedDB.
      { path: 'preview/:kind/:tmdbId', component: PreviewPage },
      // Шер списку (Step 12) — превью working і для незалогіненого відвідувача.
      { path: 'share/:code', component: SharePreviewPage },
      { path: 'auth', component: AuthPage },
      { path: 'settings', component: SettingsPage },
      // /dev/ui — постійна демо-сторінка дизайн-системи (CLAUDE.md, DECISIONS #14),
      // у проді ховається guard'ом, з коду НЕ видаляється (Step 09, задача 5).
      { path: 'dev/ui', component: DevUi, canActivate: [devOnlyGuard] },
    ],
  },
];
