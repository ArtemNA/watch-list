import { Component, computed, input, model, signal } from '@angular/core';

@Component({
  selector: 'app-rating',
  imports: [],
  templateUrl: './app-rating.html',
  styleUrl: './app-rating.scss',
})
export class AppRating {
  readonly value = model(0);
  readonly isReadonly = input(false);
  readonly ariaLabel = input<string | null>(null);

  protected readonly stars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  private readonly hovered = signal<number | null>(null);
  protected readonly displayed = computed(() => this.hovered() ?? this.value());

  onEnter(star: number): void {
    if (!this.isReadonly()) {
      this.hovered.set(star);
    }
  }

  onLeave(): void {
    this.hovered.set(null);
  }

  onClick(star: number): void {
    if (!this.isReadonly()) {
      this.value.set(star);
    }
  }
}
