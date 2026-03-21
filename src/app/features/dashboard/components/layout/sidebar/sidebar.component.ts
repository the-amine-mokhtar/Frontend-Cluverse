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
}
