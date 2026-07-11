import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Shell } from './shell';

describe('Shell', () => {
  let component: Shell;
  let fixture: ComponentFixture<Shell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Shell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the app title', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('WatchList');
  });

  it('switches the language when a language button is clicked', () => {
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('.shell__lang-btn');
    const enButton = buttons[1] as HTMLButtonElement;

    enButton.click();
    fixture.detectChanges();

    expect(component['i18n'].lang()).toBe('en');
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
