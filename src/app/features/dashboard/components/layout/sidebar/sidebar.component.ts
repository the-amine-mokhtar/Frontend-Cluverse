import { Component, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DashboardStateService } from '../../../../../core/services/dashboard-state.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() showSidebar = false;
  @Output() closeSidebar = new EventEmitter<void>();

  sponsorshipMenuOpen = false;
  private routerEventsSub?: Subscription;

  constructor(public dashState: DashboardStateService, private router: Router) {}

  ngOnInit(): void {
    this.syncSponsorshipMenuFromRoute();
    this.routerEventsSub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.syncSponsorshipMenuFromRoute();
      }
    });
  }

  ngOnDestroy(): void {
    this.routerEventsSub?.unsubscribe();
  }

  onClose(): void {
    this.closeSidebar.emit();
  }

  get isSponsorshipRoute(): boolean {
    return this.router.url.startsWith('/dashboard/sponsorship');
  }

  toggleSponsorshipMenu(): void {
    this.sponsorshipMenuOpen = !this.sponsorshipMenuOpen;
  }

  private syncSponsorshipMenuFromRoute(): void {
    if (this.isSponsorshipRoute) {
      this.sponsorshipMenuOpen = true;
    }
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

