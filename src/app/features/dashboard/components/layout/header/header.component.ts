import { Component, EventEmitter, HostListener, OnInit, OnDestroy, Output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthHelperService } from '../../../../../core/services/auth-helper.service';
import { ApiService } from '../../../../../core/services/api.service';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() menuToggle = new EventEmitter<void>();
  today = '';
  searchQuery = '';
  
  isDropdownOpen = false;
  
  isNotifOpen = false;
  isNotifClosing = false;
  notifDropdownVisible = false;

  notifications: any[] = [];
  unreadNotifications: any[] = [];
  readNotifications: any[] = [];
  unreadCount = 0;
  private notifSub!: Subscription;
  clubId = 0;

  constructor(
    private router: Router,
    private authHelper: AuthHelperService,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    this.clubId = this.authHelper.getClubId();
    if (this.clubId) {
      this.notifSub = interval(30000).pipe(
        startWith(0),
        switchMap(() => this.api.getNotifications(this.clubId))
      ).subscribe({
        next: (data) => {
          this.notifications = data || [];
          this.unreadNotifications = this.notifications.filter(n => !n.read);
          this.readNotifications = this.notifications.filter(n => n.read);
          this.unreadCount = this.unreadNotifications.length;
        },
        error: () => {}
      });
    }
  }

  ngOnDestroy(): void {
    if (this.notifSub) {
      this.notifSub.unsubscribe();
    }
  }

  onMenuToggle(): void {
    this.menuToggle.emit();
  }

  toggleNotifDropdown(event: Event): void {
    event.stopPropagation();
    if (this.isNotifOpen || this.notifDropdownVisible) {
      if (!this.isNotifClosing) this.closeNotifDropdown();
    } else {
      this.isNotifOpen = true;
      this.notifDropdownVisible = true;
      this.isNotifClosing = false;
      this.isDropdownOpen = false;
    }
  }

  closeNotifDropdown(): void {
    if (!this.notifDropdownVisible) return;
    this.isNotifOpen = false;
    this.isNotifClosing = true;
  }

  onNotifAnimationEnd(): void {
    if (this.isNotifClosing) {
      this.notifDropdownVisible = false;
      this.isNotifClosing = false;
      this.isNotifOpen = false;
      
      // Move all to read array locally and fetch API
      if (this.unreadCount > 0) {
        this.api.markAllNotificationsRead(this.clubId).subscribe(() => {
          this.readNotifications = [...this.unreadNotifications, ...this.readNotifications];
          this.unreadNotifications = [];
          this.unreadCount = 0;
          this.notifications.forEach(n => n.read = true);
        });
      }
    }
  }

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) this.closeNotifDropdown();
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.isDropdownOpen = false;
    if (this.notifDropdownVisible && !this.isNotifClosing) {
      this.closeNotifDropdown();
    }
  }

  goToProfile(): void {
    this.isDropdownOpen = false;
    this.router.navigate(['/dashboard/profile']);
  }

  logout(): void {
    this.isDropdownOpen = false;
    localStorage.clear();
    this.router.navigate(['/auth/login']);
  }

  get userInitials(): string {
    const first = this.authHelper.getFirstName();
    const last = this.authHelper.getLastName();
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || 'U';
  }
}
