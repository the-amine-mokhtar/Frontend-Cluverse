import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-layout',
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss'
})
export class DashboardLayoutComponent {
  showSidebar = false;

  onMenuToggle(): void {
    this.showSidebar = !this.showSidebar;
  }

  onCloseSidebar(): void {
    this.showSidebar = false;
  }
}
