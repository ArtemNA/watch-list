import { Pipe, PipeTransform, inject } from '@angular/core';

import { I18nService } from './i18n.service';

// pure: false — навмисне відхилення від ARCHITECTURE.md §7 ("impure не потрібен").
// Емпірично перевірено (step-02): pure-пайп кешує результат за значенням `key`
// і НЕ перевикликає transform(), коли змінюється лише сигнал lang() всередині
// нього — сама View перерендерюється (бо активна кнопка мови оновлюється), але
// текст лишається старою мовою. Деталі — Результат виконання step-02.
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
