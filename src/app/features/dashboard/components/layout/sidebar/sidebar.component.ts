import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Input() showSidebar = false;
  @Output() closeSidebar = new EventEmitter<void>();

  onClose(): void {
    this.closeSidebar.emit();
  }
}
