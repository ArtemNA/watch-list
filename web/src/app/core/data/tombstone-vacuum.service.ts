import { Injectable, inject } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { META_LAST_SYNC_AT } from '../sync/sync.service';
import { ItemsRepository } from './items.repository';
import { MetaRepository } from './meta.repository';
import { selectVacuumableTombstones } from './vacuum';

/**
 * Вакуум старих tombstones при старті апки (Step 09, задача 6). Ін'єктується
 * один раз у Shell — тільки щоб проініціалізувати запуск (сама по собі нічого
 * не рендерить, як AppUpdateService).
 */
@Injectable({ providedIn: 'root' })
export class TombstoneVacuumService {
  private readonly repo = inject(ItemsRepository);
  private readonly meta = inject(MetaRepository);
  private readonly auth = inject(AuthService);

  constructor() {
    void this.run();
  }

  private async run(): Promise<void> {
    const tombstones = await this.repo.getTombstones();
    if (tombstones.length === 0) {
      return;
    }
    const lastSyncAt = (await this.meta.get<string>(META_LAST_SYNC_AT)) ?? null;
    const candidates = selectVacuumableTombstones(
      tombstones,
      new Date().toISOString(),
      lastSyncAt,
      this.auth.hasEverLoggedIn(),
    );
    await this.repo.hardDeleteMany(candidates.map((item) => item.id));
  }
}
