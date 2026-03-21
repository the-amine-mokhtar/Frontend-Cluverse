import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthHelperService } from './auth-helper.service';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardStateService {

  clubName$     = new BehaviorSubject<string>('');
  clubLogoUrl$  = new BehaviorSubject<string>('');
  userFullName$ = new BehaviorSubject<string>('');
  userRole$     = new BehaviorSubject<string>('');

  constructor(
    private authHelper: AuthHelperService,
    private apiService: ApiService
  ) {}

  loadDashboardData(): void {
    // ── Debug: decoded token ─────────────────────────────────────────────────
    const decoded = this.authHelper.getDecodedToken();
    console.log('[DashboardState] decoded token:', decoded);

    // ── User info (from token, synchronous) ──────────────────────────────────
    const fullName = this.authHelper.getFullName();
    const role     = this.authHelper.getRole();
    const clubId   = this.authHelper.getClubId();

    console.log('[DashboardState] fullName:', fullName, '| role:', role, '| clubId:', clubId);

    this.userFullName$.next(fullName);
    this.userRole$.next(role);

    // ── Club info (from API) ─────────────────────────────────────────────────
    if (!clubId) {
      console.warn('[DashboardState] No clubId found in token — skipping API call');
      return;
    }

    this.apiService.getClubById(clubId).subscribe({
      next: (club: any) => {
        console.log('[DashboardState] getClubById response:', club);
        this.clubName$.next(club?.name ?? '');
        this.clubLogoUrl$.next(club?.logoUrl ?? '');
      },
      error: (err) => {
        console.error('[DashboardState] getClubById failed:', err);
      }
    });
  }
}
