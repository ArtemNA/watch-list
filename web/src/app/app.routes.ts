import { Routes } from '@angular/router';

import { DevUi } from './features/dev-ui/dev-ui';
import { ItemPage } from './features/item/item-page/item-page';
import { LibraryPage } from './features/library/library-page/library-page';
import { Shell } from './shell/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', component: LibraryPage },
      { path: 'item/:id', component: ItemPage },
      { path: 'dev/ui', component: DevUi },
    ],
  },
];
