import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment.development';

interface ClubOption {
  clubId: number;
  clubName: string;
  role: string;
}

/**
 * Component to handle OAuth2 callback from backend.
 *
 * Three scenarios:
 * 1. Single club   → token contains clubId & role → redirect to dashboard
 * 2. Multiple clubs → token is temporary (PENDING) + memberships list → show club selector
 * 3. No club       → noClub=true → redirect to profile page
 */
@Component({
  selector: 'app-oauth2-callback',
  template: `
    <div class="oauth2-callback-container">

      <!-- Loading / message state -->
      <ng-container *ngIf="!showClubSelector">
        <div class="spinner"></div>
        <p>{{ message }}</p>
      </ng-container>

      <!-- Club selector state -->
      <ng-container *ngIf="showClubSelector">
        <h2>Sélectionnez votre club</h2>
        <p class="subtitle">Vous êtes membre de plusieurs clubs. Choisissez celui dans lequel vous souhaitez vous connecter.</p>
        <div class="club-list">
          <button
            *ngFor="let club of clubs"
            class="club-card"
            (click)="selectClub(club)">
            <span class="club-name">{{ club.clubName }}</span>
            <span class="club-role">{{ club.role }}</span>
          </button>
        </div>
      </ng-container>

    </div>
  `,
  styles: [`
    .oauth2-callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    p {
      font-size: 18px;
      color: #666;
    }
    h2 {
      color: #fff;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #aaa;
      font-size: 14px;
      margin-bottom: 24px;
      text-align: center;
    }
    .club-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      max-width: 400px;
    }
    .club-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px;
      background: rgba(255,255,255,0.05);
      cursor: pointer;
      transition: all 0.2s ease;
      color: #fff;
    }
    .club-card:hover {
      background: rgba(255,255,255,0.12);
      border-color: #3498db;
      transform: translateY(-2px);
    }
    .club-name {
      font-size: 16px;
      font-weight: 600;
    }
    .club-role {
      font-size: 13px;
      padding: 4px 12px;
      border-radius: 20px;
      background: rgba(52,152,219,0.2);
      color: #3498db;
    }
  `]
})
export class OAuth2CallbackComponent implements OnInit, OnDestroy {
  message = 'Processing authentication...';
  showClubSelector = false;
  clubs: ClubOption[] = [];

  private timeoutId: any;
  private tempToken = '';

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe(params => {
      const token = params['token'];
      const error = params['error'];
      const memberships = params['memberships'];
      const noClub = params['noClub'];

      console.log('[OAuth2Callback] Params:', {
        token: token ? 'present' : 'missing',
        error,
        memberships: memberships ? 'present' : 'absent',
        noClub
      });

      if (error) {
        this.message = `Authentication failed: ${error}`;
        this.timeoutId = setTimeout(() => {
          this.router.navigate(['/auth/login'], {
            queryParams: { error }
          });
        }, 2000);
        return;
      }

      if (!token) {
        this.message = 'No token received. Please try again.';
        this.timeoutId = setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 2000);
        return;
      }

      // Store user info
      this.storeUserInfo(params);

      // ── Scenario 2: Multiple clubs → show club selector ──────────────────
      if (memberships) {
        this.tempToken = token;
        localStorage.setItem('token', token); // temporary token

        this.clubs = this.parseMemberships(memberships);
        this.showClubSelector = true;
        this.message = '';
        return;
      }

      // ── Scenario 3: No club → redirect to profile ────────────────────────
      if (noClub === 'true') {
        localStorage.setItem('token', token);
        this.message = 'Authentication successful! Redirecting...';

        this.timeoutId = setTimeout(() => {
          this.router.navigate(['/dashboard/profile']).then(success => {
            if (!success) {
              this.router.navigate(['/dashboard/competencies/member-competencies']);
            }
          });
        }, 1000);
        return;
      }

      // ── Scenario 1: Single club → direct redirect to dashboard ───────────
      localStorage.setItem('token', token);
      this.message = 'Authentication successful! Redirecting...';

      this.timeoutId = setTimeout(() => {
        this.router.navigate(['/dashboard']).then(success => {
          console.log('[OAuth2Callback] Navigation result:', success);
        });
      }, 1000);
    });
  }

  /**
   * Called when user clicks a club card in multi-club mode.
   * Calls backend to get a proper JWT with the chosen clubId & role.
   */
  selectClub(club: ClubOption): void {
    this.showClubSelector = false;
    this.message = 'Loading...';

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.tempToken}`,
      'Content-Type': 'application/json'
    });

    this.http.post<any>(
      `${environment.userApiUrl}/api/auth/oauth2-select-club`,
      { clubId: club.clubId },
      { headers }
    ).subscribe({
      next: (res) => {
        // Replace temporary token with the real one
        localStorage.setItem('token', res.token);
        this.message = 'Authentication successful! Redirecting...';

        this.timeoutId = setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 500);
      },
      error: (err) => {
        console.error('[OAuth2Callback] Club selection failed:', err);
        this.message = 'Error selecting club. Redirecting...';
        this.timeoutId = setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 2000);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private storeUserInfo(params: any): void {
    if (params['email'])     localStorage.setItem('userEmail', params['email']);
    if (params['firstName']) localStorage.setItem('userFirstName', params['firstName']);
    if (params['lastName'])  localStorage.setItem('userLastName', params['lastName']);
    if (params['userId'])    localStorage.setItem('userId', params['userId']);
  }

  /** Parse "clubId:clubName:role,clubId:clubName:role" into ClubOption[] */
  private parseMemberships(raw: string): ClubOption[] {
    return raw.split(',').map(entry => {
      const [id, name, role] = entry.split(':');
      return { clubId: +id, clubName: name, role };
    });
  }
}
