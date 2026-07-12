import type { I18nService } from '../i18n/i18n.service';
import type { SyncService } from './sync.service';

// Тримає тексти "N хв тому" відносно свіжими без reload (компонент, що
// показує статус, сам заводить setInterval на цей інтервал + сигнал-тік).
export const SYNC_CLOCK_TICK_MS = 60_000;

/**
 * Людський текст стану синку — той самий, що тултіп індикатора в хедері
 * (ARCHITECTURE §6), перевикористаний і в блоці "Акаунт" на Профілі (step-15 §4).
 */
export function syncStatusText(sync: SyncService, i18n: I18nService): string {
  if (sync.isSyncing()) {
    return i18n.t('sync.indicator.syncing');
  }
  if (sync.state() === 'error') {
    return i18n.t('sync.indicator.error');
  }
  if (sync.pendingConflicts() > 0) {
    return i18n.t('sync.indicator.conflicts', { count: sync.pendingConflicts() });
  }
  const lastSyncAt = sync.lastSyncAt();
  if (!lastSyncAt) {
    return i18n.t('sync.indicator.neverSynced');
  }
  return i18n.t('sync.indicator.synced', { time: relativeTime(lastSyncAt, i18n) });
}

function relativeTime(iso: string, i18n: I18nService): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) {
    return i18n.t('sync.indicator.justNow');
  }
  return i18n.t('sync.indicator.minutesAgo', { minutes });
}
