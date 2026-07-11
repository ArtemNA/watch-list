import { Component, input, model } from '@angular/core';

let nextId = 0;

@Component({
  selector: 'app-input',
  imports: [],
  templateUrl: './app-input.html',
  styleUrl: './app-input.scss',
})
export class AppInput {
  readonly label = input('');
  readonly placeholder = input('');
  readonly errorText = input<string | null>(null);
  readonly multiline = input(false);
  readonly value = model('');

  protected readonly controlId = `app-input-${nextId++}`;

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.value.set(target.value);
  }
}
