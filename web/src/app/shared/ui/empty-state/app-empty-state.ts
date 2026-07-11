import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  imports: [],
  templateUrl: './app-empty-state.html',
  styleUrl: './app-empty-state.scss',
})
export class AppEmptyState {
  readonly title = input('');
  readonly description = input<string | null>(null);
}
