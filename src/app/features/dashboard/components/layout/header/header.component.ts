import { Component, EventEmitter, HostListener, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthHelperService } from '../../../../../core/services/auth-helper.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  @Output() menuToggle = new EventEmitter<void>();
  today = '';
  searchQuery = '';
  isDropdownOpen = false;

  constructor(
    private router: Router,
    private authHelper: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  onMenuToggle(): void {
    this.menuToggle.emit();
  }

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  @HostListener('document:click')
  closeDropdown(): void {
    this.isDropdownOpen = false;
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
