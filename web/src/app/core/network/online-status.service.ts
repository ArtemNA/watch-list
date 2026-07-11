import { Injectable, signal } from '@angular/core';

/** Реактивний стан мережі (`navigator.onLine` + online/offline). Step 09, задача 3. */
@Injectable({ providedIn: 'root' })
export class OnlineStatus {
  readonly isOnline = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('online', () => this.isOnline.set(true));
    window.addEventListener('offline', () => this.isOnline.set(false));
  }
}
