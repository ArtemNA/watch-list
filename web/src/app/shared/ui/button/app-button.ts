import { Component, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'm' | 's';

@Component({
  selector: 'app-button',
  imports: [],
  templateUrl: './app-button.html',
  styleUrl: './app-button.scss',
})
export class AppButton {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('m');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
}
