import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'cluverse-theme';

  isDark$ = new BehaviorSubject<boolean>(true);

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    // default is dark; only switch to light if explicitly saved as 'light'
    const dark = saved !== 'light';
    this.isDark$.next(dark);
    this.applyTheme(dark);
  }

  toggleTheme(): void {
    const next = !this.isDark$.value;
    this.isDark$.next(next);
    this.applyTheme(next);
    localStorage.setItem(this.STORAGE_KEY, next ? 'dark' : 'light');
  }

  private applyTheme(dark: boolean): void {
    if (dark) {
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
    }
  }
}
