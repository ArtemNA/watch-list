import { Component, input } from '@angular/core';

export type ChipTone = 'neutral' | 'want' | 'watching' | 'watched' | 'dropped';

@Component({
  selector: 'app-chip',
  imports: [],
  templateUrl: './app-chip.html',
  styleUrl: './app-chip.scss',
})
export class AppChip {
  readonly tone = input<ChipTone>('neutral');
}
