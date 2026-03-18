import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ClubService } from '../../../../core/services/club.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-login2',
  templateUrl: './login2.component.html',
  styleUrls: ['./login2.component.scss']
})
export class Login2Component {
  step = 1;
  email = '';
  password = '';
  
  clubs: any[] = [];
  isLoading = false;
  error = '';

  constructor(
    private authService: AuthService,
    private clubService: ClubService,
    private router: Router
  ) {}

  onLogin(event?: Event) {
    if (event) event.preventDefault();
    this.error = '';
    
    if (!this.email || !this.password) {
      this.error = 'Please enter email and password';
      return;
    }

    this.isLoading = true;
    this.authService.login({ email: this.email, password: this.password })
      .subscribe({
        next: (response: any) => {
          let clubIds: any[] = [];
          if (Array.isArray(response)) {
             clubIds = response.map(m => m.clubId || m.club?.id || m.id || m);
          } else if (response && Array.isArray(response.memberships)) {
             clubIds = response.memberships.map((m: any) => m.clubId || m.club?.id || m.id || m);
          } else {
             this.error = 'Invalid response from server';
             this.isLoading = false;
             return;
          }

          if (clubIds.length === 0) {
             this.error = 'No associated clubs found for this account.';
             this.isLoading = false;
             return;
          }

          // Fetch club details for each id
          const clubRequests = clubIds.map(id => this.clubService.getById(id));
          forkJoin(clubRequests).subscribe({
            next: (clubsData) => {
              this.clubs = clubsData;
              this.step = 2;
              this.isLoading = false;
            },
            error: (err) => {
               this.error = 'Failed to load club details.';
               this.isLoading = false;
            }
          });
        },
        error: (err) => {
          this.error = 'Login failed. Please check your credentials.';
          this.isLoading = false;
        }
      });
  }

  onSelectClub(club: any) {
    if (this.isLoading) return;
    this.isLoading = true;
    this.error = '';
    const clubId = club.id || club.clubId || club._id;
    this.authService.loginClub({ email: this.email, password: this.password }, clubId)
      .subscribe({
        next: (response: any) => {
          if (response && response.token) {
             localStorage.setItem('token', response.token);
             localStorage.setItem('email', response.email || this.email);
             this.router.navigate(['/dashboard']); 
          } else {
             this.error = 'Login to club failed. Token missing.';
             this.isLoading = false;
          }
        },
        error: (err) => {
          this.error = 'Failed to login to the selected club.';
          this.isLoading = false;
        }
      });
  }

  onImageError(event: any) {
    event.target.src = 'https://ui-avatars.com/api/?name=C&background=random';
  }
}
