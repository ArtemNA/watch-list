import { Routes } from '@angular/router';

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
      { path: 'dev/ui', component: DevUi },
    ],
  },
];
