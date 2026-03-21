import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ThemeService } from '../../../../../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrls: ['./theme-toggle.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ThemeToggleComponent implements OnInit {
  isDark = true;

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.isDark = this.themeService.isDark$.value;
  }

  onToggle(): void {
    this.themeService.toggleTheme();
    this.isDark = this.themeService.isDark$.value;
  }
}
