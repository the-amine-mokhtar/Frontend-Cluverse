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
  userPhotoUrl$ = new BehaviorSubject<string>('');

  constructor(
    private authHelper: AuthHelperService,
    private apiService: ApiService
  ) {}

  /**
   * Called by ProfileComponent after a successful save or photo upload.
   * Pushes new values to all sidebar / header subscribers immediately.
   */
  setUserProfile(firstName: string, lastName: string, photoUrl: string): void {
    const fullName = `${firstName} ${lastName}`.trim();
    this.userFullName$.next(fullName);
    this.userPhotoUrl$.next(photoUrl);
  }

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

    // ── User photo (from profile API) ────────────────────────────────────────
    this.apiService.getMyProfile().subscribe({
      next: (profile: any) => {
        if (profile?.photoUrl) {
          this.userPhotoUrl$.next(profile.photoUrl);
        }
        // Also correct name in case token is stale
        if (profile?.firstName || profile?.lastName) {
          const name = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();
          if (name) this.userFullName$.next(name);
        }
      },
      error: () => {
        // Silently ignore — photo just won't show
      }
    });
  }
}
