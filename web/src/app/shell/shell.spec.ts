import { OverlayContainer } from '@angular/cdk/overlay';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Shell } from './shell';

describe('Shell', () => {
  let component: Shell;
  let fixture: ComponentFixture<Shell>;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Shell);
    component = fixture.componentInstance;
    overlayContainer = TestBed.inject(OverlayContainer);
    await fixture.whenStable();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the brand logo linking home', () => {
    // Лого — зображення (бренд власника), а не текст: перевіряємо alt і те,
    // що воно перемикається за темою (dark → світлий wordmark і навпаки).
    const logo = (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('.shell__logo-img');
    expect(logo).toBeTruthy();
    expect(logo!.alt).toBe('WatchList');
    expect(logo!.getAttribute('src')).toContain(
      component['theme'].theme() === 'dark' ? 'logo-dark' : 'logo-light',
    );
  });

  it('switches the language via the header language dropdown, including ru', async () => {
    expect(component['i18n'].lang()).toBe('en'); // Step 10: new-visitor default

    const trigger = (fixture.nativeElement as HTMLElement).querySelector(
      '.shell__lang-btn',
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const items = Array.from(
      overlayContainer.getContainerElement().querySelectorAll<HTMLButtonElement>('.shell__lang-menu-item'),
    );
    expect(items).toHaveLength(3);

    const ruItem = items.find((item) => item.textContent?.includes('Русский'));
    ruItem?.click();
    fixture.detectChanges();

    expect(component['i18n'].lang()).toBe('ru');
  });

  it('toggles the theme when the theme button is clicked', () => {
    const initial = component['theme'].theme();
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      '.shell__theme-toggle',
    ) as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    expect(component['theme'].theme()).not.toBe(initial);
  });

  // Step 15: аватар-коло замінює і email-кнопку, і "Увійти"-лінк — гість
  // бачить силует-іконку (без ініціалу), меню відкриває Увійти/Налаштування.
  it('shows a guest avatar (silhouette icon, no initial) with login/settings menu', async () => {
    const trigger = (fixture.nativeElement as HTMLElement).querySelector(
      '.shell__avatar-btn',
    ) as HTMLButtonElement;
    expect(trigger.querySelector('svg')).toBeTruthy();
    expect(trigger.textContent?.trim()).toBe('');

    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const items = Array.from(
      overlayContainer.getContainerElement().querySelectorAll<HTMLButtonElement>('button[mat-menu-item]'),
    );
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Log in', 'Settings']);
  });

  // Таб-бар (step-15 §2) — 5 напрямків, "+"-FAB і сусідній таб "Пошук" обидва
  // ведуть на /search (свідомий дубль маршруту заради візуального акценту).
  it('renders the bottom tab bar with 5 destinations', () => {
    const tabs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.shell__tab'));
    expect(tabs).toHaveLength(5);

    const hrefs = tabs.map((tab) => tab.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/lists', '/search', '/search', '/settings']);
  });

  it('falls back to the app name in the mobile header when the route has no titleKey', () => {
    const title = (fixture.nativeElement as HTMLElement).querySelector('.shell__mobile-title');
    expect(title?.textContent?.trim()).toBe('WatchList');
  });
});

describe('Shell — account menu (logged in)', () => {
  let fixture: ComponentFixture<Shell>;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    localStorage.clear();
    // AuthService читає токен/email із localStorage у конструкторі — виставити
    // ДО createComponent, інакше Shell побачить гостьовий стан (sync.service.spec.ts).
    localStorage.setItem('watchlist.auth.token', 'test-token');
    localStorage.setItem('watchlist.auth.email', 'artem@example.com');

    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixtureRef = TestBed.createComponent(Shell);
    fixture = fixtureRef;
    overlayContainer = TestBed.inject(OverlayContainer);
    await fixture.whenStable();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('shows the account initial and a menu with email (disabled), settings, sync, logout', async () => {
    const trigger = (fixture.nativeElement as HTMLElement).querySelector(
      '.shell__avatar-btn',
    ) as HTMLButtonElement;
    expect(trigger.textContent?.trim()).toBe('A');

    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const items = Array.from(
      overlayContainer.getContainerElement().querySelectorAll<HTMLButtonElement>('button[mat-menu-item]'),
    );
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'artem@example.com',
      'Settings',
      'Sync now',
      'Log out',
    ]);
    expect(items[0].disabled).toBe(true);
  });
});

describe('Shell — mobile page title', () => {
  it('shows the translated titleKey from route data after navigating', async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([{ path: 'x', component: Shell, data: { titleKey: 'lists.title' } }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Shell);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/x');
    fixture.detectChanges();
    await fixture.whenStable();

    const title = (fixture.nativeElement as HTMLElement).querySelector('.shell__mobile-title');
    expect(title?.textContent?.trim()).toBe('Lists');
  });
});
