import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardStateService } from '../../../../../core/services/dashboard-state.service';
import { AuthHelperService } from '../../../../../core/services/auth-helper.service';

@Component({
  selector: 'app-dashboard-layout',
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss'
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
  showSidebar = false;

  private tokenCheckInterval: any = null;

  constructor(
    public dashState: DashboardStateService,
    private authHelper: AuthHelperService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.dashState.loadDashboardData();

    // Auto-logout: check every 60 seconds if the token has expired
    this.tokenCheckInterval = setInterval(() => {
      if (!this.authHelper.isLoggedIn()) {
        clearInterval(this.tokenCheckInterval);
        localStorage.clear();
        this.router.navigate(['/auth/login']);
      }
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
    }
  }

  onMenuToggle(): void {
    this.showSidebar = !this.showSidebar;
  }

  onCloseSidebar(): void {
    this.showSidebar = false;
  }
}
