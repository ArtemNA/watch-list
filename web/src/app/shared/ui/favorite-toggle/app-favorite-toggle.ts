import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-favorite-toggle',
  imports: [],
  templateUrl: './app-favorite-toggle.html',
  styleUrl: './app-favorite-toggle.scss',
})
export class AppFavoriteToggle {
  readonly active = input(false);
  readonly ariaLabel = input('');

  readonly toggled = output<void>();

  onClick(event: Event): void {
    // Компонент часто сидить усередині клікабельної картки (library-card <a>) —
    // перемикання улюбленого не має тригерити навігацію по картці.
    event.preventDefault();
    event.stopPropagation();
    this.toggled.emit();
  }
}
