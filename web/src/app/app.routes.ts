import { Routes } from '@angular/router';

import { DevUi } from './features/dev-ui/dev-ui';
import { Shell } from './shell/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      // Тимчасово: поки немає бібліотеки (Step 03–04), '' веде на демо дизайн-системи.
      { path: '', redirectTo: 'dev/ui', pathMatch: 'full' },
      { path: 'dev/ui', component: DevUi },
    ],
  },
];
