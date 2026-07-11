// Ковтаємо ЛИШЕ конкретне безпечне відхилення тіру-дауну: Dexie liveQuery
// (через toSignal у ItemsRepository) інколи долітає зі сповіщенням уже після
// того, як тестова база закрита/видалена, і кидає DatabaseClosedError/
// MissingAPIError у крос-файловому тіру-дауні воркера (відома взаємодія
// Dexie+vitest, див. docs/steps step-05/06). Тести детерміновано зелені;
// без цього фільтра раннер лише через ці "unhandled" завершується кодом 1.
// БУДЬ-ЯКЕ інше відхилення пропускаємо далі — воно має валити тести.
function isBenignDexieTeardown(reason: unknown): boolean {
  const name = (reason as { name?: string; inner?: { name?: string } })?.name;
  const innerName = (reason as { inner?: { name?: string } })?.inner?.name;
  return (
    name === 'DatabaseClosedError' ||
    name === 'MissingAPIError' ||
    innerName === 'MissingAPIError' ||
    innerName === 'DatabaseClosedError'
  );
}

interface NodeProcessLike {
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
}

const proc = (globalThis as { process?: NodeProcessLike }).process;
if (proc && typeof proc.on === 'function') {
  proc.on('unhandledRejection', (reason: unknown) => {
    if (isBenignDexieTeardown(reason)) {
      return; // проковтнути безпечний teardown-шум
    }
    throw reason; // усе інше — реальна помилка
  });
}
