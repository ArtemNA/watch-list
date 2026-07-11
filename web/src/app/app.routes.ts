import { Routes } from '@angular/router';

import { AuthPage } from './features/auth/auth-page/auth-page';
import { DevUi } from './features/dev-ui/dev-ui';
import { ItemPage } from './features/item/item-page/item-page';
import { LibraryPage } from './features/library/library-page/library-page';
import { SearchPage } from './features/search/search-page/search-page';
import { Shell } from './shell/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', component: LibraryPage },
      { path: 'search', component: SearchPage },
      { path: 'item/:id', component: ItemPage },
      { path: 'auth', component: AuthPage },
      { path: 'dev/ui', component: DevUi },
    ],
  },
];
