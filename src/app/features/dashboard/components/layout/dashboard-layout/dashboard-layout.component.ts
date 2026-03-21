import { Component, OnInit } from '@angular/core';
import { DashboardStateService } from '../../../../../core/services/dashboard-state.service';

@Component({
  selector: 'app-dashboard-layout',
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss'
})
export class DashboardLayoutComponent implements OnInit {
  showSidebar = false;

  constructor(public dashState: DashboardStateService) {}

  ngOnInit(): void {
    this.dashState.loadDashboardData();
  }

  onMenuToggle(): void {
    this.showSidebar = !this.showSidebar;
  }

  onCloseSidebar(): void {
    this.showSidebar = false;
  }
}
