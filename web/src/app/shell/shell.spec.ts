import { OverlayContainer } from '@angular/cdk/overlay';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

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

  it('renders the app title', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('WatchList');
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
});
