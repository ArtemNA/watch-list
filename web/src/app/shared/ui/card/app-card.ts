import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  imports: [],
  templateUrl: './app-card.html',
  styleUrl: './app-card.scss',
})
export class AppCard {
  readonly title = input<string | null>(null);
}
