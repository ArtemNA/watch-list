import { Component, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';

export interface SplitButtonOption {
  value: string;
  label: string;
}

/**
 * Кнопка "основна дія" + стрілка з MatMenu додаткових варіантів (напр. вибір статусу
 * при додаванні з пошуку — Step 06, задача 0б). Один спільний компонент, щоб патерн
 * не дублювався розміткою там, де потрібен ще раз.
 */
@Component({
  selector: 'app-split-button',
  imports: [MatMenuModule],
  templateUrl: './app-split-button.html',
  styleUrl: './app-split-button.scss',
})
export class AppSplitButton {
  readonly options = input<SplitButtonOption[]>([]);
  readonly disabled = input(false);
  readonly menuAriaLabel = input('');

  readonly primaryClick = output<void>();
  readonly optionSelected = output<string>();
}
