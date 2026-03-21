import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DashboardStateService } from '../../../../../core/services/dashboard-state.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Input() showSidebar = false;
  @Output() closeSidebar = new EventEmitter<void>();

  constructor(public dashState: DashboardStateService) {}

  onClose(): void {
    this.closeSidebar.emit();
  }

  get userInitials(): string {
    const name = this.dashState.userFullName$.value;
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    const first = parts[0]?.charAt(0) ?? '';
    const last  = parts[1]?.charAt(0) ?? '';
    return (first + last).toUpperCase() || 'U';
  }
}

